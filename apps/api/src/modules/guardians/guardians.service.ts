import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { AddChildGuardianDto } from "./dto/add-child-guardian.dto";
import { UpdateChildGuardianDto } from "./dto/update-child-guardian.dto";
import { GuardianQueryDto } from "./dto/guardian-query.dto";
import { generateParentPassword, normalizePhone } from "../parent/parent-auth.service";
import * as argon2 from "argon2";

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireChild(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    return child;
  }

  async search(scope: TenantScope, query: GuardianQueryDto) {
    const where: Prisma.GuardianWhereInput = {
      organizationId: scope.organizationId,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" as Prisma.QueryMode } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };
    return this.prisma.guardian.findMany({ where, orderBy: { fullName: "asc" }, take: 20 });
  }

  async listForChild(scope: TenantScope, childId: string) {
    await this.requireChild(scope, childId);
    const links = await this.prisma.childGuardian.findMany({
      where: { childId },
      include: {
        guardian: {
          select: {
            id: true,
            organizationId: true,
            fullName: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            // Parol xeshi tashqariga chiqmaydi — faqat bor-yo'qligi kerak
            passwordHash: true,
          },
        },
      },
      orderBy: { isPrimary: "desc" },
    });

    return links.map(({ guardian, ...link }) => {
      const { passwordHash, ...safeGuardian } = guardian;
      return {
        ...link,
        guardian: {
          ...safeGuardian,
          /** Kabinet ochilganmi — paroli bormi degani. */
          hasCabinet: passwordHash !== null && guardian.isActive,
        },
      };
    });
  }

  async addToChild(scope: TenantScope, childId: string, dto: AddChildGuardianDto) {
    requireOperationalScope(scope);
    const child = await this.requireChild(scope, childId);

    let guardianId = dto.guardianId;
    if (!guardianId) {
      if (!dto.fullName || !dto.phone) {
        throw new BadRequestException("guardianId yoki (fullName va phone) kiritilishi shart");
      }
      // Telefon raqami vasiyning logini bo'lgani uchun tashkilot ichida
      // unikal. Shu raqam allaqachon ro'yxatda bo'lsa — bu o'sha odam:
      // yangisini yaratish o'rniga mavjudini bolaga biriktiramiz. Aks holda
      // baza cheklovi buzilib, xom Prisma xatosi chiqardi.
      const phone = normalizePhone(dto.phone);
      const existing = await this.prisma.guardian.findUnique({
        where: { organizationId_phone: { organizationId: child.organizationId, phone } },
      });
      if (existing) {
        guardianId = existing.id;
      } else {
        const guardian = await this.prisma.guardian.create({
          data: { organizationId: child.organizationId, fullName: dto.fullName, phone },
        });
        guardianId = guardian.id;
      }
    } else {
      const existing = await this.prisma.guardian.findFirst({ where: { id: guardianId, organizationId: child.organizationId } });
      if (!existing) {
        throw new NotFoundException("Guardian topilmadi");
      }
    }

    try {
      return await this.prisma.childGuardian.create({
        data: {
          childId,
          guardianId,
          relation: dto.relation,
          isPrimary: dto.isPrimary,
          canPickup: dto.canPickup,
          canViewFinance: dto.canViewFinance,
          canReceiveNotifications: dto.canReceiveNotifications,
        },
        include: { guardian: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestException("Bu guardian allaqachon shu bolaga biriktirilgan");
      }
      throw err;
    }
  }

  async updateLink(scope: TenantScope, linkId: string, dto: UpdateChildGuardianDto) {
    requireOperationalScope(scope);
    const link = await this.prisma.childGuardian.findFirst({
      where: { id: linkId },
      include: { child: true },
    });
    if (!link || link.child.organizationId !== scope.organizationId) {
      throw new NotFoundException("Yozuv topilmadi");
    }
    if (scope.branchId && link.child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu yozuvga kirish huquqingiz yo'q");
    }
    return this.prisma.childGuardian.update({
      where: { id: linkId },
      data: dto,
      include: { guardian: true },
    });
  }

  /**
   * Ota-ona kabinetini ochadi yoki parolini yangilaydi.
   *
   * Login — vasiyning telefon raqami, parol esa tasodifiy yaratiladi va
   * javobda BIR MARTA qaytariladi: bazada faqat xesh saqlanadi, shuning
   * uchun keyin uni ko'rsatib bo'lmaydi — faqat yangisini yaratish mumkin.
   */
  async openCabinet(scope: TenantScope, guardianId: string) {
    const guardian = await this.requireManageableGuardian(scope, guardianId);
    const password = generateParentPassword();
    const passwordHash = await argon2.hash(password);

    await this.prisma.$transaction([
      this.prisma.guardian.update({
        where: { id: guardian.id },
        // Raqam yagona ko'rinishga keltiriladi: ota-ona uni qanday
        // yozishidan qat'i nazar login topilsin.
        data: { passwordHash, isActive: true, phone: normalizePhone(guardian.phone) },
      }),
      // Parol almashsa eski seanslar yopiladi
      this.prisma.guardianRefreshToken.updateMany({
        where: { guardianId: guardian.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      guardianId: guardian.id,
      fullName: guardian.fullName,
      login: normalizePhone(guardian.phone),
      password,
    };
  }

  /** Kabinetni yopadi: parol olib tashlanadi va ochiq seanslar bekor qilinadi. */
  async closeCabinet(scope: TenantScope, guardianId: string) {
    const guardian = await this.requireManageableGuardian(scope, guardianId);
    await this.prisma.$transaction([
      this.prisma.guardian.update({
        where: { id: guardian.id },
        data: { passwordHash: null, isActive: false },
      }),
      this.prisma.guardianRefreshToken.updateMany({
        where: { guardianId: guardian.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { guardianId: guardian.id, hasCabinet: false };
  }

  /**
   * Vasiy shu tashkilotda va xodimning filialidagi bolaga biriktirilganmi.
   * Aks holda boshqa filialning ota-onasiga kabinet ochib yuborish mumkin edi.
   */
  private async requireManageableGuardian(scope: TenantScope, guardianId: string) {
    const branchId = requireOperationalScope(scope);
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        id: guardianId,
        organizationId: scope.organizationId,
        children: { some: { child: { branchId } } },
      },
      select: { id: true, fullName: true, phone: true },
    });
    if (!guardian) {
      throw new NotFoundException("Ota-ona topilmadi");
    }
    return guardian;
  }

  async removeLink(scope: TenantScope, linkId: string) {
    requireOperationalScope(scope);
    const link = await this.prisma.childGuardian.findFirst({
      where: { id: linkId },
      include: { child: true },
    });
    if (!link || link.child.organizationId !== scope.organizationId) {
      throw new NotFoundException("Yozuv topilmadi");
    }
    if (scope.branchId && link.child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu yozuvga kirish huquqingiz yo'q");
    }
    await this.prisma.childGuardian.delete({ where: { id: linkId } });
    return { removed: true };
  }
}
