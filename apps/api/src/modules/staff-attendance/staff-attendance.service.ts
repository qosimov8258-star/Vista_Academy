import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireBranchScope } from "../iam/tenant-auth.types";
import { MarkStaffAttendanceDto } from "./dto/mark-staff-attendance.dto";
import { StaffAttendanceQueryDto } from "./dto/staff-attendance-query.dto";

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
    const branchId = requireBranchScope(scope);
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
      create: { employeeId: dto.employeeId, branchId: employee.branchId, date, status: dto.status, note: dto.note },
      update: { status: dto.status, note: dto.note },
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
      })),
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
