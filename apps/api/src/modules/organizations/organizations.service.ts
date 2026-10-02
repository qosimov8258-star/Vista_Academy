import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { OrganizationStatus, Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../database/prisma.service";
import { DEFAULT_POSITIONS } from "../../common/constants/default-positions";
import { DEFAULT_SUBJECTS } from "../../common/constants/default-subjects";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
import { encryptSecret, decryptSecret } from "../../common/crypto/reversible-secret";
import { verifyPlatformRevealToken } from "../platform-webauthn/platform-reveal-token";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { UpdateOrganizationAdminDto } from "./dto/update-organization-admin.dto";
import { OrganizationQueryDto } from "./dto/organization-query.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { UpdateBranchAvatarDto } from "./dto/update-branch-avatar.dto";
import { slugify } from "./slugify";
import { isUsableBranchSlug } from "./branch-slug";
import { MAX_TENANT_SLUG_LENGTH, isValidTenantSlug } from "../../common/tenant-domain";
import { normalizeWebsiteHost } from "../../common/website-host";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";

/** Rasm brauzerda 256x256 gacha kichraytirilgani uchun bundan oshmasligi kerak. */
const MAX_BRANCH_AVATAR_BYTES = 300 * 1024;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly jwt: JwtService,
    private readonly r2: R2Service,
  ) {}

  async create(dto: CreateOrganizationDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new BadRequestException("Tanlangan tarif reja topilmadi");
    }

    const slug = await this.generateUniqueSlug(dto.name);
    const website = this.normalizeWebsiteOrThrow(dto.website);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: dto.name,
            slug,
            website,
            contactName: dto.contactName,
            contactEmail: dto.contactEmail,
            contactPhone: dto.contactPhone,
          },
        });

        const firstBranchName = dto.firstBranchName?.trim() || "Bosh filial";
        await tx.branch.create({
          data: {
            organizationId: organization.id,
            name: firstBranchName,
            slug: await this.generateUniqueBranchSlug(organization.id, organization.slug, firstBranchName, tx),
          },
        });

        await tx.wallet.create({
          data: { organizationId: organization.id, balance: 0 },
        });

        // Xodim qo'shishda tanlash uchun odatiy lavozimlar to'plami tayyor tursin
        await tx.position.createMany({
          data: DEFAULT_POSITIONS.map((name) => ({ organizationId: organization.id, name })),
        });

        // Fan o'qituvchisi uchun tanlash uchun odatiy fanlar to'plami tayyor tursin
        await tx.subject.createMany({
          data: DEFAULT_SUBJECTS.map((name) => ({ organizationId: organization.id, name })),
        });

        const adminPasswordHash = await argon2.hash(dto.adminPassword);
        await tx.tenantUser.create({
          data: {
            organizationId: organization.id,
            login: dto.adminLogin.toLowerCase(),
            passwordHash: adminPasswordHash,
            // Platform panelida "Login/Parol"ni keyinchalik qayta ko'rsatish
            // uchun qaytarib olinadigan shaklda ham saqlanadi (xodimlardagi
            // bilan bir xil yondashuv) — auth esa faqat `passwordHash` orqali.
            passwordEncrypted: encryptSecret(dto.adminPassword),
            fullName: dto.adminFullName,
            role: "NETWORK_ADMIN",
          },
        });

        const now = new Date();
        const periodEnd = new Date(now);
        if (dto.trialDays) {
          periodEnd.setDate(periodEnd.getDate() + dto.trialDays);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEndsAt: dto.trialDays ? periodEnd : null,
          },
        });

        return tx.organization.findUniqueOrThrow({
          where: { id: organization.id },
          include: organizationInclude,
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu veb-sayt allaqachon boshqa bog'chaga bog'langan");
      }
      throw err;
    }
  }

  async findAll(query: OrganizationQueryDto) {
    const search = query.search?.trim();
    const insensitive = "insensitive" as Prisma.QueryMode;
    const searchWhere: Prisma.OrganizationWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: insensitive } },
            { slug: { contains: search, mode: insensitive } },
            { contactPhone: { contains: search, mode: insensitive } },
            { contactEmail: { contains: search, mode: insensitive } },
          ],
        }
      : {};
    const where: Prisma.OrganizationWhereInput = {
      ...searchWhere,
      // Arxivlanganlar faqat "Arxiv" filtrida ko'rinadi
      ...(query.status ? { status: query.status } : { status: { not: "ARCHIVED" } }),
    };
    const orderBy: Prisma.OrganizationOrderByWithRelationInput[] = {
      created: [{ createdAt: "desc" as const }],
      name: [{ name: "asc" as const }],
      children: [{ children: { _count: "desc" as const } }, { createdAt: "desc" as const }],
      balance: [{ wallet: { balance: "desc" as const } }, { createdAt: "desc" as const }],
    }[query.sort ?? "created"];

    const [items, total, byStatus] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        include: {
          ...organizationInclude,
          // Ro'yxatda tarif limitiga nisbatan foydalanish ko'rinsin
          _count: {
            select: {
              children: { where: { status: "ACTIVE" } },
              employees: { where: { isActive: true } },
            },
          },
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.organization.count({ where }),
      // Holat filtrlaridagi sonlar — qidiruv hisobga olinadi, holat filtri emas
      this.prisma.organization.groupBy({
        by: ["status"],
        where: searchWhere,
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
    ]);

    const statusCounts = { ACTIVE: 0, SUSPENDED: 0, ARCHIVED: 0 } as Record<OrganizationStatus, number>;
    for (const row of byStatus) {
      statusCounts[row.status] = typeof row._count === "object" ? (row._count._all ?? 0) : 0;
    }

    return {
      data: items,
      meta: { page: query.page, limit: query.limit, total, statusCounts },
    };
  }

  /** Kirish sahifasi uchun: faqat nom va slug, boshqa maydonlar ochilmaydi. */
  findPublicBySlug(slug: string) {
    return this.prisma.organization.findUnique({ where: { slug }, select: { name: true, slug: true } });
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: organizationInclude,
    });
    if (!organization) {
      throw new NotFoundException("Bog'cha topilmadi");
    }
    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const current = await this.findOne(id);
    if (current.status === "ARCHIVED" && dto.status) {
      throw new BadRequestException("Bog'cha arxivda — avval arxivdan qaytaring");
    }
    const data: Prisma.OrganizationUpdateInput = { ...dto };
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }
    // Holat tahrirlash oynasidan o'zgarsa, to'xtatish sanasi/sababi ham mos bo'lsin
    if (dto.status === "ACTIVE" && current.status !== "ACTIVE") {
      data.suspendReason = null;
      data.suspendedAt = null;
    } else if (dto.status === "SUSPENDED" && current.status !== "SUSPENDED") {
      data.suspendedAt = new Date();
    }
    if (dto.website !== undefined) {
      data.website = dto.website === null ? null : this.normalizeWebsiteOrThrow(dto.website);
    }
    try {
      return await this.prisma.organization.update({
        where: { id },
        data,
        include: organizationInclude,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu veb-sayt allaqachon boshqa bog'chaga bog'langan");
      }
      throw err;
    }
  }

  /**
   * Super admin platform panelida kiritgan "Veb-sayt" qiymatini (masalan
   * "https://Vista-Academy.uz/" yoki "vista-academy.uz") DB'da saqlanadigan
   * yagona ko'rinishga (host, kichik harf, protokol/"www."/yo'lsiz) keltiradi
   * — shu qiymat keyin lending saytidan kelgan Origin bilan solishtiriladi
   * (qarang: LandingService.resolveApplicationOrganizationId).
   */
  private normalizeWebsiteOrThrow(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const host = normalizeWebsiteHost(raw);
    if (!host) {
      throw new BadRequestException("Veb-sayt manzili noto'g'ri");
    }
    return host;
  }

  /**
   * Tashkilot nomini (brend) o'zgartirish — Super Admin (NETWORK_ADMIN)ning
   * o'z kabinetidan, Sozlamalar bo'limida. Bu nom butun panelda (yon panel,
   * kirish sahifasi va h.k.) ko'rinadi, shuning uchun boshqa hech qaysi
   * maydonni o'zgartirmaydi.
   */
  async updateName(organizationId: string, name: string) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name },
      select: { id: true, name: true },
    });
  }

  /** Tashkilotning Super Admin (NETWORK_ADMIN) kabineti — bog'cha URL'iga shu bilan kiriladi. */
  private async requireAdminAccount(organizationId: string) {
    const admin = await this.prisma.tenantUser.findFirst({
      where: { organizationId, role: "NETWORK_ADMIN" },
    });
    if (!admin) {
      throw new NotFoundException("Bu tashkilotning Super Admin kabineti topilmadi");
    }
    return admin;
  }

  /** Login xavfsiz — platform panelida parolsiz ham ko'rsatilishi mumkin. */
  async getAdminAccount(organizationId: string) {
    const admin = await this.requireAdminAccount(organizationId);
    return { login: admin.login, hasStoredPassword: admin.passwordEncrypted !== null };
  }

  /**
   * WebAuthn bilan tasdiqlangan `revealToken` talab qilinadi — shu tokensiz
   * parol hech qachon ochilmaydi (xodimlardagi bilan bir xil qoida).
   */
  async revealAdminPassword(organizationId: string, revealToken: string | undefined, platformUserId: string) {
    if (!revealToken || !verifyPlatformRevealToken(this.jwt, revealToken, platformUserId)) {
      throw new UnauthorizedException("Qurilma tasdiqlanmagan");
    }
    const admin = await this.requireAdminAccount(organizationId);
    if (!admin.passwordEncrypted) {
      throw new BadRequestException("Bu kabinet uchun parol saqlanmagan — yangi parol generatsiya qiling");
    }
    return { login: admin.login, password: decryptSecret(Buffer.from(admin.passwordEncrypted)) };
  }

  /**
   * Super Admin login va/yoki parolini qo'lda o'zgartiradi — avtomatik
   * generatsiya emas, platform admin qiymatni o'zi kiritadi. Parol
   * almashtirilganda eski seanslar darhol yopiladi.
   */
  async updateAdminAccount(organizationId: string, dto: UpdateOrganizationAdminDto) {
    if (!dto.login && !dto.password) {
      throw new BadRequestException("Login yoki parol kiriting");
    }
    const admin = await this.requireAdminAccount(organizationId);

    const data: Prisma.TenantUserUpdateInput = {};
    if (dto.login) {
      data.login = dto.login.toLowerCase();
    }
    if (dto.password) {
      const [passwordHash, passwordEncrypted] = await Promise.all([
        argon2.hash(dto.password),
        Promise.resolve(encryptSecret(dto.password)),
      ]);
      data.passwordHash = passwordHash;
      data.passwordEncrypted = passwordEncrypted;
    }

    try {
      await this.prisma.tenantUser.update({ where: { id: admin.id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu login band — boshqasini tanlang");
      }
      throw err;
    }

    if (dto.password) {
      await this.prisma.tenantRefreshToken.updateMany({
        where: { tenantUserId: admin.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { login: dto.login ? dto.login.toLowerCase() : admin.login };
  }

  async addBranch(organizationId: string, dto: CreateBranchDto) {
    const organization = await this.findOne(organizationId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({
          data: {
            organizationId,
            name: dto.name,
            address: dto.address,
            slug: await this.generateUniqueBranchSlug(organizationId, organization.slug, dto.name, tx),
          },
        });

        if (dto.managerFullName && dto.managerLogin && dto.managerPassword) {
          const passwordHash = await argon2.hash(dto.managerPassword);
          await tx.tenantUser.create({
            data: {
              organizationId,
              branchId: branch.id,
              login: dto.managerLogin.toLowerCase(),
              passwordHash,
              fullName: dto.managerFullName,
              role: "BRANCH_ADMIN",
            },
          });
        }

        return branch;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom yoki login bilan filial/foydalanuvchi allaqachon mavjud");
      }
      throw err;
    }
  }

  async getBranch(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return branch;
  }

  /**
   * Filial belgisini saqlaydi. Rasm brauzerda 256x256 gacha kichraytirilib,
   * data URL ko'rinishida keladi — server faqat hajmini tekshiradi.
   */
  async updateBranchAvatar(organizationId: string, branchId: string, dto: UpdateBranchAvatarDto) {
    const branch = await this.getBranch(organizationId, branchId);
    const [header, base64] = dto.image.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");

    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_BRANCH_AVATAR_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }

    let avatar: Buffer<ArrayBuffer> | null = buffer;
    let avatarKey: string | null = null;
    if (this.r2.enabled) {
      avatarKey = this.r2.buildKey(organizationId, R2_CATEGORY.BRANCH_AVATAR);
      await this.r2.uploadBuffer(avatarKey, buffer, mimeType);
      avatar = null;
    }

    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: { avatar, avatarKey, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
      select: { avatarUpdatedAt: true },
    });
    // DB yozuvi muvaffaqiyatli bo'lgandan KEYIN o'chiriladi — aks holda DB
    // yozuvi muvaffaqiyatsiz bo'lsa, eski qator allaqachon o'chirilgan keyga
    // ishora qilib qolib ketardi.
    if (branch.avatarKey && this.r2.enabled) {
      await this.r2.deleteObject(branch.avatarKey);
    }
    return { avatarUpdatedAt: updated.avatarUpdatedAt };
  }

  async removeBranchAvatar(organizationId: string, branchId: string) {
    await this.getBranch(organizationId, branchId);
    const previous = await this.prisma.branch.update({
      where: { id: branchId },
      data: { avatar: null, avatarKey: null, avatarMimeType: null, avatarUpdatedAt: null },
      select: { avatarKey: true },
    });
    if (previous.avatarKey) {
      await this.r2.deleteObject(previous.avatarKey);
    }
    return { avatarUpdatedAt: null };
  }

  /** Binar rasm. `select` global `omit` dan ustun turadi. */
  async readBranchAvatar(organizationId: string, branchId: string) {
    await this.getBranch(organizationId, branchId);
    return this.prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { avatar: true, avatarKey: true, avatarMimeType: true },
    });
  }

  async updateBranch(caller: TenantAuthenticatedUser, branchId: string, dto: UpdateBranchDto) {
    await this.getBranch(caller.organizationId, branchId);
    let updated;
    try {
      updated = await this.prisma.branch.update({
        where: { id: branchId },
        // Har bir maydon alohida: `data: dto` bilan spread qilish xavfli —
        // `defaultTuitionAmount`dagi `@Type(() => Number)` `null`ni `0`ga
        // aylantirib yuborishi mumkin edi, ya'ni maydonni tozalash o'rniga
        // uni "0 so'm"ga o'rnatib qo'yardi.
        data: {
          name: dto.name,
          address: dto.address,
          openTime: dto.openTime,
          closeTime: dto.closeTime,
          defaultTuitionAmount: dto.defaultTuitionAmount === null ? null : dto.defaultTuitionAmount,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom bilan filial allaqachon mavjud");
      }
      throw err;
    }
    await this.auditLog.logFromUser(caller, {
      action: "branch.update",
      entityType: "Branch",
      entityId: branchId,
      branchId,
      summary: `"${updated.name}" filiali ma'lumotlari tahrirlandi`,
    });
    return updated;
  }

  /** Filialni o'chirishdan oldin tasdiqlash oynasida nima yo'qolishini ko'rsatish uchun. */
  async getBranchDeletionSummary(organizationId: string, branchId: string) {
    await this.getBranch(organizationId, branchId);
    const where = { branchId };
    const [children, employees, users, groups, invoices, payments, branchCount] = await Promise.all([
      this.prisma.child.count({ where }),
      this.prisma.employee.count({ where }),
      this.prisma.tenantUser.count({ where }),
      this.prisma.group.count({ where }),
      this.prisma.invoice.count({ where }),
      this.prisma.payment.count({ where }),
      this.prisma.branch.count({ where: { organizationId } }),
    ]);
    return { children, employees, users, groups, invoices, payments, isLastBranch: branchCount <= 1 };
  }

  /**
   * Filialni BUTUNLAY o'chiradi: bolalar, xodimlar, filial kabinetlari,
   * guruhlar, davomat, moliya, Face ID va boshqa hamma filial yozuvlari.
   * Qaytarib bo'lmaydi — shuning uchun filial nomini aynan yozib tasdiqlash
   * shart va bog'chaning oxirgi filiali o'chirilmaydi.
   *
   * Filialga ishora qiluvchi barcha jadvallar `onDelete: Cascade`, faqat
   * she'r/maqol/ertakning `createdBy` (TenantUser) Restrict — kaskad
   * tartibida muallif ulardan oldin o'chsa xato beradi, shuning uchun ular
   * avval o'chiriladi. Faqat shu filialdagi bolalarga bog'langan ota-onalar
   * (boshqa filialda farzandi qolmasa) ham o'chadi, R2'dagi rasmlar esa
   * tranzaksiyadan keyin tozalanadi.
   */
  async removeBranch(caller: TenantAuthenticatedUser, branchId: string, confirmName: string) {
    const branch = await this.getBranch(caller.organizationId, branchId);
    if (confirmName.trim() !== branch.name.trim()) {
      throw new BadRequestException("Tasdiqlash uchun filial nomini aynan yozing");
    }
    const branchCount = await this.prisma.branch.count({ where: { organizationId: caller.organizationId } });
    if (branchCount <= 1) {
      throw new BadRequestException("Oxirgi filialni o'chirib bo'lmaydi — bog'chada kamida bitta filial qolishi kerak");
    }

    const where = { branchId };
    const [users, children, employees, menuPhotos, receipts, products, guardianLinks] = await Promise.all([
      this.prisma.tenantUser.findMany({ where, select: { avatarKey: true } }),
      this.prisma.child.findMany({ where, select: { avatarKey: true } }),
      this.prisma.employee.findMany({ where, select: { avatarKey: true } }),
      this.prisma.menuPhoto.findMany({ where, select: { imageKey: true } }),
      this.prisma.paymentReceipt.findMany({ where, select: { imageKey: true } }),
      this.prisma.product.findMany({ where, select: { image1Key: true, image2Key: true, image3Key: true } }),
      this.prisma.childGuardian.findMany({ where: { child: { branchId } }, select: { guardianId: true } }),
    ]);
    const r2Keys = [
      branch.avatarKey,
      ...users.map((u) => u.avatarKey),
      ...children.map((c) => c.avatarKey),
      ...employees.map((e) => e.avatarKey),
      ...menuPhotos.map((m) => m.imageKey),
      ...receipts.map((r) => r.imageKey),
      ...products.flatMap((p) => [p.image1Key, p.image2Key, p.image3Key]),
    ].filter((key): key is string => !!key);
    const guardianIds = [...new Set(guardianLinks.map((link) => link.guardianId))];

    await this.prisma.$transaction(
      async (tx) => {
        await tx.poem.deleteMany({ where });
        await tx.proverb.deleteMany({ where });
        await tx.tale.deleteMany({ where });
        await tx.branch.delete({ where: { id: branchId } });
        if (guardianIds.length > 0) {
          await tx.guardian.deleteMany({
            where: { id: { in: guardianIds }, organizationId: caller.organizationId, children: { none: {} } },
          });
        }
      },
      { timeout: 60_000 },
    );

    await this.auditLog.logFromUser(caller, {
      action: "branch.delete",
      entityType: "Branch",
      entityId: branchId,
      summary: `"${branch.name}" filiali o'chirildi (${children.length} bola, ${employees.length} xodim)`,
    });
    for (const key of r2Keys) {
      await this.r2.deleteObject(key);
    }
    return { id: branchId };
  }

  /**
   * Tashkilotni BUTUNLAY, qaytarib bo'lmaydigan tarzda o'chiradi — bu
   * soft-delete emas, `status`ni o'zgartirish emas: Organization qatori va
   * unga bog'liq HAMMA yozuv (filiallar, xodimlar, bolalar, moliya, coin,
   * darsliklar, "foydali" bo'limi, sog'liq, CRM, ota-ona/vasiy, HR/ish haqi,
   * bildirishnoma, obuna, hamyon) bazadan butunlay o'chiriladi.
   *
   * Har bir bog'liq jadval bitta tranzaksiyada, ENG CHUQUR (boshqa jadvalga
   * ishora qiluvchi) yozuvlardan boshlab, Organization qatorigacha aniq
   * tartibda o'chiriladi — shu tartib buzilsa, `schema.prisma`dagi FK
   * cheklovi (`onDelete` qanday sozlangan bo'lishidan qat'iy nazar) xatoga
   * olib keladi. Shuning uchun bu yerda hech qanday DB darajasidagi cascade
   * xatti-harakatiga tayanilmaydi — hamma narsa qo'lda, tartib bilan.
   *
   * DIQQAT: bu amal qaytarilmaydi. Nomni tasdiqlash kabi UX himoyasi
   * frontendda alohida qurilgan — bu yerda faqat `@Roles` orqali huquq
   * tekshiruvi bor.
   */
  async remove(id: string) {
    const target = await this.findOne(id);
    if (target.status !== "ARCHIVED") {
      throw new BadRequestException("Butunlay o'chirishdan oldin bog'chani arxivga oling");
    }

    await this.prisma.$transaction(
      async (tx) => {
        // 1) Darsliklar/HR/do'kon — o'zidan boshqa hech narsa ishora
        //    qilmaydigan eng chuqur yozuvlar.
        await tx.weeklyCoinAssessmentAnswer.deleteMany({
          where: { assessment: { organizationId: id } },
        });
        await tx.topicQuestion.deleteMany({ where: { topic: { branch: { organizationId: id } } } });
        await tx.parentQuestion.deleteMany({ where: { topic: { branch: { organizationId: id } } } });
        await tx.lessonGrade.deleteMany({ where: { branch: { organizationId: id } } });
        await tx.lessonTopic.deleteMany({ where: { branch: { organizationId: id } } });
        await tx.lessonSchedule.deleteMany({ where: { branch: { organizationId: id } } });
        await tx.employeeNotification.deleteMany({ where: { employee: { organizationId: id } } });
        await tx.groupTeacher.deleteMany({ where: { employee: { organizationId: id } } });
        await tx.employeeAttendance.deleteMany({ where: { employee: { organizationId: id } } });
        await tx.shift.deleteMany({ where: { employee: { organizationId: id } } });
        await tx.payrollEntry.deleteMany({ where: { employee: { organizationId: id } } });
        await tx.salaryScheme.deleteMany({ where: { employee: { organizationId: id } } });
        await tx.menuEntry.deleteMany({ where: { branch: { organizationId: id } } });
        await tx.productSale.deleteMany({ where: { product: { organizationId: id } } });
        await tx.product.deleteMany({ where: { organizationId: id } });

        // 2) Moliya: PaymentAllocation/LedgerEntry Invoice va Payment'ga
        //    ishora qiladi — ular avval o'chishi kerak.
        await tx.paymentAllocation.deleteMany({ where: { payment: { organizationId: id } } });
        await tx.ledgerEntry.deleteMany({ where: { organizationId: id } });

        // 3) Coin: davomat va haftalik baholash CoinTransaction'ga ishora
        //    qiladi (WeeklyCoinAssessment — majburiy, Attendance — ixtiyoriy).
        await tx.attendance.deleteMany({ where: { branch: { organizationId: id } } });
        await tx.weeklyCoinAssessment.deleteMany({ where: { organizationId: id } });
        await tx.coinTransaction.deleteMany({ where: { organizationId: id } });

        // 4) CRM (navbat) — LeadActivity avval, keyin Lead (u Child'ga
        //    ixtiyoriy ishora qiladi, shuning uchun Child'dan oldin o'chishi
        //    kerak).
        await tx.leadActivity.deleteMany({ where: { lead: { organizationId: id } } });
        await tx.lead.deleteMany({ where: { organizationId: id } });

        // 5) Ota-ona/vasiy.
        await tx.childGuardian.deleteMany({ where: { child: { organizationId: id } } });
        await tx.guardianRefreshToken.deleteMany({ where: { guardian: { organizationId: id } } });
        await tx.guardian.deleteMany({ where: { organizationId: id } });

        // 6) Endi Invoice/Payment xavfsiz o'chadi — ularga ishora qiluvchi
        //    yozuvlar allaqachon yo'q.
        await tx.invoice.deleteMany({ where: { organizationId: id } });
        await tx.payment.deleteMany({ where: { organizationId: id } });

        // 7) Sog'liq, kundalik hisobot/rivojlanish, bildirishnoma, "foydali"
        //    (she'r/maqol/ertak), audit, taomlar katalogi — bularning
        //    hech biriga boshqa hech narsa ishora qilmaydi.
        await tx.healthProfile.deleteMany({ where: { organizationId: id } });
        await tx.vaccination.deleteMany({ where: { organizationId: id } });
        await tx.medicationLog.deleteMany({ where: { organizationId: id } });
        await tx.dailyReport.deleteMany({ where: { organizationId: id } });
        await tx.developmentAssessment.deleteMany({ where: { organizationId: id } });
        await tx.notificationLog.deleteMany({ where: { organizationId: id } });
        await tx.poem.deleteMany({ where: { organizationId: id } });
        await tx.proverb.deleteMany({ where: { organizationId: id } });
        await tx.tale.deleteMany({ where: { organizationId: id } });
        await tx.auditLog.deleteMany({ where: { organizationId: id } });
        await tx.dish.deleteMany({ where: { organizationId: id } });

        // 8) Bola — yuqoridagi hamma narsa undan oldin o'chirilgani uchun
        //    endi xavfsiz.
        await tx.child.deleteMany({ where: { organizationId: id } });

        // 9) Guruh — Bola (ixtiyoriy), GroupTeacher, dars jadvali/mavzu/
        //    baho va "foydali" (ixtiyoriy groupId) allaqachon o'chirilgan.
        await tx.group.deleteMany({ where: { branch: { organizationId: id } } });

        // 10) Xodim — unga ishora qiluvchi barcha jadvallar yuqorida
        //     o'chirilgan.
        await tx.employee.deleteMany({ where: { organizationId: id } });

        // 11) Tashkilot bo'ylab katalog — boshqa hech narsa ularga ishora
        //     qilmaydi.
        await tx.position.deleteMany({ where: { organizationId: id } });
        await tx.subject.deleteMany({ where: { organizationId: id } });

        // 12) Xodim kabineti (TenantUser) — Employee.tenantUserId, Poem/
        //     Proverb/Tale.createdById va boshqa ixtiyoriy ishoralar
        //     allaqachon yo'q qilingan.
        await tx.webAuthnCredential.deleteMany({ where: { tenantUser: { organizationId: id } } });
        await tx.tenantRefreshToken.deleteMany({ where: { tenantUser: { organizationId: id } } });
        await tx.tenantUser.deleteMany({ where: { organizationId: id } });

        // 13) Filial — unga ishora qiluvchi hamma narsa yuqorida o'chirilgan.
        await tx.branch.deleteMany({ where: { organizationId: id } });

        // 14) Obuna va hamyon.
        await tx.walletTransaction.deleteMany({ where: { wallet: { organizationId: id } } });
        await tx.wallet.deleteMany({ where: { organizationId: id } });
        await tx.subscription.deleteMany({ where: { organizationId: id } });

        // 15) Tashkilotning o'zi — eng oxirida.
        await tx.organization.delete({ where: { id } });
      },
      { timeout: 30_000 },
    );

    return { id };
  }

  /**
   * Slug — bog'chaning subdomeni ham (babyland.zeeron.uz), shuning uchun
   * DNS'ga yaroqli, 40 belgigacha va xizmat nomlari (www, admin, api…) emas.
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    let base = slugify(name).slice(0, MAX_TENANT_SLUG_LENGTH - 4).replace(/-+$/, "") || "bogcha";
    if (!isValidTenantSlug(base)) base = `${base}-bogcha`;
    let candidate = base;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.organization.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }

  /** Bog'cha slug'i va panel sahifalari nomlari band (qarang: branch-slug.ts). */
  private async generateUniqueBranchSlug(
    organizationId: string,
    organizationSlug: string,
    name: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    let base = slugify(name);
    if (!isUsableBranchSlug(base, organizationSlug)) base = `${base}-filial`;
    let candidate = base;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await client.branch.findUnique({
        where: { organizationId_slug: { organizationId, slug: candidate } },
      });
      if (!existing && isUsableBranchSlug(candidate, organizationSlug)) return candidate;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }
}

const organizationInclude = {
  branches: { orderBy: { createdAt: "asc" as const } },
  subscription: { include: { plan: true } },
  wallet: true,
} satisfies Prisma.OrganizationInclude;
