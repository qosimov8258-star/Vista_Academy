import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild, resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { NotificationsService } from "../notifications/notifications.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import { AttendanceRangeQueryDto } from "./dto/attendance-range-query.dto";
import { RequestContactDto } from "./dto/request-contact.dto";

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

    const record = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: { childId_date: { childId: dto.childId, date } },
      });
      const wasPresent = existing?.status === "PRESENT";
      const willBePresent = dto.status === "PRESENT";

      // undefined — coinTransactionId ustuniga tegilmaydi; null — bog'lanish uziladi.
      let coinTransactionId: string | null | undefined;
      let coinTransactionIdToRemove: string | null = null;

      if (!wasPresent && willBePresent) {
        // ABSENT/LATE/SICK/belgilanmagan -> PRESENT: bitta kunga bitta marta +5 coin.
        const coinTransaction = await tx.coinTransaction.create({
          data: {
            organizationId: child.organizationId,
            branchId: child.branchId,
            childId: child.id,
            amount: 5,
            source: "ATTENDANCE",
            reason: `Kunlik davomat — ${dto.date}`,
            recordedByUserId: scope.userId,
          },
        });
        coinTransactionId = coinTransaction.id;
      } else if (wasPresent && !willBePresent && existing?.coinTransactionId) {
        // PRESENT -> boshqa holat: avval berilgan coin qaytarib olinadi.
        coinTransactionId = null;
        coinTransactionIdToRemove = existing.coinTransactionId;
      }

      const updated = await tx.attendance.upsert({
        where: { childId_date: { childId: dto.childId, date } },
        create: {
          childId: dto.childId,
          branchId: child.branchId,
          date,
          status: dto.status,
          note: dto.note,
          coinTransactionId: coinTransactionId ?? undefined,
        },
        update: {
          status: dto.status,
          note: dto.note,
          ...(coinTransactionId !== undefined ? { coinTransactionId } : {}),
        },
      });

      // Attendance yozuvi avval yangilanadi (coinTransactionId: null), keyin
      // eski tranzaksiya o'chiriladi — FK constraint buzilmasligi uchun tartib muhim.
      if (coinTransactionIdToRemove) {
        await tx.coinTransaction.delete({ where: { id: coinTransactionIdToRemove } });
      }

      return updated;
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

  /**
   * Tarbiyachi "Aloqaga chiqish" tugmasini bosganda — ota-ona kelmagan kun
   * uchun sabab qoldirmagan bo'lsa shu yo'l bilan filial administratoriga
   * xabar beriladi (mavjud Bildirishnomalar jurnaliga yoziladi). Qayta
   * bosilsa — takror bildirishnoma yuborilmaydi, borini qaytaradi.
   */
  async requestContact(scope: TenantScope, dto: RequestContactDto) {
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

    const existing = await this.prisma.attendance.findUnique({
      where: { childId_date: { childId: dto.childId, date } },
    });
    if (!existing || existing.status !== "ABSENT") {
      throw new BadRequestException("Faqat shu kuni kelmagan bola uchun aloqaga chiqish so'ralishi mumkin");
    }
    if (existing.contactRequestedAt) {
      return existing;
    }

    const updated = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: { contactRequestedAt: new Date() },
    });
    await this.notifications.logSystemEvent({
      organizationId: scope.organizationId,
      branchId: child.branchId,
      childId: child.id,
      eventType: "CHILD_ABSENT",
      recipientName: "Administrator",
      message: `${child.fullName} bugun (${dto.date}) kelmadi, ota-ona sabab qoldirmadi — tarbiyachi aloqaga chiqishni so'radi.`,
    });
    return updated;
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
        select: {
          id: true,
          fullName: true,
          gender: true,
          avatarUpdatedAt: true,
          group: { select: { id: true, name: true } },
        },
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
        gender: c.gender,
        avatarUpdatedAt: c.avatarUpdatedAt ? c.avatarUpdatedAt.toISOString() : null,
        status: recordByChild.get(c.id)?.status ?? null,
        note: recordByChild.get(c.id)?.note ?? null,
        parentReason: recordByChild.get(c.id)?.parentReason ?? null,
        contactRequestedAt: recordByChild.get(c.id)?.contactRequestedAt?.toISOString() ?? null,
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

  /**
   * Bola kabinetidagi "Davomat" kartasi uchun — shu yilgi barcha belgilangan
   * kunlar (statistika + kalendarni bo'yash uchun kunma-kun ro'yxat).
   * LATE ham kelgan hisoblanadi (bola bog'chaga qatnashgan, faqat kech
   * qolgan); ABSENT/SICK ichida izohi bor bo'lsa — sababli, bo'lmasa —
   * sababsiz deb hisoblanadi.
   */
  async getChildHistory(scope: TenantScope, childId: string, year?: number) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }

    const targetYear = year && Number.isInteger(year) ? year : new Date().getFullYear();
    const from = new Date(Date.UTC(targetYear, 0, 1));
    const to = new Date(Date.UTC(targetYear, 11, 31));

    const records = await this.prisma.attendance.findMany({
      where: { childId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { date: true, status: true, note: true },
    });

    let present = 0;
    let absent = 0;
    let excusedAbsent = 0;
    let unexcusedAbsent = 0;
    for (const record of records) {
      if (record.status === "PRESENT" || record.status === "LATE") {
        present += 1;
      } else {
        absent += 1;
        if (record.note && record.note.trim().length > 0) {
          excusedAbsent += 1;
        } else {
          unexcusedAbsent += 1;
        }
      }
    }
    const total = records.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

    return {
      year: targetYear,
      stats: { present, absent, excusedAbsent, unexcusedAbsent, attendanceRate },
      records: records.map((r) => ({ date: dateKey(r.date), status: r.status, note: r.note })),
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
    // Kech qoldi va kasal bolalar ham "kelmaganlar" qatorida hisoblanadi —
    // dashboard kartasida faqat "Keldi" / "Kelmadi" ikkita holat ko'rsatiladi.
    const [present, absent] = await Promise.all([
      this.prisma.attendance.count({ where: { ...base, status: "PRESENT" } }),
      this.prisma.attendance.count({ where: { ...base, status: { in: ["ABSENT", "LATE", "SICK"] } } }),
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
