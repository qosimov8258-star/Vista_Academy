import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild, resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { NotificationsService } from "../notifications/notifications.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import { AttendanceRangeQueryDto } from "./dto/attendance-range-query.dto";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

const DEFAULT_TIMEZONE = "Asia/Tashkent";
const DEFAULT_RANGE_DAYS = 14;
const MAX_RANGE_DAYS = 366;

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

  /**
   * Filial darajasidagi kunlik statistika — so'nggi N kun bo'yicha har kun
   * necha bola kelgan/kelmagan/belgilanmagan. Guruh darajasidagi
   * `GroupsService.attendanceRange` bilan bir xil mantiq, faqat bola
   * kesimisiz — filialda bolalar ko'p bo'lishi mumkin.
   */
  async rangeSummary(scope: TenantScope, query: AttendanceRangeQueryDto) {
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

    const to = query.to ?? todayDateString();
    const from = query.from ?? dateKey(addDays(toDateOnly(to), -(DEFAULT_RANGE_DAYS - 1)));
    const fromDate = toDateOnly(from);
    const toDate = toDateOnly(to);
    if (fromDate > toDate) {
      throw new BadRequestException("Boshlanish sanasi tugash sanasidan keyin bo'lishi mumkin emas");
    }
    const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (dayCount > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Oraliq ${MAX_RANGE_DAYS} kundan uzun bo'lmasligi kerak`);
    }

    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const totalChildren = await this.prisma.child.count({
      where: teacherChildWhere({ branchId, status: "ACTIVE" }, teacherGroupIds),
    });

    const records = totalChildren
      ? await this.prisma.attendance.findMany({
          where: {
            branchId,
            date: { gte: fromDate, lte: toDate },
            child: teacherChildWhere({ status: "ACTIVE" }, teacherGroupIds),
          },
          select: { date: true, status: true },
        })
      : [];

    const byDay = new Map<string, { present: number; absent: number }>();
    for (const record of records) {
      const key = dateKey(record.date);
      const day = byDay.get(key) ?? { present: 0, absent: 0 };
      if (record.status === "PRESENT") day.present += 1;
      else day.absent += 1;
      byDay.set(key, day);
    }

    const days: { date: string; present: number; absent: number; unmarked: number }[] = [];
    for (let cursor = fromDate; cursor <= toDate; cursor = addDays(cursor, 1)) {
      const key = dateKey(cursor);
      const counts = byDay.get(key) ?? { present: 0, absent: 0 };
      days.push({
        date: key,
        present: counts.present,
        absent: counts.absent,
        unmarked: Math.max(0, totalChildren - counts.present - counts.absent),
      });
    }

    return { from, to, totalChildren, days };
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

  /**
   * Davomat sahifasida ogohlantirish uchun: kim ketma-ket 3+ kun kelmadi,
   * yoki to'lov muddati o'tgan va bugun ham kelmagan. Ikkala ma'lumot ham
   * bazada bor edi, faqat hech qachon bog'lanmagan edi.
   */
  async chronicAbsenceFlags(scope: TenantScope, branchId?: string) {
    const resolvedBranchId = scope.branchId ?? branchId;
    if (!resolvedBranchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const children = await this.prisma.child.findMany({
      where: teacherChildWhere({ branchId: resolvedBranchId, status: "ACTIVE" }, teacherGroupIds),
      select: { id: true, fullName: true },
    });
    if (children.length === 0) {
      return [];
    }
    const childIds = children.map((c) => c.id);

    // Streakni aniqlash uchun oxirgi 14 kunlik yozuv yetarli — undan
    // uzoqroq tekshirish shart emas, ketma-ketlik shu oraliqda buziladi.
    const since = addDays(toDateOnly(todayDateString()), -13);
    const [records, overdueInvoices] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { childId: { in: childIds }, date: { gte: since } },
        select: { childId: true, date: true, status: true },
        orderBy: { date: "desc" },
      }),
      this.prisma.invoice.findMany({
        where: {
          branchId: resolvedBranchId,
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          dueDate: { lt: new Date() },
        },
        select: { childId: true },
      }),
    ]);

    const recordsByChild = new Map<string, { date: Date; status: string }[]>();
    for (const record of records) {
      const list = recordsByChild.get(record.childId) ?? [];
      list.push({ date: record.date, status: record.status });
      recordsByChild.set(record.childId, list);
    }
    const overdueChildIds = new Set(overdueInvoices.map((i) => i.childId));

    const flags: {
      childId: string;
      fullName: string;
      consecutiveAbsentDays: number;
      overdueAndAbsentToday: boolean;
    }[] = [];
    for (const child of children) {
      // Har bir bolaning yozuvi eng yangisidan boshlab, uzilmagan "ABSENT"
      // ketma-ketligi hisoblanadi (kunlar allaqachon `desc` tartibda keladi).
      const recs = recordsByChild.get(child.id) ?? [];
      let streak = 0;
      for (const r of recs) {
        if (r.status === "ABSENT") streak += 1;
        else break;
      }
      const overdueAndAbsentToday = overdueChildIds.has(child.id) && recs[0]?.status === "ABSENT";
      if (streak >= 3 || overdueAndAbsentToday) {
        flags.push({ childId: child.id, fullName: child.fullName, consecutiveAbsentDays: streak, overdueAndAbsentToday });
      }
    }
    return flags;
  }
}
