import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: TenantScope, dto: CreateEmployeeDto) {
    const branchId = requireOperationalScope(scope);
    return this.prisma.employee.create({
      data: { organizationId: scope.organizationId, branchId, fullName: dto.fullName, position: dto.position },
    });
  }

  findAll(scope: TenantScope, query: EmployeeQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
    };
    return this.prisma.employee.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  countActive(scope: TenantScope) {
    return this.prisma.employee.count({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? undefined, isActive: true },
    });
  }
}
