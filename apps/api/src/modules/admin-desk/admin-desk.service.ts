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
function formatTashkentDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
function mondayOf(value: string): string {
  const d = toDateOnly(value);
  const diff = d.getUTCDay() === 0 ? -6 : 1 - d.getUTCDay();
  return addDays(value, diff);
}

/** Oylik to'lov muddatidan shuncha kun o'tgach qarzdor call operatorga o'tadi. */
const DEBT_GRACE_DAYS = 5;
/** Frontenddagi "Aloqa qila olmadim" izohi — bunday ariza ertaga yana ro'yxatga chiqadi. */
const NO_ANSWER_PREFIX = "Aloqa qila olmadim";
/** "Qo'ng'iroq qilinganlar" ro'yxati shuncha kunlik arizalarni ko'rsatadi. */
const CALLED_LEADS_LOOKBACK_DAYS = 30;

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

    const [debtors, absences, priorAbsences, leads, fakeReceiptsToday, logs] = await Promise.all([
      this.cashDesk.debtors(scope),
      this.prisma.attendance.findMany({
        where: { branchId, date: day, status: "ABSENT", child: { status: { not: "INACTIVE" } } },
        select: { childId: true, note: true, child: { select: { fullName: true, group: { select: { name: true } }, guardians: { ...GUARDIAN_SELECT, take: 3 } } } },
      }),
      this.prisma.attendance.findMany({
        where: { branchId, status: "ABSENT", date: { in: [toDateOnly(addDays(date, -1)), toDateOnly(addDays(date, -2))] } },
        select: { childId: true },
      }),
      // Saytdan kelgan arizalar tashkilotning birinchi filialiga yoziladi — shuning
      // uchun ular tashkilotning har bir filial operatoriga ko'rinadi.
      this.prisma.lead.findMany({
        where: {
          OR: [{ branchId }, { organizationId: scope.organizationId, source: "WEBSITE" }],
          stage: { notIn: ["WON", "LOST"] },
          AND: [{ OR: [{ stage: "NEW" }, { followUpDate: { lte: day } }] }],
        },
        select: { id: true, childFullName: true, parentName: true, parentPhone: true, stage: true, source: true, followUpDate: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      // Shu kuni rad etilgan cheklar — soxta chek 2-yoki-undan-ko'p marta
      // takrorlangan ota-onalarni operator qo'ng'iroq ro'yxatiga chiqaradi.
      this.prisma.paymentReceipt.findMany({
        where: { branchId, status: "REJECTED", reviewedAt: dayRange(date, date) },
        select: {
          id: true,
          guardianId: true,
          child: { select: { fullName: true } },
          guardian: { select: { fullName: true, phone: true } },
        },
      }),
      this.prisma.callLog.findMany({ where: { branchId, date: day } }),
    ]);

    // Guardian bo'yicha jami rad etilgan cheklar soni — faqat 2-yoki-undan
    // ko'p marta soxta chek yuborganlar operator ro'yxatiga chiqadi, birinchi
    // xato uchun hali qo'ng'iroq talab qilinmaydi.
    const fakeReceiptGuardianIds = [...new Set(fakeReceiptsToday.map((r) => r.guardianId))];
    const rejectedCounts = fakeReceiptGuardianIds.length
      ? await this.prisma.paymentReceipt.groupBy({
          by: ["guardianId"],
          where: { branchId, guardianId: { in: fakeReceiptGuardianIds }, status: "REJECTED" },
          _count: { _all: true },
        })
      : [];
    const rejectedCountByGuardian = new Map(rejectedCounts.map((r) => [r.guardianId, r._count._all]));

    // Arizaga qo'ng'iroq filialga emas, arizaga bog'liq: boshqa filial operatori
    // qo'ng'iroq qilgan bo'lsa ham ariza "qilingan" hisoblanadi. Avvalgi kunlarda
    // javob olingan yangi ariza ertasi kuni qaytmaydi (faqat qayta bog'lanish
    // sanasi kelsa qaytadi); "aloqa qila olmadim" bo'lsa — ertaga yana chiqadi.
    const leadLogs = leads.length
      ? await this.prisma.callLog.findMany({
          where: { kind: "LEAD", subjectId: { in: leads.map((l) => l.id) }, date: { lte: day } },
          select: { subjectId: true, date: true, note: true, calledByName: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const leadLogToday = new Map<string, (typeof leadLogs)[number]>();
    const leadAnsweredBefore = new Set<string>();
    for (const log of leadLogs) {
      if (log.date.getTime() === day.getTime()) {
        if (!leadLogToday.has(log.subjectId)) leadLogToday.set(log.subjectId, log);
      } else if (!log.note?.startsWith(NO_ANSWER_PREFIX)) {
        leadAnsweredBefore.add(log.subjectId);
      }
    }
    const followUpDue = (l: (typeof leads)[number]) => !!l.followUpDate && l.followUpDate.getTime() <= day.getTime();
    const openLeads = leads.filter((l) => leadLogToday.has(l.id) || followUpDue(l) || !leadAnsweredBefore.has(l.id));

    const debtCutoff = addDays(date, -DEBT_GRACE_DAYS);

    const logByKey = new Map(logs.map((l) => [`${l.kind}:${l.subjectId}`, l]));
    const priorCount = new Map<string, number>();
    for (const r of priorAbsences) priorCount.set(r.childId, (priorCount.get(r.childId) ?? 0) + 1);

    const withLog = (kind: string, subjectId: string) => {
      const log = logByKey.get(`${kind}:${subjectId}`);
      return { done: !!log, doneNote: log?.note ?? null, calledByName: log?.calledByName ?? null };
    };

    const items = [
      ...debtors.rows
        .filter((r) => r.overdue > 0 && !!r.oldestDueDate && r.oldestDueDate.slice(0, 10) <= debtCutoff)
        .map((r) => ({
          kind: "DEBT" as const,
          subjectId: r.childId,
          title: r.childName,
          subtitle: `Muddati o'tgan qarz: ${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(r.overdue)} UZS · ${Math.round((day.getTime() - toDateOnly(r.oldestDueDate!.slice(0, 10)).getTime()) / DAY_MS)} kun o'tdi`,
          contactName: r.guardianName,
          phone: r.guardianPhone,
          contacts: r.guardianPhone ? [{ name: r.guardianName as string | null, relation: null as string | null, phone: r.guardianPhone as string | null }] : [],
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
          contacts: a.child.guardians.map((x) => ({ name: x.guardian.fullName as string | null, relation: x.relation as string | null, phone: x.guardian.phone as string | null })),
          badge: streak >= 3 ? `${streak} kun ketma-ket` : null,
          ...withLog("ABSENT", a.childId),
        };
      }),
      ...openLeads.map((l) => {
        const log = leadLogToday.get(l.id);
        return {
          kind: "LEAD" as const,
          subjectId: l.id,
          // Saytdan kelgan arizada bola ismi so'ralmaydi — ota-ona ismi ko'rsatiladi
          title: l.childFullName || l.parentName,
          subtitle: `${l.source === "WEBSITE" ? "Saytdan ariza" : "Ariza"} (${followUpDue(l) ? "qayta bog'lanish" : "yangi"}) · ${formatTashkentDateTime(l.createdAt)}`,
          contactName: l.parentName,
          phone: l.parentPhone,
          contacts: l.parentPhone ? [{ name: l.parentName as string | null, relation: null as string | null, phone: l.parentPhone as string | null }] : [],
          badge: (l.source === "WEBSITE" ? "Sayt" : null) as string | null,
          done: !!log,
          doneNote: log?.note ?? null,
          calledByName: log?.calledByName ?? null,
        };
      }),
      ...fakeReceiptsToday
        .filter((r, i, arr) => arr.findIndex((x) => x.guardianId === r.guardianId) === i)
        .filter((r) => (rejectedCountByGuardian.get(r.guardianId) ?? 0) >= 2)
        .map((r) => {
          const count = rejectedCountByGuardian.get(r.guardianId) ?? 0;
          return {
            kind: "FAKE_RECEIPT" as const,
            subjectId: r.guardianId,
            title: r.child.fullName,
            subtitle: `${count}-marta soxta to'lov cheki yubordi`,
            contactName: r.guardian.fullName,
            phone: r.guardian.phone,
            contacts: [{ name: r.guardian.fullName as string | null, relation: null as string | null, phone: r.guardian.phone as string | null }],
            badge: `${count}-chek`,
            ...withLog("FAKE_RECEIPT", r.guardianId),
          };
        }),
    ];
    return { date, items, open: items.filter((i) => !i.done).length };
  }

  /**
   * "Qo'ng'iroq qilinganlar": oxirgi 30 kunda javob olingan arizalar (eng
   * yangisi tepada) — operator kimga qachon qo'ng'iroq qilinganini ko'radi.
   */
  async calledLeads(scope: TenantScope) {
    const branchId = requireOperationalScope(scope);
    const since = toDateOnly(addDays(todayTashkent(), -CALLED_LEADS_LOOKBACK_DAYS));
    const logs = await this.prisma.callLog.findMany({
      where: { kind: "LEAD", date: { gte: since }, branch: { organizationId: scope.organizationId } },
      select: { subjectId: true, date: true, note: true, calledByName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const answered = logs.filter((l) => !l.note?.startsWith(NO_ANSWER_PREFIX));
    // Bir arizaga bir necha marta qo'ng'iroq bo'lsa — eng oxirgisi
    const latest = new Map<string, (typeof answered)[number]>();
    for (const log of answered) if (!latest.has(log.subjectId)) latest.set(log.subjectId, log);
    if (latest.size === 0) return { items: [] };

    const leads = await this.prisma.lead.findMany({
      where: {
        id: { in: [...latest.keys()] },
        OR: [{ branchId }, { organizationId: scope.organizationId, source: "WEBSITE" }],
      },
      select: { id: true, childFullName: true, parentName: true, parentPhone: true, source: true, stage: true, createdAt: true },
    });
    const items = leads
      .map((l) => {
        const log = latest.get(l.id)!;
        return {
          leadId: l.id,
          title: l.childFullName || l.parentName,
          parentName: l.parentName,
          phone: l.parentPhone,
          source: l.source,
          stage: l.stage,
          appliedAt: l.createdAt,
          calledAt: log.createdAt,
          calledByName: log.calledByName,
          note: log.note,
        };
      })
      .sort((a, b) => b.calledAt.getTime() - a.calledAt.getTime());
    return { items };
  }

  async callDone(scope: TenantScope, actorName: string, dto: CallDoneDto) {
    const branchId = requireOperationalScope(scope);
    const date = toDateOnly(assertDate(dto.date.slice(0, 10)));
    const lead = dto.kind === "LEAD" ? await this.findLeadInOrg(scope, dto.subjectId) : null;
    await this.prisma.$transaction(async (tx) => {
      // Arizaga qo'ng'iroq filialdan qat'i nazar bitta — boshqa filial yozuvi ham almashtiriladi
      await tx.callLog.deleteMany({ where: { ...(lead ? {} : { branchId }), kind: dto.kind, subjectId: dto.subjectId, date } });
      await tx.callLog.create({
        data: { branchId, kind: dto.kind, subjectId: dto.subjectId, date, note: dto.note?.trim() || null, calledByName: actorName },
      });
      // Qo'ng'iroq CRM'dagi ariza tarixida ham ko'rinsin
      if (lead) {
        await tx.leadActivity.create({
          data: { leadId: lead.id, type: "CALL", note: dto.note?.trim() || null, createdByUserId: scope.userId },
        });
      }
    });
    return { success: true };
  }

  async callUndo(scope: TenantScope, dto: CallDoneDto) {
    const branchId = requireOperationalScope(scope);
    const date = toDateOnly(assertDate(dto.date.slice(0, 10)));
    const lead = dto.kind === "LEAD" ? await this.findLeadInOrg(scope, dto.subjectId) : null;
    await this.prisma.callLog.deleteMany({
      where: { ...(lead ? {} : { branchId }), kind: dto.kind, subjectId: dto.subjectId, date },
    });
    if (lead) {
      // Bekor qilingan qo'ng'iroq CRM tarixida qolmasin — shu kungi eng oxirgi CALL yozuvi
      const range = dayRange(dto.date.slice(0, 10), dto.date.slice(0, 10));
      const last = await this.prisma.leadActivity.findFirst({
        where: { leadId: lead.id, type: "CALL", createdAt: range },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (last) await this.prisma.leadActivity.delete({ where: { id: last.id } });
    }
    return { success: true };
  }

  private async findLeadInOrg(scope: TenantScope, leadId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId: scope.organizationId }, select: { id: true } });
    if (!lead) throw new NotFoundException("Ariza topilmadi");
    return lead;
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
    // Belgilashdagi kabi: o'qituvchi faqat o'z guruhidagi bola uchun bekor qiladi
    const child = await this.prisma.child.findFirst({ where: { id: childId, branchId }, select: { groupId: true } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);
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

    const [childrenCount, attendance, payments, debtors, leadsNew, leadsWon, staffAbs, groupRows] = await Promise.all([
      this.prisma.child.count({ where: { branchId, status: { not: "INACTIVE" } } }),
      this.prisma.attendance.findMany({
        where: { branchId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
        select: { date: true, status: true, childId: true, child: { select: { fullName: true, groupId: true } } },
      }),
      this.prisma.payment.findMany({ where: { branchId, paidAt: range, status: "COMPLETED" }, select: { amount: true } }),
      this.cashDesk.debtors(scope),
      this.prisma.lead.count({ where: { branchId, createdAt: range } }),
      this.prisma.lead.count({ where: { branchId, stage: "WON", updatedAt: range } }),
      this.prisma.employeeAttendance.count({ where: { branchId, date: { gte: toDateOnly(from), lte: toDateOnly(to) }, status: { in: ["ABSENT", "SICK", "ON_LEAVE"] } } }),
      this.prisma.group.findMany({
        where: { branchId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { children: { where: { status: { not: "INACTIVE" } } } } },
          teachers: { select: { employee: { select: { fullName: true } } } },
        },
      }),
    ]);

    const perDay = new Map(days.map((d) => [d, { date: d, present: 0, absent: 0, sick: 0 }]));
    const absentByChild = new Map<string, { name: string; days: number }>();
    // Guruhlar kesimida kunlik davomat: guruh -> kun -> son
    const perGroupDay = new Map<string, Map<string, { present: number; absent: number; sick: number }>>();
    for (const g of groupRows) {
      perGroupDay.set(g.id, new Map(days.map((d) => [d, { present: 0, absent: 0, sick: 0 }])));
    }
    for (const a of attendance) {
      const dayKey = a.date.toISOString().slice(0, 10);
      const row = perDay.get(dayKey);
      if (!row) continue;
      const groupDay = a.child.groupId ? perGroupDay.get(a.child.groupId)?.get(dayKey) : undefined;
      if (groupDay) {
        if (a.status === "PRESENT" || a.status === "LATE") groupDay.present += 1;
        else if (a.status === "ABSENT") groupDay.absent += 1;
        else if (a.status === "SICK") groupDay.sick += 1;
      }
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
      groups: groupRows.map((g) => ({
        id: g.id,
        name: g.name,
        childrenCount: g._count.children,
        teachers: g.teachers.map((t) => t.employee.fullName),
        daily: days.map((d) => ({ date: d, ...perGroupDay.get(g.id)!.get(d)! })),
      })),
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
