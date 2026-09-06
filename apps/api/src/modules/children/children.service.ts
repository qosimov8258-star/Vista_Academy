import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireBranchScope } from "../iam/tenant-auth.types";
import { CreateChildDto } from "./dto/create-child.dto";
import { ChildQueryDto } from "./dto/child-query.dto";

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: TenantScope, dto: CreateChildDto) {
    const branchId = requireBranchScope(scope);
    if (dto.groupId) {
      await this.requireGroup(branchId, dto.groupId);
    }
    return this.prisma.child.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        groupId: dto.groupId,
        fullName: dto.fullName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });
  }

  async findAll(scope: TenantScope, query: ChildQueryDto) {
    const where: Prisma.ChildWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { fullName: { contains: query.search, mode: "insensitive" as Prisma.QueryMode } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.child.findMany({
        where,
        include: { group: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.child.count({ where }),
    ]);

    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  async findOne(scope: TenantScope, id: string) {
    const child = await this.prisma.child.findFirst({
      where: { id, organizationId: scope.organizationId },
      include: { group: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    return child;
  }

  countActive(scope: TenantScope) {
    return this.prisma.child.count({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? undefined, status: "ACTIVE" },
    });
  }

  private async requireGroup(branchId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({ where: { id: groupId, branchId } });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    return group;
  }
}
