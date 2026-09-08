import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { AddChildGuardianDto } from "./dto/add-child-guardian.dto";
import { UpdateChildGuardianDto } from "./dto/update-child-guardian.dto";
import { GuardianQueryDto } from "./dto/guardian-query.dto";

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
    return this.prisma.childGuardian.findMany({
      where: { childId },
      include: { guardian: true },
      orderBy: { isPrimary: "desc" },
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
      const guardian = await this.prisma.guardian.create({
        data: { organizationId: child.organizationId, fullName: dto.fullName, phone: dto.phone },
      });
      guardianId = guardian.id;
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
