import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { MarkStaffAttendanceDto } from "./dto/mark-staff-attendance.dto";
import { StaffAttendanceQueryDto } from "./dto/staff-attendance-query.dto";
import { StaffAttendanceSummaryQueryDto } from "./dto/staff-attendance-summary-query.dto";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

@Injectable()
export class StaffAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(scope: TenantScope, dto: MarkStaffAttendanceDto) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId: scope.organizationId },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (employee.branchId !== branchId) {
      throw new ForbiddenException("Bu xodimga kirish huquqingiz yo'q");
    }
    const date = toDateOnly(dto.date);
    return this.prisma.employeeAttendance.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: {
        employeeId: dto.employeeId,
        branchId: employee.branchId,
        date,
        status: dto.status,
        note: dto.note,
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
      },
      update: { status: dto.status, note: dto.note, checkInTime: dto.checkInTime, checkOutTime: dto.checkOutTime },
    });
  }

  async findByBranchAndDate(scope: TenantScope, query: StaffAttendanceQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (scope.branchId && query.branchId && query.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    const date = toDateOnly(query.date ?? todayDateString());

    const [employees, records] = await Promise.all([
      this.prisma.employee.findMany({
        where: { branchId, isActive: true },
        select: { id: true, fullName: true, position: true },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.employeeAttendance.findMany({ where: { branchId, date } }),
    ]);

    const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));
    return {
      date: date.toISOString().slice(0, 10),
      employees: employees.map((e) => ({
        employeeId: e.id,
        fullName: e.fullName,
        position: e.position,
        status: recordByEmployee.get(e.id)?.status ?? null,
        note: recordByEmployee.get(e.id)?.note ?? null,
        checkInTime: recordByEmployee.get(e.id)?.checkInTime ?? null,
        checkOutTime: recordByEmployee.get(e.id)?.checkOutTime ?? null,
      })),
    };
  }

  /**
   * Oylik jamlanma: har xodim uchun kelgan/kelmagan kunlar soni. Kunlik
   * ko'rinish (`findByBranchAndDate`) faqat bitta sanani ko'rsatadi — bu
   * yerda butun oy bo'yicha tarix kerak.
   */
  async monthlySummary(scope: TenantScope, query: StaffAttendanceSummaryQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (scope.branchId && query.branchId && query.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }

    const period = query.period ?? todayDateString().slice(0, 7);
    const [year, month] = period.split("-").map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));

    const [employees, records] = await Promise.all([
      this.prisma.employee.findMany({
        where: { branchId, isActive: true },
        select: { id: true, fullName: true, position: true },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.employeeAttendance.findMany({
        where: { branchId, date: { gte: from, lte: to } },
        select: { employeeId: true, status: true },
      }),
    ]);

    const emptyCounts = () => ({ present: 0, absent: 0, late: 0, sick: 0, onLeave: 0 });
    const byEmployee = new Map<string, ReturnType<typeof emptyCounts>>();
    for (const record of records) {
      const counts = byEmployee.get(record.employeeId) ?? emptyCounts();
      if (record.status === "PRESENT") counts.present += 1;
      else if (record.status === "LATE") counts.late += 1;
      else if (record.status === "SICK") counts.sick += 1;
      else if (record.status === "ON_LEAVE") counts.onLeave += 1;
      else counts.absent += 1;
      byEmployee.set(record.employeeId, counts);
    }

    const items = employees.map((employee) => {
      const counts = byEmployee.get(employee.id) ?? emptyCounts();
      const marked = counts.present + counts.absent + counts.late + counts.sick + counts.onLeave;
      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        position: employee.position,
        ...counts,
        rate: marked === 0 ? null : Math.round((counts.present / marked) * 100),
      };
    });

    return {
      period,
      totals: {
        present: items.reduce((sum, item) => sum + item.present, 0),
        absent: items.reduce((sum, item) => sum + item.absent, 0),
        late: items.reduce((sum, item) => sum + item.late, 0),
        sick: items.reduce((sum, item) => sum + item.sick, 0),
        onLeave: items.reduce((sum, item) => sum + item.onLeave, 0),
      },
      employees: items,
    };
  }

  async todaySummary(scope: TenantScope) {
    const date = toDateOnly(todayDateString());
    const [present, absent] = await Promise.all([
      this.prisma.employeeAttendance.count({
        where: { status: "PRESENT", date, branchId: scope.branchId ?? undefined, branch: { organizationId: scope.organizationId } },
      }),
      this.prisma.employeeAttendance.count({
        where: { status: "ABSENT", date, branchId: scope.branchId ?? undefined, branch: { organizationId: scope.organizationId } },
      }),
    ]);
    return { present, absent };
  }
}
