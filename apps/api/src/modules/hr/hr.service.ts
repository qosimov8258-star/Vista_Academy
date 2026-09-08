import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireMoneyScope } from "../iam/tenant-auth.types";
import { UpsertSalarySchemeDto } from "./dto/upsert-salary-scheme.dto";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { ShiftQueryDto } from "./dto/shift-query.dto";
import { GeneratePayrollDto } from "./dto/generate-payroll.dto";
import { PayrollQueryDto } from "./dto/payroll-query.dto";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodRange(period: string): { start: Date; end: Date } {
  const [year, month] = period.split("-").map(Number);
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireEmployee(scope: TenantScope, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, organizationId: scope.organizationId } });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (scope.branchId && employee.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu xodimga kirish huquqingiz yo'q");
    }
    return employee;
  }

  async getSalaryScheme(scope: TenantScope, employeeId: string) {
    await this.requireEmployee(scope, employeeId);
    return this.prisma.salaryScheme.findUnique({ where: { employeeId } });
  }

  async upsertSalaryScheme(scope: TenantScope, employeeId: string, dto: UpsertSalarySchemeDto) {
    requireMoneyScope(scope);
    await this.requireEmployee(scope, employeeId);
    return this.prisma.salaryScheme.upsert({
      where: { employeeId },
      create: { employeeId, ruleType: dto.ruleType, fixedAmount: dto.fixedAmount ?? 0, rate: dto.rate ?? 0 },
      update: { ruleType: dto.ruleType, fixedAmount: dto.fixedAmount ?? 0, rate: dto.rate ?? 0 },
    });
  }

  async createShift(scope: TenantScope, dto: CreateShiftDto) {
    const branchId = requireMoneyScope(scope);
    const employee = await this.requireEmployee(scope, dto.employeeId);
    const date = new Date(`${dto.date}T00:00:00.000Z`);
    return this.prisma.shift.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: { employeeId: employee.id, branchId, date, hours: dto.hours, note: dto.note },
      update: { hours: dto.hours, note: dto.note },
    });
  }

  async listShifts(scope: TenantScope, query: ShiftQueryDto) {
    const period = query.period ?? currentPeriod();
    const { start, end } = periodRange(period);
    const where: Prisma.ShiftWhereInput = {
      branch: { organizationId: scope.organizationId },
      branchId: scope.branchId ?? query.branchId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      date: { gte: start, lt: end },
    };
    return this.prisma.shift.findMany({
      where,
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { date: "desc" },
    });
  }

  async generatePayroll(scope: TenantScope, dto: GeneratePayrollDto) {
    const branchId = requireMoneyScope(scope);
    const employee = await this.requireEmployee(scope, dto.employeeId);
    const scheme = await this.prisma.salaryScheme.findUnique({ where: { employeeId: dto.employeeId } });
    if (!scheme) {
      throw new NotFoundException("Xodim uchun maosh sxemasi belgilanmagan");
    }

    let baseAmount = 0;
    if (scheme.ruleType === "FIXED") {
      baseAmount = Number(scheme.fixedAmount);
    } else if (scheme.ruleType === "PER_HOUR") {
      const { start, end } = periodRange(dto.period);
      const shifts = await this.prisma.shift.aggregate({
        where: { employeeId: dto.employeeId, date: { gte: start, lt: end } },
        _sum: { hours: true },
      });
      baseAmount = Number(scheme.rate) * Number(shifts._sum.hours ?? 0);
    } else if (scheme.ruleType === "PER_CHILD") {
      const childrenCount = await this.prisma.child.count({ where: { branchId: employee.branchId, status: "ACTIVE" } });
      baseAmount = Number(scheme.rate) * childrenCount;
    }

    const bonusAmount = dto.bonusAmount ?? 0;
    const penaltyAmount = dto.penaltyAmount ?? 0;
    const totalAmount = baseAmount + bonusAmount - penaltyAmount;

    return this.prisma.payrollEntry.upsert({
      where: { employeeId_period: { employeeId: dto.employeeId, period: dto.period } },
      create: {
        employeeId: dto.employeeId,
        branchId,
        period: dto.period,
        baseAmount,
        bonusAmount,
        penaltyAmount,
        totalAmount,
        note: dto.note,
      },
      update: { baseAmount, bonusAmount, penaltyAmount, totalAmount, note: dto.note },
    });
  }

  async markPayrollPaid(scope: TenantScope, id: string) {
    const branchId = requireMoneyScope(scope);
    const entry = await this.prisma.payrollEntry.findFirst({ where: { id } });
    if (!entry || entry.branchId !== branchId) {
      throw new NotFoundException("Payroll yozuvi topilmadi");
    }
    return this.prisma.payrollEntry.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
  }

  async listPayroll(scope: TenantScope, query: PayrollQueryDto) {
    const where: Prisma.PayrollEntryWhereInput = {
      branch: { organizationId: scope.organizationId },
      branchId: scope.branchId ?? query.branchId,
      ...(query.period ? { period: query.period } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payrollEntry.findMany({
        where,
        include: { employee: { select: { id: true, fullName: true, position: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payrollEntry.count({ where }),
    ]);
    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }
}
