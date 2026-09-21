import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireBranchScope, requireOperationalScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertNotAssistant, assertTeacherOwnsChild, resolveTeacherGroupIds } from "../iam/teacher-scope";
import { CashDeskService } from "../cash-desk/cash-desk.service";
import { BroadcastDto, CallDoneDto, MarkPickupDto } from "./dto/admin-desk.dto";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
function addDays(value: string, days: number): string {
  return new Date(toDateOnly(value).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}
function todayTashkent(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}
function assertDate(value: string | undefined): string {
  if (!value || !DATE_RE.test(value)) {
    throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
  }
  return value;
}
/** Toshkent kunining UTC chegarasi (to'lov va ariza vaqtlari uchun). */
function dayRange(from: string, toInclusive: string) {
  const start = new Date(toDateOnly(from).getTime() - TASHKENT_OFFSET_MS);
  return { gte: start, lt: new Date(toDateOnly(toInclusive).getTime() + DAY_MS - TASHKENT_OFFSET_MS) };
}
function mondayOf(value: string): string {
  const d = toDateOnly(value);
  const diff = d.getUTCDay() === 0 ? -6 : 1 - d.getUTCDay();
  return addDays(value, diff);
}

const GUARDIAN_SELECT = {
  orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
  select: { relation: true, canPickup: true, canReceiveNotifications: true, guardian: { select: { id: true, fullName: true, phone: true } } },
};

@Injectable()
export class AdminDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashDesk: CashDeskService,
  ) {}

  /**
   * "Bugun qo'ng'iroq qilish" ro'yxati: muddati o'tgan qarzdorlar, bugun kelmagan bolalar
   * (3 kun ketma-ket kelmaganlar belgilanadi) va bog'lanish kerak bo'lgan arizalar.
   * Qo'ng'iroq qilingani belgilansa, "done" bo'lib qoladi.
   */
  async calls(scope: TenantScope, dateInput: string) {
    const branchId = requireOperationalScope(scope);
    const date = assertDate(dateInput);
    const day = toDateOnly(date);

    const [debtors, absences, priorAbsences, leads, logs] = await Promise.all([
      this.cashDesk.debtors(scope),
      this.prisma.attendance.findMany({
        where: { branchId, date: day, status: "ABSENT", child: { status: { not: "INACTIVE" } } },
        select: { childId: true, note: true, child: { select: { fullName: true, group: { select: { name: true } }, guardians: { ...GUARDIAN_SELECT, take: 1 } } } },
      }),
      this.prisma.attendance.findMany({
        where: { branchId, status: "ABSENT", date: { in: [toDateOnly(addDays(date, -1)), toDateOnly(addDays(date, -2))] } },
        select: { childId: true },
      }),
      this.prisma.lead.findMany({
        where: {
          branchId,
          stage: { notIn: ["WON", "LOST"] },
          OR: [{ stage: "NEW" }, { followUpDate: { lte: day } }],
        },
        select: { id: true, childFullName: true, parentName: true, parentPhone: true, stage: true, followUpDate: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.callLog.findMany({ where: { branchId, date: day } }),
    ]);

    const logByKey = new Map(logs.map((l) => [`${l.kind}:${l.subjectId}`, l]));
    const priorCount = new Map<string, number>();
    for (const r of priorAbsences) priorCount.set(r.childId, (priorCount.get(r.childId) ?? 0) + 1);

    const withLog = (kind: string, subjectId: string) => {
      const log = logByKey.get(`${kind}:${subjectId}`);
      return { done: !!log, doneNote: log?.note ?? null, calledByName: log?.calledByName ?? null };
    };

    const items = [
      ...debtors.rows
        .filter((r) => r.overdue > 0)
        .map((r) => ({
          kind: "DEBT" as const,
          subjectId: r.childId,
          title: r.childName,
          subtitle: `Muddati o'tgan qarz: ${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(r.overdue)} UZS`,
          contactName: r.guardianName,
          phone: r.guardianPhone,
          badge: null as string | null,
          ...withLog("DEBT", r.childId),
        })),
      ...absences.map((a) => {
        const g = a.child.guardians[0];
        const streak = (priorCount.get(a.childId) ?? 0) + 1;
        return {
          kind: "ABSENT" as const,
          subjectId: a.childId,
          title: a.child.fullName,
          subtitle: `Bugun kelmadi${a.child.group ? ` · ${a.child.group.name}` : ""}${a.note ? ` · ${a.note}` : ""}`,
          contactName: g?.guardian.fullName ?? null,
          phone: g?.guardian.phone ?? null,
          badge: streak >= 3 ? `${streak} kun ketma-ket` : null,
          ...withLog("ABSENT", a.childId),
        };
      }),
      ...leads.map((l) => ({
        kind: "LEAD" as const,
        subjectId: l.id,
        title: l.childFullName,
        subtitle: `Ariza (${l.stage === "NEW" ? "yangi" : "qayta bog'lanish"})`,
        contactName: l.parentName,
        phone: l.parentPhone,
        badge: null as string | null,
        ...withLog("LEAD", l.id),
      })),
    ];
    return { date, items, open: items.filter((i) => !i.done).length };
  }

  async callDone(scope: TenantScope, actorName: string, dto: CallDoneDto) {
    const branchId = requireOperationalScope(scope);
    const date = toDateOnly(assertDate(dto.date.slice(0, 10)));
    await this.prisma.callLog.deleteMany({ where: { branchId, kind: dto.kind, subjectId: dto.subjectId, date } });
    await this.prisma.callLog.create({
      data: { branchId, kind: dto.kind, subjectId: dto.subjectId, date, note: dto.note?.trim() || null, calledByName: actorName },
    });
    return { success: true };
  }

  async callUndo(scope: TenantScope, dto: CallDoneDto) {
    const branchId = requireOperationalScope(scope);
    await this.prisma.callLog.deleteMany({
      where: { branchId, kind: dto.kind, subjectId: dto.subjectId, date: toDateOnly(assertDate(dto.date.slice(0, 10))) },
    });
    return { success: true };
  }

  /** Jonli doska: guruhlar bo'yicha kelganlar, olib ketilganlar, ovqat soni va kelmagan xodimlar. */
  async board(scope: TenantScope, dateInput: string) {
    const branchId = requireOperationalScope(scope);
    const date = assertDate(dateInput);
    const day = toDateOnly(date);
    const [groups, children, attendance, pickups, staff] = await Promise.all([
      this.prisma.group.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.child.findMany({ where: { branchId, status: { not: "INACTIVE" } }, select: { id: true, groupId: true } }),
      this.prisma.attendance.findMany({ where: { branchId, date: day }, select: { childId: true, status: true } }),
      this.prisma.pickupLog.findMany({ where: { branchId, date: day }, select: { childId: true } }),
      this.prisma.employeeAttendance.findMany({
        where: { branchId, date: day, status: { in: ["ABSENT", "SICK", "ON_LEAVE"] } },
        select: { status: true, employee: { select: { fullName: true, position: true } } },
      }),
    ]);
    const statusByChild = new Map(attendance.map((a) => [a.childId, a.status]));
    const pickedUp = new Set(pickups.map((p) => p.childId));
    const empty = () => ({ total: 0, present: 0, absent: 0, sick: 0, notMarked: 0, pickedUp: 0 });
    const rows = new Map<string | null, ReturnType<typeof empty> & { name: string }>(groups.map((g) => [g.id, { name: g.name, ...empty() }]));
    rows.set(null, { name: "Guruhsiz", ...empty() });
    for (const c of children) {
      const row = rows.get(c.groupId && rows.has(c.groupId) ? c.groupId : null)!;
      row.total += 1;
      const st = statusByChild.get(c.id);
      if (st === "PRESENT" || st === "LATE") row.present += 1;
      else if (st === "ABSENT") row.absent += 1;
      else if (st === "SICK") row.sick += 1;
      else row.notMarked += 1;
      if (pickedUp.has(c.id)) row.pickedUp += 1;
    }
    const list = [...rows.entries()].filter(([k, r]) => k !== null || r.total > 0).map(([groupId, r]) => ({ groupId, ...r }));
    const sum = (k: keyof ReturnType<typeof empty>) => list.reduce((s, r) => s + r[k], 0);
    return {
      date,
      totals: { total: sum("total"), present: sum("present"), absent: sum("absent"), sick: sum("sick"), notMarked: sum("notMarked"), pickedUp: sum("pickedUp") },
      // Oshpazga tayyorlanadigan ovqat: kelgan va kechikkan bolalar
      mealCount: sum("present"),
      stillHere: sum("present") - sum("pickedUp"),
      groups: list,
      staffAway: staff.map((s) => ({ fullName: s.employee.fullName, position: s.employee.position, status: s.status })),
    };
  }

  /** Kechqurun topshirish: bugun kelgan bolalar, ruxsat etilgan olib ketuvchilar va kim olib ketgani. */
  async pickups(scope: TenantScope, dateInput: string) {
    const branchId = requireTeachingScope(scope);
    const date = assertDate(dateInput);
    const day = toDateOnly(date);
    const groupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const attendance = await this.prisma.attendance.findMany({
      where: {
        branchId,
        date: day,
        status: { in: ["PRESENT", "LATE"] },
        ...(groupIds !== null ? { child: { groupId: { in: groupIds } } } : {}),
      },
      select: {
        status: true,
        child: {
          select: {
            id: true,
            fullName: true,
            group: { select: { name: true } },
            guardians: GUARDIAN_SELECT,
            pickupLogs: { where: { date: day }, select: { pickedByName: true, relation: true, note: true, recordedByName: true, createdAt: true } },
          },
        },
      },
      orderBy: { child: { fullName: "asc" } },
    });
    const children = attendance.map((a) => ({
      childId: a.child.id,
      childName: a.child.fullName,
      groupName: a.child.group?.name ?? null,
      guardians: a.child.guardians.map((g) => ({
        id: g.guardian.id,
        fullName: g.guardian.fullName,
        phone: g.guardian.phone,
        relation: g.relation,
        canPickup: g.canPickup,
      })),
      pickup: a.child.pickupLogs[0] ?? null,
    }));
    return { date, children, remaining: children.filter((c) => !c.pickup).length };
  }

  async markPickup(scope: TenantScope, actorName: string, dto: MarkPickupDto) {
    const branchId = requireTeachingScope(scope);
    await assertNotAssistant(this.prisma, scope);
    const child = await this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId, branchId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);
    let pickedByName = dto.pickedByName?.trim();
    let relation: string | null = null;
    if (dto.guardianId) {
      const link = await this.prisma.childGuardian.findFirst({
        where: { childId: child.id, guardianId: dto.guardianId },
        include: { guardian: { select: { fullName: true } } },
      });
      if (!link) {
        throw new NotFoundException("Bu ota-ona bolaga biriktirilmagan");
      }
      pickedByName = link.guardian.fullName;
      relation = link.relation;
    }
    if (!pickedByName) {
      throw new BadRequestException("Kim olib ketganini tanlang yoki ismini yozing");
    }
    const date = toDateOnly(assertDate(dto.date.slice(0, 10)));
    const data = { pickedByName, relation, note: dto.note?.trim() || null, recordedByName: actorName };
    await this.prisma.pickupLog.upsert({
      where: { childId_date: { childId: child.id, date } },
      create: { branchId, childId: child.id, date, ...data },
      update: data,
    });
    return { success: true };
  }

  async undoPickup(scope: TenantScope, childId: string, dateInput: string) {
    const branchId = requireTeachingScope(scope);
    await assertNotAssistant(this.prisma, scope);
    await this.prisma.pickupLog.deleteMany({ where: { branchId, childId, date: toDateOnly(assertDate(dateInput)) } });
    return { success: true };
  }

  /** Direktorga haftalik hisobot (dushanbadan yakshanbagacha). */
  async weekly(scope: TenantScope, fromInput?: string) {
    const branchId = requireBranchScope(scope);
    if (scope.role === "TEACHER") {
      throw new BadRequestException("Bu hisobot faqat filial xodimlari uchun");
    }
    const from = mondayOf(fromInput && DATE_RE.test(fromInput) ? fromInput : todayTashkent());
    const to = addDays(from, 6);
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const range = dayRange(from, to);

    const [childrenCount, attendance, payments, debtors, leadsNew, leadsWon, staffAbs] = await Promise.all([
      this.prisma.child.count({ where: { branchId, status: { not: "INACTIVE" } } }),
      this.prisma.attendance.findMany({
        where: { branchId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
        select: { date: true, status: true, childId: true, child: { select: { fullName: true } } },
      }),
      this.prisma.payment.findMany({ where: { branchId, createdAt: range, status: "COMPLETED" }, select: { amount: true } }),
      this.cashDesk.debtors(scope),
      this.prisma.lead.count({ where: { branchId, createdAt: range } }),
      this.prisma.lead.count({ where: { branchId, stage: "WON", updatedAt: range } }),
      this.prisma.employeeAttendance.count({ where: { branchId, date: { gte: toDateOnly(from), lte: toDateOnly(to) }, status: { in: ["ABSENT", "SICK", "ON_LEAVE"] } } }),
    ]);

    const perDay = new Map(days.map((d) => [d, { date: d, present: 0, absent: 0, sick: 0 }]));
    const absentByChild = new Map<string, { name: string; days: number }>();
    for (const a of attendance) {
      const row = perDay.get(a.date.toISOString().slice(0, 10));
      if (!row) continue;
      if (a.status === "PRESENT" || a.status === "LATE") row.present += 1;
      else if (a.status === "ABSENT") {
        row.absent += 1;
        const e = absentByChild.get(a.childId) ?? { name: a.child.fullName, days: 0 };
        e.days += 1;
        absentByChild.set(a.childId, e);
      } else if (a.status === "SICK") row.sick += 1;
    }
    const daily = [...perDay.values()];
    const marked = daily.reduce((s, d) => s + d.present + d.absent + d.sick, 0);
    const present = daily.reduce((s, d) => s + d.present, 0);
    return {
      from,
      to,
      children: childrenCount,
      attendancePercent: marked === 0 ? null : Math.round((present / marked) * 100),
      daily,
      frequentlyAbsent: [...absentByChild.values()].filter((c) => c.days >= 2).sort((a, b) => b.days - a.days).slice(0, 8),
      collected: payments.reduce((s, p) => s + Number(p.amount), 0),
      totalDebt: debtors.totalDebt,
      overdueDebt: debtors.totalOverdue,
      debtorsCount: debtors.rows.length,
      newLeads: leadsNew,
      wonLeads: leadsWon,
      staffAbsences: staffAbs,
    };
  }

  /** Ommaviy xabar: guruh (yoki butun filial) bolalarining ota-onalariga bildirishnoma jurnaliga yoziladi. */
  async broadcast(scope: TenantScope, userId: string, dto: BroadcastDto) {
    const branchId = requireOperationalScope(scope);
    if (dto.groupId) {
      const group = await this.prisma.group.findFirst({ where: { id: dto.groupId, branchId } });
      if (!group) {
        throw new NotFoundException("Guruh topilmadi");
      }
    }
    const children = await this.prisma.child.findMany({
      where: { branchId, status: { not: "INACTIVE" }, ...(dto.groupId ? { groupId: dto.groupId } : {}) },
      select: { id: true, guardians: { where: { canReceiveNotifications: true }, ...GUARDIAN_SELECT, take: 1 } },
    });
    // Bir ota-onaning bir nechta bolasi bo'lsa xabar bir marta boradi
    const seen = new Set<string>();
    const rows = [];
    for (const c of children) {
      const g = c.guardians[0]?.guardian;
      if (!g || seen.has(g.id)) continue;
      seen.add(g.id);
      rows.push({
        organizationId: scope.organizationId,
        branchId,
        childId: c.id,
        eventType: "CUSTOM" as const,
        channel: "SMS" as const,
        recipientName: g.fullName,
        recipientContact: g.phone,
        message: dto.message.trim(),
        sentByUserId: userId,
      });
    }
    if (rows.length > 0) {
      await this.prisma.notificationLog.createMany({ data: rows });
    }
    return { recipients: rows.length, skipped: children.length - rows.length };
  }
}
