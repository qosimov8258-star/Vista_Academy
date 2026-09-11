import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TenantUserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreateTenantUserDto, SuperAdminCreatableRole } from "./dto/create-tenant-user.dto";
import { SetTenantUserStatusDto, UpdateTenantUserDto } from "./dto/update-tenant-user.dto";

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  branchId: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  branch: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.TenantUserSelect;

@Injectable()
export class TenantUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(caller: TenantAuthenticatedUser, dto: CreateTenantUserDto) {
    const { role: targetRole, branchId } = await this.resolveTarget(caller, dto.branchId, dto.role);

    const passwordHash = await argon2.hash(dto.password);
    let created;
    try {
      created = await this.prisma.tenantUser.create({
        data: {
          organizationId: caller.organizationId,
          branchId,
          email: dto.email.toLowerCase(),
          passwordHash,
          fullName: dto.fullName,
          role: targetRole,
        },
        select: SAFE_SELECT,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu email bilan foydalanuvchi allaqachon mavjud");
      }
      throw err;
    }
    await this.auditLog.logFromUser(caller, {
      action: "user.create",
      entityType: "TenantUser",
      entityId: created.id,
      branchId,
      summary: `${created.fullName} (${created.email}) uchun ${targetRole} huquqi bilan hisob yaratildi`,
    });
    return created;
  }

