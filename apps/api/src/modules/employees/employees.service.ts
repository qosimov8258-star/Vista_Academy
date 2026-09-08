import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateEmployeeDto, EmployeeAccountDto } from "./dto/create-employee.dto";
import { UpdateEmployeeGroupsDto } from "./dto/update-employee-groups.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";

/** Ro'yxatda kabinet holati va biriktirilgan guruhlar ham ko'rinadi. */
const employeeInclude = {
  tenantUser: { select: { id: true, email: true, role: true, isActive: true } },
  teachingGroups: { include: { group: { select: { id: true, name: true } } } },
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: TenantScope, dto: CreateEmployeeDto) {
    const branchId = requireOperationalScope(scope);

    if (!dto.account) {
      return this.prisma.employee.create({
        data: { organizationId: scope.organizationId, branchId, fullName: dto.fullName, position: dto.position },
        include: employeeInclude,
      });
    }

    await this.assertGroupsBelongToBranch(branchId, dto.account.groupIds);
    const passwordHash = await argon2.hash(dto.account.password);

    // Xodim, uning logini va guruh biriktiruvi bitta tranzaksiyada — yarim
    // yaratilgan kabinet (login bor, guruhi yo'q) qolib ketmasligi kerak.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenantUser = await tx.tenantUser.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            email: dto.account!.email.toLowerCase(),
            passwordHash,
            fullName: dto.fullName,
            role: "TEACHER",
          },
        });
        return tx.employee.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            fullName: dto.fullName,
            position: dto.position,
            tenantUserId: tenantUser.id,
            teachingGroups: { create: dto.account!.groupIds.map((groupId) => ({ groupId })) },
          },
          include: employeeInclude,
        });
      });
    } catch (err) {
      throw this.translateEmailConflict(err);
    }
  }

  findAll(scope: TenantScope, query: EmployeeQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
    };
    return this.prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Tarbiyachining guruhlarini almashtiradi (qo'shish/olib tashlash bitta amalda). */
  async updateGroups(scope: TenantScope, employeeId: string, dto: UpdateEmployeeGroupsDto) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: scope.organizationId, branchId },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    await this.assertGroupsBelongToBranch(branchId, dto.groupIds);

    return this.prisma.$transaction(async (tx) => {
      await tx.groupTeacher.deleteMany({ where: { employeeId } });
      if (dto.groupIds.length > 0) {
        await tx.groupTeacher.createMany({
          data: dto.groupIds.map((groupId) => ({ groupId, employeeId })),
        });
      }
      return tx.employee.findUniqueOrThrow({ where: { id: employeeId }, include: employeeInclude });
    });
  }

  /** Kabineti bo'lmagan xodimga keyinchalik login ochish. */
  async openAccount(scope: TenantScope, employeeId: string, dto: EmployeeAccountDto) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: scope.organizationId, branchId },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (employee.tenantUserId) {
      throw new ConflictException("Bu xodimning kabineti allaqachon ochilgan");
    }
    await this.assertGroupsBelongToBranch(branchId, dto.groupIds);
    const passwordHash = await argon2.hash(dto.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenantUser = await tx.tenantUser.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            email: dto.email.toLowerCase(),
            passwordHash,
            fullName: employee.fullName,
            role: "TEACHER",
          },
        });
        await tx.groupTeacher.deleteMany({ where: { employeeId } });
        await tx.groupTeacher.createMany({
          data: dto.groupIds.map((groupId) => ({ groupId, employeeId })),
        });
        return tx.employee.update({
          where: { id: employeeId },
          data: { tenantUserId: tenantUser.id },
          include: employeeInclude,
        });
      });
    } catch (err) {
      throw this.translateEmailConflict(err);
    }
  }

  async countActive(scope: TenantScope) {
    return this.prisma.employee.count({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? undefined, isActive: true },
    });
  }

  /**
   * Guruhlar shu filialga tegishli ekanini tekshiradi — boshqa filialning
   * guruhini biriktirib, o'qituvchini o'zga filialga kirgizib yubormaslik uchun.
   */
  private async assertGroupsBelongToBranch(branchId: string, groupIds: string[]) {
    if (groupIds.length === 0) {
      return;
    }
    const found = await this.prisma.group.count({ where: { id: { in: groupIds }, branchId } });
    if (found !== new Set(groupIds).size) {
      throw new NotFoundException("Guruhlardan biri bu filialda topilmadi");
    }
  }

  private translateEmailConflict(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException("Bu email bilan foydalanuvchi allaqachon mavjud");
    }
    return err;
  }
}
