import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async mark(scope: TenantScope, dto: MarkAttendanceDto) {
    const branchId = requireOperationalScope(scope);
    const child = await this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    const date = toDateOnly(dto.date);
    const record = await this.prisma.attendance.upsert({
      where: { childId_date: { childId: dto.childId, date } },
      create: { childId: dto.childId, branchId: child.branchId, date, status: dto.status, note: dto.note },
      update: { status: dto.status, note: dto.note },
    });

    if (dto.status === "ABSENT") {
      const link = await this.prisma.childGuardian.findFirst({
        where: { childId: child.id, canReceiveNotifications: true },
        include: { guardian: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      await this.notifications.logSystemEvent({
        organizationId: scope.organizationId,
        branchId: child.branchId,
        childId: child.id,
        eventType: "CHILD_ABSENT",
        recipientName: link?.guardian.fullName ?? "Ota-ona",
        message: `${child.fullName} bugun (${dto.date}) bog'chaga kelmadi.`,
      });
    }

    return record;
  }

  async findByBranchAndDate(scope: TenantScope, query: AttendanceQueryDto) {
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

    const [children, records] = await Promise.all([
      this.prisma.child.findMany({
        where: { branchId, status: "ACTIVE" },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.attendance.findMany({ where: { branchId, date } }),
    ]);

    const recordByChild = new Map(records.map((r) => [r.childId, r]));
    return {
      date: date.toISOString().slice(0, 10),
      children: children.map((c) => ({
        childId: c.id,
        fullName: c.fullName,
        status: recordByChild.get(c.id)?.status ?? null,
        note: recordByChild.get(c.id)?.note ?? null,
      })),
    };
  }

  async todaySummary(scope: TenantScope) {
    const date = toDateOnly(todayDateString());
    const [present, absent] = await Promise.all([
      this.prisma.attendance.count({
        where: { status: "PRESENT", date, branchId: scope.branchId ?? undefined, branch: { organizationId: scope.organizationId } },
      }),
      this.prisma.attendance.count({
        where: { status: "ABSENT", date, branchId: scope.branchId ?? undefined, branch: { organizationId: scope.organizationId } },
      }),
    ]);
    return { present, absent };
  }
}
