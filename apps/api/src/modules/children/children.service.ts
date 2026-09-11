import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild, resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";
import { ChildQueryDto } from "./dto/child-query.dto";
import { UpdateChildAvatarDto } from "./dto/update-child-avatar.dto";
import { createChildWithGuardian, withPublicIdRetry, composeChildFullName } from "./child-creation";

/** Ro'yxatda ota-ona telefoni ko'rinishi uchun asosiy vasiy ham olinadi. */
const childInclude = {
  group: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  guardians: {
    orderBy: { isPrimary: "desc" as const },
    include: { guardian: { select: { id: true, fullName: true, phone: true } } },
  },
} satisfies Prisma.ChildInclude;

/** 512px JPEG shu hajmdan oshmasligi kerak. */
const MAX_CHILD_AVATAR_BYTES = 600 * 1024;

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(caller: TenantAuthenticatedUser, dto: CreateChildDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    if (dto.groupId) {
      await this.requireGroup(branchId, dto.groupId);
    }

    const created = await withPublicIdRetry(() =>
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
    await this.auditLog.logFromUser(caller, {
      action: "child.create",
      entityType: "Child",
      entityId: created.id,
      branchId,
      summary: `${created.fullName} ro'yxatga olindi`,
    });
    return created;
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

  /**
   * Bola ma'lumotlarini tahrirlash: ism, jins, tug'ilgan sana, guruh, holat
   * (faol/nofaol). Karantin bu yerdan qo'yilmaydi — alohida endpoint bor.
   */
  async update(caller: TenantAuthenticatedUser, id: string, dto: UpdateChildDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const existing = await this.prisma.child.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: { id: true, branchId: true, groupId: true, firstName: true, lastName: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (existing.branchId !== branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsChild(this.prisma, scope, existing);

    // Faqat guruh haqiqatan almashtirilayotganda tekshiramiz — aks holda
    // bola allaqachon (boshqa sababdan) nofaol guruhda bo'lsa, uni boshqa
    // maydonlar bo'yicha tahrirlash imkoni yo'qolib qolardi.
    if (dto.groupId && dto.groupId !== existing.groupId) {
      await this.requireGroup(branchId, dto.groupId);
    }
    if (dto.status && existing.status === "QUARANTINED") {
      throw new BadRequestException("Karantindagi bolaning holatini avval karantinni yopib, keyin o'zgartiring");
    }

    const firstName = dto.firstName ?? existing.firstName;
    const lastName = dto.lastName ?? existing.lastName;

    const updated = await this.prisma.child.update({
      where: { id },
      data: {
        firstName,
        lastName,
        fullName: composeChildFullName(lastName, firstName),
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        groupId: dto.groupId === undefined ? undefined : dto.groupId,
        status: dto.status,
      },
      include: childInclude,
    });
    await this.auditLog.logFromUser(caller, {
      action: "child.update",
      entityType: "Child",
      entityId: updated.id,
      branchId,
      summary: `${updated.fullName} ma'lumotlari tahrirlandi`,
    });
    return updated;
  }

  /**
   * Bola suratini saqlaydi. Rasm brauzerda kvadrat qilib kesilib, 512px ga
   * kichraytirilgan holda keladi — server faqat hajmini tekshiradi.
   *
   * Yozish huquqi bolani tahrirlash bilan bir xil: filial xodimlari qo'yadi,
   * Super Admin faqat ko'radi (requireOperationalScope filialsiz rolni rad
   * etadi), o'qituvchi esa faqat o'z guruhidagi bolaga.
   */
  async updateAvatar(scope: TenantScope, id: string, dto: UpdateChildAvatarDto) {
    const child = await this.requireWritableChild(scope, id);

    const [header, base64] = dto.image.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_CHILD_AVATAR_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }

    const updated = await this.prisma.child.update({
      where: { id: child.id },
      data: { avatar: buffer, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
      select: { avatarUpdatedAt: true },
    });
    return { avatarUpdatedAt: updated.avatarUpdatedAt };
  }

  async removeAvatar(scope: TenantScope, id: string) {
    const child = await this.requireWritableChild(scope, id);
    await this.prisma.child.update({
      where: { id: child.id },
      data: { avatar: null, avatarMimeType: null, avatarUpdatedAt: null },
    });
    return { avatarUpdatedAt: null };
  }

  /** Binar surat. Ko'rish huquqi `findOne` bilan bir xil. */
  async readAvatar(scope: TenantScope, id: string) {
    await this.findOne(scope, id);
    return this.prisma.child.findUniqueOrThrow({
      where: { id },
      select: { avatar: true, avatarMimeType: true },
    });
  }

  /** Yozish uchun: bola shu tashkilot/filialda va o'qituvchining guruhida. */
  private async requireWritableChild(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const child = await this.prisma.child.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: { id: true, branchId: true, groupId: true },
    });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
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
    if (group.status !== "ACTIVE") {
      throw new BadRequestException("Bu guruh nofaol — bolani faol guruhga biriktiring");
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
