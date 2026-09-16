import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
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

/** Rasm brauzerda 256x256 gacha kichraytirilgani uchun bundan oshmasligi kerak. */
const MAX_BRANCH_AVATAR_BYTES = 300 * 1024;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly jwt: JwtService,
  ) {}

  async create(dto: CreateOrganizationDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new BadRequestException("Tanlangan tarif reja topilmadi");
    }

    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
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
          slug: await this.generateUniqueBranchSlug(organization.id, firstBranchName, tx),
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
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      return tx.organization.findUniqueOrThrow({
        where: { id: organization.id },
        include: organizationInclude,
      });
    });
  }

  async findAll(query: OrganizationQueryDto) {
    const where: Prisma.OrganizationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as Prisma.QueryMode } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        include: organizationInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: items,
      meta: { page: query.page, limit: query.limit, total },
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
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: dto,
      include: organizationInclude,
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
    await this.findOne(organizationId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({
          data: {
            organizationId,
            name: dto.name,
            address: dto.address,
            slug: await this.generateUniqueBranchSlug(organizationId, dto.name, tx),
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
    await this.getBranch(organizationId, branchId);
    const [header, base64] = dto.image.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");

    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_BRANCH_AVATAR_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }

    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: { avatar: buffer, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
      select: { avatarUpdatedAt: true },
    });
    return { avatarUpdatedAt: updated.avatarUpdatedAt };
  }

  async removeBranchAvatar(organizationId: string, branchId: string) {
    await this.getBranch(organizationId, branchId);
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { avatar: null, avatarMimeType: null, avatarUpdatedAt: null },
    });
    return { avatarUpdatedAt: null };
  }

  /** Binar rasm. `select` global `omit` dan ustun turadi. */
  async readBranchAvatar(organizationId: string, branchId: string) {
    await this.getBranch(organizationId, branchId);
    return this.prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { avatar: true, avatarMimeType: true },
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
    await this.findOne(id);

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

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
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

  private async generateUniqueBranchSlug(
    organizationId: string,
    name: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await client.branch.findUnique({
        where: { organizationId_slug: { organizationId, slug: candidate } },
      });
      if (!existing) return candidate;
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
