import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireMoneyScope, toTenantScope } from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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
    // Ilgari bu yerda rol umuman tekshirilmasdi — O'qituvchi ham
    // hamkasabasining maosh sxemasini to'g'ridan-to'g'ri so'rov bilan
    // o'qiy olardi. Yozish huquqi (`upsertSalaryScheme`) bilan bir xil
    // qatorda — u yerga umuman kirmasligi kerak.
    if (scope.role === "TEACHER") {
      throw new ForbiddenException("O'qituvchi maosh sxemasini ko'ra olmaydi");
    }
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

  async generatePayroll(caller: TenantAuthenticatedUser, dto: GeneratePayrollDto) {
    const scope = toTenantScope(caller);
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
    const deductionAmount = dto.deductionAmount ?? 0;
    const totalAmount = baseAmount + bonusAmount - penaltyAmount - deductionAmount;

    const entry = await this.prisma.payrollEntry.upsert({
      where: { employeeId_period: { employeeId: dto.employeeId, period: dto.period } },
      create: {
        employeeId: dto.employeeId,
        branchId,
        period: dto.period,
        baseAmount,
        bonusAmount,
        penaltyAmount,
        deductionAmount,
        totalAmount,
        note: dto.note,
      },
      update: { baseAmount, bonusAmount, penaltyAmount, deductionAmount, totalAmount, note: dto.note },
    });
    await this.auditLog.logFromUser(caller, {
      action: "payroll.generate",
      entityType: "PayrollEntry",
      entityId: entry.id,
      branchId,
      summary: `${employee.fullName} uchun ${dto.period} oyi maoshi hisoblandi (${totalAmount})`,
    });
    return entry;
  }

  async markPayrollPaid(caller: TenantAuthenticatedUser, id: string) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const entry = await this.prisma.payrollEntry.findFirst({
      where: { id },
      include: { employee: { select: { fullName: true } } },
    });
    if (!entry || entry.branchId !== branchId) {
      throw new NotFoundException("Payroll yozuvi topilmadi");
    }
    const updated = await this.prisma.payrollEntry.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });
    await this.auditLog.logFromUser(caller, {
      action: "payroll.mark_paid",
      entityType: "PayrollEntry",
      entityId: id,
      branchId,
      summary: `${entry.employee.fullName}ning ${entry.period} oyi maoshi to'landi deb belgilandi`,
    });
    return updated;
  }

  async listPayroll(scope: TenantScope, query: PayrollQueryDto) {
    assertPayrollReader(scope);
    const where: Prisma.PayrollEntryWhereInput = {
      branch: { organizationId: scope.organizationId },
      branchId: scope.branchId ?? query.branchId,
      ...(query.period ? { period: query.period } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payrollEntry.findMany({
        where,
        include: {
          employee: { select: { id: true, fullName: true, position: true } },
          // Tarmoq ko'rinishida qatorni filial nomi bilan belgilash uchun
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payrollEntry.count({ where }),
    ]);
    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  /**
   * Ish haqi jamlanmasi: umumiy fond va filial kesimi. Ro'yxatni sahifalab
   * yig'ish o'rniga bazada `groupBy` bilan hisoblanadi.
   */
  async payrollSummary(scope: TenantScope, query: PayrollQueryDto) {
    assertPayrollReader(scope);
    const where: Prisma.PayrollEntryWhereInput = {
      branch: { organizationId: scope.organizationId },
      branchId: scope.branchId ?? query.branchId,
      ...(query.period ? { period: query.period } : {}),
    };

    const [rows, branches] = await Promise.all([
      this.prisma.payrollEntry.groupBy({
        by: ["branchId", "status"],
        where,
        _sum: { baseAmount: true, bonusAmount: true, penaltyAmount: true, deductionAmount: true, totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.branch.findMany({
        where: { organizationId: scope.organizationId, ...(scope.branchId ?? query.branchId ? { id: scope.branchId ?? query.branchId } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const totals = { entries: 0, base: 0, bonus: 0, penalty: 0, deduction: 0, total: 0, paid: 0, unpaid: 0 };
    const perBranch = new Map<string, { entries: number; total: number; paid: number; unpaid: number }>();

    for (const row of rows) {
      const total = Number(row._sum.totalAmount ?? 0);
      totals.entries += row._count._all;
      totals.base += Number(row._sum.baseAmount ?? 0);
      totals.bonus += Number(row._sum.bonusAmount ?? 0);
      totals.penalty += Number(row._sum.penaltyAmount ?? 0);
      totals.deduction += Number(row._sum.deductionAmount ?? 0);
      totals.total += total;
      if (row.status === "PAID") totals.paid += total;
      else totals.unpaid += total;

      const bucket = perBranch.get(row.branchId) ?? { entries: 0, total: 0, paid: 0, unpaid: 0 };
      bucket.entries += row._count._all;
      bucket.total += total;
      if (row.status === "PAID") bucket.paid += total;
      else bucket.unpaid += total;
      perBranch.set(row.branchId, bucket);
    }

    return {
      period: query.period ?? null,
      totals,
      branches: branches.map((branch) => ({
        branchId: branch.id,
        branchName: branch.name,
        ...(perBranch.get(branch.id) ?? { entries: 0, total: 0, paid: 0, unpaid: 0 }),
      })),
    };
  }
}

/**
 * Ish haqi ma'lumotini Super Admin, filial admini va moliyachi ko'radi.
 * Ilgari bu ro'yxat rolsiz ochiq edi — o'qituvchi ham butun filialning
 * oyliklarini o'qiy olardi.
 */
function assertPayrollReader(scope: TenantScope) {
  if (scope.role !== "NETWORK_ADMIN" && scope.role !== "BRANCH_ADMIN" && scope.role !== "FINANCE") {
    throw new ForbiddenException("Ish haqi ma'lumotini ko'rish huquqingiz yo'q");
  }
}