  findAll(caller: TenantAuthenticatedUser) {
    // Loginlar ro'yxati boshqaruv ishi. UI da o'qituvchiga bu bo'lim
    // ko'rinmaydi, lekin so'rov to'g'ridan-to'g'ri ham yuborilishi mumkin.
    if (caller.role !== "NETWORK_ADMIN" && caller.role !== "BRANCH_ADMIN") {
      throw new ForbiddenException("Sizda foydalanuvchilar ro'yxatini ko'rish huquqi yo'q");
    }
    const where: Prisma.TenantUserWhereInput = {
      organizationId: caller.organizationId,
      ...(caller.role === "NETWORK_ADMIN" ? {} : { branchId: caller.branchId }),
    };
    return this.prisma.tenantUser.findMany({
      where,
      select: SAFE_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Ism, rol yoki parolni o'zgartirish. Bo'sh maydonlar tegilmaydi. */
  async update(caller: TenantAuthenticatedUser, id: string, dto: UpdateTenantUserDto) {
    const target = await this.assertManageable(caller, id);

    if (dto.role && dto.role !== target.role) {
      if (caller.role !== "NETWORK_ADMIN") {
        throw new ForbiddenException("Rolni faqat Super Admin o'zgartira oladi");
      }
      // O'qituvchining login roli xodim kartochkasi va guruh biriktiruviga
      // bog'langan — uni bu yerdan filial adminiga aylantirish guruhlarni
      // yetim qoldiradi. Shuning uchun faqat admin/moliyachi orasida.
      if (target.role !== "BRANCH_ADMIN" && target.role !== "FINANCE") {
        throw new ForbiddenException("Bu xodimning rolini bu yerdan o'zgartirib bo'lmaydi");
      }
    }

    const data: Prisma.TenantUserUpdateInput = {};
    if (dto.fullName) data.fullName = dto.fullName;
    if (dto.role && caller.role === "NETWORK_ADMIN") data.role = dto.role;
    if (dto.password) data.passwordHash = await argon2.hash(dto.password);

    const updated = await this.prisma.tenantUser.update({ where: { id }, data, select: SAFE_SELECT });

    // Parol almashtirilgan bo'lsa eski seanslar ochiq qolmasin
    if (dto.password) {
      await this.revokeSessions(id);
    }

    const changes = [
      dto.fullName ? "ism" : null,
      dto.role && caller.role === "NETWORK_ADMIN" ? `rol -> ${dto.role}` : null,
      dto.password ? "parol" : null,
    ].filter(Boolean);
    await this.auditLog.logFromUser(caller, {
      action: "user.update",
      entityType: "TenantUser",
      entityId: id,
      branchId: target.branchId,
      summary: `${updated.fullName} hisobi tahrirlandi (${changes.join(", ") || "o'zgarishsiz"})`,
    });
    return updated;
  }

  /**
   * Hisobni bloklash / blokdan chiqarish. Bloklash darhol kuchga kiradi:
   * tenant-jwt strategiyasi har bir so'rovda `isActive` ni tekshiradi,
   * shuning uchun qo'lidagi amaldagi token ham ishlamay qoladi.
   */
  async setStatus(caller: TenantAuthenticatedUser, id: string, dto: SetTenantUserStatusDto) {
    const target = await this.assertManageable(caller, id);
    const updated = await this.prisma.tenantUser.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: SAFE_SELECT,
    });
    if (!dto.isActive) {
      await this.revokeSessions(id);
    }
    await this.auditLog.logFromUser(caller, {
      action: dto.isActive ? "user.activate" : "user.block",
      entityType: "TenantUser",
      entityId: id,
      branchId: target.branchId,
      summary: `${updated.fullName} hisobi ${dto.isActive ? "blokdan chiqarildi" : "bloklandi"}`,
    });
    return updated;
  }

  /**
   * Loginni o'chirish. Xodim kartochkasi (Employee) o'chmaydi — bog'lanish
   * `onDelete: SetNull`, ya'ni xodim ro'yxatda qoladi, faqat kabinetsiz.
   */
  async remove(caller: TenantAuthenticatedUser, id: string) {
    const target = await this.assertManageable(caller, id);
    const deleted = await this.prisma.tenantUser.delete({ where: { id }, select: SAFE_SELECT });
    await this.auditLog.logFromUser(caller, {
      action: "user.delete",
      entityType: "TenantUser",
      entityId: id,
      branchId: target.branchId,
      summary: `${deleted.fullName} (${deleted.email}) hisobi o'chirildi`,
    });
    return { id };
  }

  /**
   * Chaqiruvchi shu hisobni boshqara oladimi.
   *
   * Qoidalar:
   *  - o'z hisobini bu yerdan o'zgartirib bo'lmaydi (Sozlamalar bo'limi bor);
   *  - Super Admin boshqa Super Adminga tegmaydi — aks holda tashkilot
   *    egasini bloklab, hech kim kira olmaydigan holatga tushib qolish mumkin;
   *  - filial admini faqat o'z filialidagi administrator va o'qituvchini.
   */
  private async assertManageable(caller: TenantAuthenticatedUser, id: string) {
    if (id === caller.id) {
      throw new ForbiddenException("O'z hisobingizni bu yerdan o'zgartirib bo'lmaydi — Sozlamalar bo'limidan foydalaning");
    }
    const target = await this.prisma.tenantUser.findFirst({
      where: { id, organizationId: caller.organizationId },
      select: { id: true, role: true, branchId: true },
    });
    if (!target) {
      throw new NotFoundException("Xodim topilmadi");
    }

    if (caller.role === "NETWORK_ADMIN") {
      if (target.role === "NETWORK_ADMIN") {
        throw new ForbiddenException("Boshqa Super Admin hisobiga tegib bo'lmaydi");
      }
      return target;
    }

    if (caller.role === "BRANCH_ADMIN") {
      if (!caller.branchId || target.branchId !== caller.branchId) {
        throw new ForbiddenException("Bu xodim sizning filialingizda emas");
      }
      if (target.role !== "MANAGER" && target.role !== "TEACHER") {
        throw new ForbiddenException("Bu xodimni boshqarish huquqingiz yo'q");
      }
      return target;
    }

    throw new ForbiddenException("Sizda xodimlarni boshqarish huquqi yo'q");
  }

  /** Barcha ochiq seanslarni yopadi — parol almashganda va bloklaganda. */
  private revokeSessions(tenantUserId: string) {
    return this.prisma.tenantRefreshToken.updateMany({
      where: { tenantUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Yaratiladigan rol hech qachon so'rovdan to'g'ridan-to'g'ri olinmaydi —
   * u chaqiruvchining roli bilan cheklanadi:
   *   Super Admin -> filial admini yoki moliyachi (istalgan filialga),
   *   Filial admini -> administrator (faqat o'z filialiga).
   * Moliyachi va administrator umuman foydalanuvchi yarata olmaydi.
   */
  private async resolveTarget(
    caller: TenantAuthenticatedUser,
    requestedBranchId: string,
    requestedRole: SuperAdminCreatableRole | undefined,
  ): Promise<{ role: TenantUserRole; branchId: string }> {
    if (caller.role === "NETWORK_ADMIN") {
      const branch = await this.prisma.branch.findFirst({
        where: { id: requestedBranchId, organizationId: caller.organizationId },
      });
      if (!branch) {
        throw new NotFoundException("Filial topilmadi");
      }
      return { role: requestedRole ?? "BRANCH_ADMIN", branchId: branch.id };
    }

    if (caller.role === "BRANCH_ADMIN") {
      if (!caller.branchId) {
        throw new ForbiddenException("Filialga biriktirilmagansiz");
      }
      return { role: "MANAGER", branchId: caller.branchId };
    }

    throw new ForbiddenException("Sizda foydalanuvchi yaratish huquqi yo'q");
  }
}
