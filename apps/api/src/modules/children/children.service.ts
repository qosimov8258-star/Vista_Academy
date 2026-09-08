import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild, resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { CreateChildDto } from "./dto/create-child.dto";
import { ChildQueryDto } from "./dto/child-query.dto";
import { createChildWithGuardian, withPublicIdRetry } from "./child-creation";

/** Ro'yxatda ota-ona telefoni ko'rinishi uchun asosiy vasiy ham olinadi. */
const childInclude = {
  group: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  guardians: {
    orderBy: { isPrimary: "desc" as const },
    include: { guardian: { select: { id: true, fullName: true, phone: true } } },
  },
} satisfies Prisma.ChildInclude;

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: TenantScope, dto: CreateChildDto) {
    const branchId = requireOperationalScope(scope);
    if (dto.groupId) {
      await this.requireGroup(branchId, dto.groupId);
    }

    return withPublicIdRetry(() =>
      this.prisma.$transaction((tx) =>
        createChildWithGuardian(
          tx,
          {
            organizationId: scope.organizationId,
            branchId,
            groupId: dto.groupId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            gender: dto.gender,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            guardian: {
              fullName: dto.guardianFullName,
              phone: dto.guardianPhone,
              relation: dto.guardianRelation,
            },
          },
          childInclude,
        ),
      ),
    );
  }

  async findAll(scope: TenantScope, query: ChildQueryDto) {
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const where: Prisma.ChildWhereInput = teacherChildWhere({
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: searchFilters(query.search) } : {}),
    }, teacherGroupIds);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.child.findMany({
        where,
        include: childInclude,
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
      include: childInclude,
    });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);
    return child;
  }

  async countActive(scope: TenantScope) {
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    return this.prisma.child.count({
      where: teacherChildWhere(
        {
          organizationId: scope.organizationId,
          branchId: scope.branchId ?? undefined,
          status: "ACTIVE",
        },
        teacherGroupIds,
      ),
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

/**
 * Qidiruv ism bo'yicha ham, ID bo'yicha ham ishlaydi — ota-ona telefonda
 * "id12345" deb aytadi, xodim esa o'shani qidiruvga kiritadi.
 */
function searchFilters(search: string): Prisma.ChildWhereInput[] {
  const filters: Prisma.ChildWhereInput[] = [
    { fullName: { contains: search, mode: "insensitive" } },
    { guardians: { some: { guardian: { fullName: { contains: search, mode: "insensitive" } } } } },
  ];

  const digits = search.replace(/^id/i, "").trim();
  if (/^\d{1,5}$/.test(digits)) {
    filters.push({ publicId: Number(digits) });
  }

  return filters;
}
