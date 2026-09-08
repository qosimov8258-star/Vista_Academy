import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TenantUserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { CreateTenantUserDto, SuperAdminCreatableRole } from "./dto/create-tenant-user.dto";

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  branchId: true,
  isActive: true,
  createdAt: true,
  branch: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.TenantUserSelect;

@Injectable()
export class TenantUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(caller: TenantAuthenticatedUser, dto: CreateTenantUserDto) {
    const { role: targetRole, branchId } = await this.resolveTarget(caller, dto.branchId, dto.role);

    const passwordHash = await argon2.hash(dto.password);
    try {
      return await this.prisma.tenantUser.create({
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
  }

  findAll(caller: TenantAuthenticatedUser) {
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
