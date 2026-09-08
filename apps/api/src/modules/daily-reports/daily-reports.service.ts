import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild, resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { NotificationsService } from "../notifications/notifications.service";
import { UpsertDailyReportDto } from "./dto/upsert-daily-report.dto";
import { DailyReportQueryDto } from "./dto/daily-report-query.dto";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async upsert(scope: TenantScope, dto: UpsertDailyReportDto) {
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
    const existing = await this.prisma.dailyReport.findUnique({ where: { childId_date: { childId: dto.childId, date } } });
    const report = await this.prisma.dailyReport.upsert({
      where: { childId_date: { childId: dto.childId, date } },
      create: {
        organizationId: scope.organizationId,
        branchId,
        childId: dto.childId,
        date,
        eatingQuality: dto.eatingQuality,
        sleepMinutes: dto.sleepMinutes,
        mood: dto.mood,
        toiletNotes: dto.toiletNotes,
        activityNotes: dto.activityNotes,
      },
      update: {
        eatingQuality: dto.eatingQuality,
        sleepMinutes: dto.sleepMinutes,
        mood: dto.mood,
        toiletNotes: dto.toiletNotes,
        activityNotes: dto.activityNotes,
      },
    });

    if (!existing) {
      const link = await this.prisma.childGuardian.findFirst({
        where: { childId: child.id, canReceiveNotifications: true },
        include: { guardian: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      await this.notifications.logSystemEvent({
        organizationId: scope.organizationId,
        branchId,
        childId: child.id,
        eventType: "DAILY_REPORT_READY",
        recipientName: link?.guardian.fullName ?? "Ota-ona",
        message: `${child.fullName} uchun bugungi (${dto.date}) kundalik hisobot tayyor.`,
      });
    }

    return report;
  }

  async findByBranchAndDate(scope: TenantScope, query: DailyReportQueryDto) {
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

    const [children, reports] = await Promise.all([
      this.prisma.child.findMany({
        where: teacherChildWhere({ branchId, status: "ACTIVE" }, teacherGroupIds),
        select: { id: true, fullName: true, group: { select: { id: true, name: true } } },
        orderBy: [{ group: { name: "asc" } }, { fullName: "asc" }],
      }),
      this.prisma.dailyReport.findMany({ where: { branchId, date } }),
    ]);

    const reportByChild = new Map(reports.map((r) => [r.childId, r]));
    return {
      date: date.toISOString().slice(0, 10),
      children: children.map((c) => ({
        childId: c.id,
        fullName: c.fullName,
        groupName: c.group?.name ?? null,
        report: reportByChild.get(c.id) ?? null,
      })),
    };
  }

  async findByChild(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    return this.prisma.dailyReport.findMany({
      where: { childId },
      orderBy: { date: "desc" },
      take: 60,
    });
  }

  async todayFilledCount(scope: TenantScope): Promise<number> {
    const date = toDateOnly(todayDateString());
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    return this.prisma.dailyReport.count({
      where: {
        date,
        branchId: scope.branchId ?? undefined,
        branch: { organizationId: scope.organizationId },
        ...(teacherGroupIds === null ? {} : { child: { groupId: { in: teacherGroupIds } } }),
      },
    });
  }
}
