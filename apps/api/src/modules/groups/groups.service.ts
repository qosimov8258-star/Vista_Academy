import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateGroupDto } from "./dto/create-group.dto";
import { GroupQueryDto } from "./dto/group-query.dto";

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: TenantScope, dto: CreateGroupDto) {
    const branchId = requireOperationalScope(scope);
    try {
      return await this.prisma.group.create({
        data: { branchId, name: dto.name, capacity: dto.capacity },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom bilan guruh allaqachon mavjud");
      }
      throw err;
    }
  }

  findAll(scope: TenantScope, query: GroupQueryDto) {
    const where: Prisma.GroupWhereInput = {
      branch: { organizationId: scope.organizationId },
      branchId: scope.branchId ?? query.branchId,
    };
    return this.prisma.group.findMany({
      where,
      include: { _count: { select: { children: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(scope: TenantScope, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, branch: { organizationId: scope.organizationId } },
      include: { _count: { select: { children: true } } },
    });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    if (scope.branchId && group.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu guruhga kirish huquqingiz yo'q");
    }
    return group;
  }

  countActive(scope: TenantScope) {
    return this.prisma.group.count({
      where: {
        branch: { organizationId: scope.organizationId },
        branchId: scope.branchId ?? undefined,
        status: "ACTIVE",
      },
    });
  }
}
