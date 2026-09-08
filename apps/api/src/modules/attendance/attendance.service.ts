import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild, resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
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
    const branchId = requireTeachingScope(scope);
    const child = await this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);
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
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);

    const [children, records] = await Promise.all([
      this.prisma.child.findMany({
        where: teacherChildWhere({ branchId, status: "ACTIVE" }, teacherGroupIds),
        select: { id: true, fullName: true, group: { select: { id: true, name: true } } },
        orderBy: [{ group: { name: "asc" } }, { fullName: "asc" }],
      }),
      this.prisma.attendance.findMany({ where: { branchId, date } }),
    ]);

    const recordByChild = new Map(records.map((r) => [r.childId, r]));
    return {
      date: date.toISOString().slice(0, 10),
      children: children.map((c) => ({
        childId: c.id,
        fullName: c.fullName,
        groupName: c.group?.name ?? null,
        status: recordByChild.get(c.id)?.status ?? null,
        note: recordByChild.get(c.id)?.note ?? null,
      })),
    };
  }

  async todaySummary(scope: TenantScope) {
    const date = toDateOnly(todayDateString());
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const base = {
      date,
      branchId: scope.branchId ?? undefined,
      branch: { organizationId: scope.organizationId },
      ...(teacherGroupIds === null ? {} : { child: { groupId: { in: teacherGroupIds } } }),
    };
    const [present, absent] = await Promise.all([
      this.prisma.attendance.count({ where: { ...base, status: "PRESENT" } }),
      this.prisma.attendance.count({ where: { ...base, status: "ABSENT" } }),
    ]);
    return { present, absent };
  }
}
