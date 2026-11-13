import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import ExcelJS from "exceljs";
import { CHILD_RESULT_PAGES, PARENT_PAGES } from "../parent/parent-activity.constants";
import { dayLabel, dayOf, excelKit, generatedStamp, reportFile, timeOf, weekday, type ReportHead, type ReportTheme } from "../cash-desk/report-kit";

const REPORT_THEME: ReportTheme = { accent: "#8944ab", light: "#f3e8fa" };
const LEVEL_UZ: Record<EngagementLevel, string> = {
  ACTIVE: "Faol",
  LOW: "Kam faol",
  INACTIVE: "Nofaol",
  UNCONNECTED: "Kabinet ochilmagan",
};
const LEVEL_COLOR: Record<EngagementLevel, string> = {
  ACTIVE: "FF248A3D",
  LOW: "FFC93400",
  INACTIVE: "FFD70015",
  UNCONNECTED: "FF8E8E93",
};
const PAGE_UZ: Record<string, string> = {
  home: "Bosh sahifa (bolaning kuni)",
  kundalik: "Kundalik",
  jadval: "Jadval",
  fayllar: "Fayllar",
  tolov: "To'lov",
  dokon: "Do'kon",
  foydali: "Foydali",
  xabarlar: "Xabarlar",
  sozlamalar: "Sozlamalar",
  tanlash: "Farzand tanlash",
};
const RELATION_UZ: Record<string, string> = { MOTHER: "onasi", FATHER: "otasi", GRANDPARENT: "buvi/bobo", OTHER: "vasiy" };
const minutes = (sec: number) => Math.round(sec / 60);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** O'zbekiston vaqti (UTC+5, yozgi vaqt yo'q) — «bugun» va kunlik grafik shu bo'yicha. */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Ikki ko'rish orasida shundan ko'p tanaffus bo'lsa — yangi «kirish» (seans) hisoblanadi. */
const VISIT_GAP_MS = 30 * 60 * 1000;

/** Faollik darajasi: oxirgi ko'ringan vaqtiga qarab. */
export type EngagementLevel = "ACTIVE" | "LOW" | "INACTIVE" | "UNCONNECTED";
const ACTIVE_WITHIN_DAYS = 3;
const LOW_WITHIN_DAYS = 14;

const ALLOWED_ROLES = new Set(["NETWORK_ADMIN", "BRANCH_ADMIN", "MANAGER"]);

/** Bugungi kun boshi (Toshkent vaqti) UTC da. */
function startOfLocalDay(date: Date): Date {
  return new Date(Math.floor((date.getTime() + TZ_OFFSET_MS) / DAY_MS) * DAY_MS - TZ_OFFSET_MS);
}

/** "YYYY-MM-DD" (Toshkent vaqti) */
function localDateKey(date: Date): string {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function levelOf(connected: boolean, lastActivity: Date | null, now: Date): EngagementLevel {
  if (!connected) return "UNCONNECTED";
  if (!lastActivity) return "INACTIVE";
  const days = (now.getTime() - lastActivity.getTime()) / DAY_MS;
  if (days <= ACTIVE_WITHIN_DAYS) return "ACTIVE";
  if (days <= LOW_WITHIN_DAYS) return "LOW";
  return "INACTIVE";
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

type ViewTotalsRow = {
  guardian_id: string;
  today: number | null;
  week: number | null;
  month: number | null;
  active_days: number | null;
  result_views: number | null;
  last_seen: Date | null;
};

/**
 * Panelning «Ota-onalar» bo'limi: ota-onalar kabinetdan qanchalik
 * foydalanayotgani — kabinet ochilganmi, oxirgi marta qachon kirgan, kun,
 * hafta, oy davomida necha daqiqa, bolasining kuni va natijalarini
 * ko'ryaptimi, xabarlarni o'qiyaptimi, bildirishnoma yoqilganmi.
 *
 * Ma'lumot `GuardianPageView` (kabinet faolligi), `Guardian.lastLoginAt`,
 * push obunalari va xabar o'qilganligidan yig'iladi. Filial xodimi faqat
 * o'z filialidagi bolalarning ota-onalarini ko'radi.
 */
@Injectable()
export class ParentEngagementService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(user: TenantAuthenticatedUser, requestedBranchId?: string) {
    if (!ALLOWED_ROLES.has(user.role)) {
      throw new ForbiddenException("Bu bo'lim faqat rahbariyat uchun");
    }
    const branchId = user.branchId ?? (requestedBranchId || null);
    const childWhere: Prisma.ChildWhereInput = {
      status: { not: "INACTIVE" },
      ...(branchId ? { branchId } : {}),
    };
    const guardianWhere: Prisma.GuardianWhereInput = {
      organizationId: user.organizationId,
      isActive: true,
      children: { some: { child: childWhere } },
    };
    return { organizationId: user.organizationId, childWhere, guardianWhere };
  }

  /** Ro'yxat + umumiy ko'rsatkichlar + kunlik grafik + eng ko'p ko'rilgan bo'limlar. */
  async overview(user: TenantAuthenticatedUser, branchId?: string) {
    const { organizationId, childWhere, guardianWhere } = this.scope(user, branchId);
    const now = new Date();
    const today = startOfLocalDay(now);
    const week = new Date(today.getTime() - 6 * DAY_MS);
    const month = new Date(today.getTime() - 29 * DAY_MS);
    const fortnight = new Date(today.getTime() - 13 * DAY_MS);

    const guardians = await this.prisma.guardian.findMany({
      where: guardianWhere,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        passwordHash: true,
        lastLoginAt: true,
        children: {
          where: { child: childWhere },
          select: {
            relation: true,
            child: { select: { id: true, fullName: true, group: { select: { name: true } }, branch: { select: { name: true } } } },
          },
        },
        _count: { select: { pushSubscriptions: true } },
      },
    });
    const ids = guardians.map((g) => g.id);

    const [totals, unread, received, daily, pages] = ids.length
      ? await Promise.all([
          this.prisma.$queryRaw<ViewTotalsRow[]>`
            SELECT guardian_id,
              SUM(duration_sec) FILTER (WHERE started_at >= ${today})::int AS today,
              SUM(duration_sec) FILTER (WHERE started_at >= ${week})::int AS week,
              SUM(duration_sec) FILTER (WHERE started_at >= ${month})::int AS month,
              COUNT(DISTINCT ((started_at + interval '5 hours')::date)) FILTER (WHERE started_at >= ${month})::int AS active_days,
              COUNT(*) FILTER (WHERE started_at >= ${month} AND page IN (${Prisma.join([...CHILD_RESULT_PAGES])}))::int AS result_views,
              MAX(last_seen_at) AS last_seen
            FROM guardian_page_views
            WHERE organization_id = ${organizationId} AND guardian_id IN (${Prisma.join(ids)})
            GROUP BY guardian_id`,
          this.prisma.broadcastRecipient.groupBy({
            by: ["guardianId"],
            where: { guardianId: { in: ids }, readAt: null },
            _count: { _all: true },
          }),
          this.prisma.broadcastRecipient.findMany({
            where: { guardianId: { in: ids }, createdAt: { gte: month } },
            select: { readAt: true },
          }),
          this.prisma.$queryRaw<{ day: string; guardians: number; seconds: number }[]>`
            SELECT to_char((started_at + interval '5 hours')::date, 'YYYY-MM-DD') AS day,
              COUNT(DISTINCT guardian_id)::int AS guardians,
              COALESCE(SUM(duration_sec), 0)::int AS seconds
            FROM guardian_page_views
            WHERE organization_id = ${organizationId} AND guardian_id IN (${Prisma.join(ids)}) AND started_at >= ${fortnight}
            GROUP BY 1`,
          this.prisma.$queryRaw<{ page: string; views: number; seconds: number; guardians: number }[]>`
            SELECT page, COUNT(*)::int AS views, COALESCE(SUM(duration_sec), 0)::int AS seconds,
              COUNT(DISTINCT guardian_id)::int AS guardians
            FROM guardian_page_views
            WHERE organization_id = ${organizationId} AND guardian_id IN (${Prisma.join(ids)}) AND started_at >= ${month}
            GROUP BY page`,
        ])
      : [[], [], [], [], []];

    const totalsById = new Map(totals.map((t) => [t.guardian_id, t]));
    const unreadById = new Map(unread.map((u) => [u.guardianId, u._count._all]));

    const items = guardians.map((g) => {
      const t = totalsById.get(g.id);
      const connected = !!g.passwordHash;
      const lastSeenAt = t?.last_seen ?? null;
      const lastActivity = maxDate(lastSeenAt, g.lastLoginAt);
      return {
        id: g.id,
        fullName: g.fullName,
        phone: g.phone,
        connected,
        level: levelOf(connected, lastActivity, now),
        lastLoginAt: g.lastLoginAt,
        lastActivityAt: lastActivity,
        secondsToday: t?.today ?? 0,
        secondsWeek: t?.week ?? 0,
        secondsMonth: t?.month ?? 0,
        activeDays30: t?.active_days ?? 0,
        resultViews30: t?.result_views ?? 0,
        pushEnabled: g._count.pushSubscriptions > 0,
        unreadMessages: unreadById.get(g.id) ?? 0,
        children: g.children.map((c) => ({
          id: c.child.id,
          fullName: c.child.fullName,
          relation: c.relation,
          groupName: c.child.group?.name ?? null,
          branchName: c.child.branch?.name ?? null,
        })),
      };
    });

    const count = (pred: (i: (typeof items)[number]) => boolean) => items.filter(pred).length;
    const dayMap = new Map(daily.map((d) => [d.day, d]));
    const dailySeries = Array.from({ length: 14 }, (_, i) => {
      const key = localDateKey(new Date(fortnight.getTime() + i * DAY_MS));
      const row = dayMap.get(key);
      return { date: key, guardians: row?.guardians ?? 0, seconds: row?.seconds ?? 0 };
    });
    const pageOrder = new Map(PARENT_PAGES.map((p, i) => [p as string, i]));
    const readCount = received.filter((r) => r.readAt).length;
    const weekActive = items.filter((i) => i.secondsWeek > 0);

    return {
      summary: {
        total: items.length,
        connected: count((i) => i.connected),
        activeToday: count((i) => i.secondsToday > 0 || (!!i.lastLoginAt && i.lastLoginAt >= today)),
        active7: count((i) => !!i.lastActivityAt && i.lastActivityAt >= week),
        active30: count((i) => !!i.lastActivityAt && i.lastActivityAt >= month),
        levels: {
          ACTIVE: count((i) => i.level === "ACTIVE"),
          LOW: count((i) => i.level === "LOW"),
          INACTIVE: count((i) => i.level === "INACTIVE"),
          UNCONNECTED: count((i) => i.level === "UNCONNECTED"),
        },
        pushEnabled: count((i) => i.pushEnabled),
        followingChild30: count((i) => i.resultViews30 > 0),
        secondsToday: items.reduce((s, i) => s + i.secondsToday, 0),
        secondsWeek: items.reduce((s, i) => s + i.secondsWeek, 0),
        secondsMonth: items.reduce((s, i) => s + i.secondsMonth, 0),
        avgSecondsPerActiveWeek: weekActive.length
          ? Math.round(weekActive.reduce((s, i) => s + i.secondsWeek, 0) / weekActive.length)
          : 0,
        messagesReceived30: received.length,
        messagesRead30: readCount,
      },
      daily: dailySeries,
      pages: pages
        .map((p) => ({ page: p.page, views: p.views, seconds: p.seconds, guardians: p.guardians }))
        .sort((a, b) => b.seconds - a.seconds || (pageOrder.get(a.page) ?? 99) - (pageOrder.get(b.page) ?? 99)),
      guardians: items,
    };
  }

  /**
   * Excel hisobot — ekrandagi ma'lumotning o'zi (oxirgi 30 kun): umumiy
   * ko'rsatkichlar va har ota-ona bo'yicha bitta qator, bo'limlar, kunlar.
   * Boshqa hisobotlar bilan bir xil ko'rinishda (cash-desk/report-kit).
   */
  async report(user: TenantAuthenticatedUser, branchId?: string) {
    const data = await this.overview(user, branchId);
    const effectiveBranchId = user.branchId ?? (branchId || null);
    const [org, branch] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { name: true } }),
      effectiveBranchId ? this.prisma.branch.findFirst({ where: { id: effectiveBranchId, organizationId: user.organizationId }, select: { name: true } }) : null,
    ]);
    const today = dayOf(new Date());
    const monthStart = dayOf(new Date(Date.now() - 29 * DAY_MS));
    const d: ReportHead = {
      organization: org.name,
      branch: branch?.name ?? "Barcha filiallar",
      periodLabel: `Oxirgi 30 kun: ${dayLabel(monthStart, false)} — ${dayLabel(today)}`,
      generatedAt: generatedStamp(),
      generatedBy: user.fullName,
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = d.generatedBy;
    wb.created = new Date();
    const { head, totalRow, titleBlock, section, zebra } = excelKit(d, REPORT_THEME);
    const s = data.summary;
    const g = data.guardians;
    const sumOf = (k: "secondsToday" | "secondsWeek" | "secondsMonth") => g.reduce((acc, x) => acc + x[k], 0);

    // 1. Umumiy
    const ws = wb.addWorksheet("Umumiy");
    const cols = ["№", "Ota-ona", "Telefon", "Farzandi", "Holati", "Oxirgi faollik", "Bugun (daq)", "7 kun (daq)", "30 kun (daq)", "Faol kunlar", "Bolasini ko'rdi", "Bildirishnoma", "O'qilmagan xabar"];
    ws.columns = [5, 28, 16, 34, 18, 17, 11, 11, 12, 11, 13, 13, 13].map((width) => ({ width }));
    titleBlock(ws, "Ota-onalar faolligi", cols.length);
    const info = (items: [string, string][], big: string) => {
      for (const [k, v] of items) {
        const r = ws.addRow([k, "", "", v]);
        ws.mergeCells(r.number, 1, r.number, 3);
        ws.mergeCells(r.number, 4, r.number, cols.length);
        r.getCell(1).font = { color: { argb: "FF6D6D72" } };
        r.getCell(4).font = { bold: true, size: k === big ? 14 : 11 };
        r.getCell(4).alignment = { horizontal: "left" };
      }
    };
    info(
      [
        ["Davr", d.periodLabel],
        ["Ota-onalar", `${s.total} ta`],
        ["Kabinet ochilgan", `${s.connected} ta (${pct(s.connected, s.total)}%)`],
        ["Bu hafta kirgan", `${s.active7} ta (ulanganlarning ${pct(s.active7, s.connected)}%)`],
        ["Bugun kirgan", `${s.activeToday} ta`],
        ["Faol / kam faol / nofaol / ochilmagan", `${s.levels.ACTIVE} / ${s.levels.LOW} / ${s.levels.INACTIVE} / ${s.levels.UNCONNECTED}`],
        ["Bildirishnoma yoqilgan", `${s.pushEnabled} ta`],
        ["Bolasini kuzatadi (30 kun)", `${s.followingChild30} ta`],
        ["Xabarlar o'qilishi (30 kun)", `${s.messagesRead30} / ${s.messagesReceived30} (${pct(s.messagesRead30, s.messagesReceived30)}%)`],
        ["Kabinetda jami vaqt (30 kun)", `${minutes(s.secondsMonth)} daqiqa`],
        ["O'rtacha vaqt", `haftasiga ${minutes(s.avgSecondsPerActiveWeek)} daqiqa (bitta faol ota-ona)`],
        ["Tuzildi", `${d.generatedAt} · ${d.generatedBy}`],
      ],
      "Bu hafta kirgan",
    );
    ws.addRow([]);
    section(ws, "Ota-onalar bo'yicha");
    const headerRow = ws.addRow(cols);
    head(headerRow);
    const order: Record<EngagementLevel, number> = { ACTIVE: 0, LOW: 1, INACTIVE: 2, UNCONNECTED: 3 };
    const sorted = [...g].sort(
      (a, b) =>
        order[a.level] - order[b.level] ||
        (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0) ||
        a.fullName.localeCompare(b.fullName),
    );
    sorted.forEach((x, i) => {
      const kids = x.children
        .map((c) => `${c.fullName}${c.groupName ? ` (${c.groupName})` : ""}`)
        .join(", ");
      const relation = x.children[0] ? `${RELATION_UZ[x.children[0].relation] ?? ""}: ` : "";
      const row = ws.addRow([
        i + 1,
        x.fullName,
        x.phone,
        `${relation}${kids}`,
        LEVEL_UZ[x.level],
        x.lastActivityAt ? `${dayOf(x.lastActivityAt).split("-").reverse().join(".")} ${timeOf(x.lastActivityAt)}` : "—",
        minutes(x.secondsToday) || null,
        minutes(x.secondsWeek) || null,
        minutes(x.secondsMonth) || null,
        x.activeDays30 || null,
        x.resultViews30 || null,
        x.connected ? (x.pushEnabled ? "Yoqilgan" : "O'chiq") : "—",
        x.unreadMessages || null,
      ]);
      row.getCell(5).font = { bold: true, color: { argb: LEVEL_COLOR[x.level] } };
      [5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((c) => (row.getCell(c).alignment = { horizontal: "center" }));
      zebra(row, i);
    });
    const tr = ws.addRow([
      "",
      "Jami",
      `${g.length} ta`,
      "",
      `${s.levels.ACTIVE} ta faol`,
      "",
      minutes(sumOf("secondsToday")),
      minutes(sumOf("secondsWeek")),
      minutes(sumOf("secondsMonth")),
      "",
      g.reduce((acc, x) => acc + x.resultViews30, 0),
      `${s.pushEnabled} ta`,
      g.reduce((acc, x) => acc + x.unreadMessages, 0),
    ]);
    [5, 7, 8, 9, 11, 12, 13].forEach((c) => (tr.getCell(c).alignment = { horizontal: "center" }));
    totalRow(tr);
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: cols.length } };

    // 2. Bo'limlar — kabinetda nimalar ko'riladi
    const wp = wb.addWorksheet("Bo'limlar");
    const pcols = ["№", "Bo'lim", "Ota-onalar", "Ochilgan (marta)", "Vaqt (daq)"];
    wp.columns = [5, 30, 12, 16, 12].map((width) => ({ width }));
    titleBlock(wp, "Kabinetda nimalar ko'riladi", pcols.length);
    head(wp.addRow(pcols));
    data.pages.forEach((p, i) => {
      const row = wp.addRow([i + 1, PAGE_UZ[p.page] ?? p.page, p.guardians, p.views, minutes(p.seconds)]);
      [3, 4, 5].forEach((c) => (row.getCell(c).alignment = { horizontal: "center" }));
      zebra(row, i);
    });
    const pt = wp.addRow(["", "Jami", "", data.pages.reduce((a, p) => a + p.views, 0), minutes(data.pages.reduce((a, p) => a + p.seconds, 0))]);
    [4, 5].forEach((c) => (pt.getCell(c).alignment = { horizontal: "center" }));
    totalRow(pt);

    // 3. Kunlar — oxirgi 14 kun
    const wd = wb.addWorksheet("Kunlar");
    const dcols = ["Sana", "Hafta kuni", "Kirgan ota-onalar", "Vaqt (daq)"];
    wd.columns = [18, 14, 18, 12].map((width) => ({ width }));
    titleBlock(wd, "Kunlik faollik (14 kun)", dcols.length);
    head(wd.addRow(dcols));
    data.daily.forEach((x, i) => {
      const row = wd.addRow([dayLabel(x.date), weekday(x.date), x.guardians, minutes(x.seconds)]);
      [3, 4].forEach((c) => (row.getCell(c).alignment = { horizontal: "center" }));
      zebra(row, i);
    });

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return reportFile(buffer, "ota-onalar-faolligi", today, "xlsx");
  }

  /** Bitta ota-ona: kunlik daqiqalar, bo'limlar, oxirgi ko'rganlari, qurilmalar, xabarlar. */
  async detail(user: TenantAuthenticatedUser, guardianId: string, branchId?: string) {
    const { childWhere, guardianWhere } = this.scope(user, branchId);
    const guardian = await this.prisma.guardian.findFirst({
      where: { ...guardianWhere, id: guardianId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        passwordHash: true,
        lastLoginAt: true,
        createdAt: true,
        children: {
          where: { child: childWhere },
          select: {
            relation: true,
            canReceiveNotifications: true,
            child: {
              select: { id: true, fullName: true, publicId: true, group: { select: { name: true } }, branch: { select: { name: true } } },
            },
          },
        },
        pushSubscriptions: { select: { userAgent: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!guardian) {
      throw new NotFoundException("Ota-ona topilmadi");
    }

    const now = new Date();
    const today = startOfLocalDay(now);
    const week = new Date(today.getTime() - 6 * DAY_MS);
    const month = new Date(today.getTime() - 29 * DAY_MS);
    const ninety = new Date(today.getTime() - 89 * DAY_MS);

    const [views, lastView, sessions, inbox, unread, receipts] = await Promise.all([
      this.prisma.guardianPageView.findMany({
        where: { guardianId: guardian.id, startedAt: { gte: month } },
        orderBy: { startedAt: "desc" },
        select: { id: true, page: true, startedAt: true, lastSeenAt: true, durationSec: true, child: { select: { id: true, fullName: true } } },
      }),
      this.prisma.guardianPageView.findFirst({
        where: { guardianId: guardian.id },
        orderBy: { lastSeenAt: "desc" },
        select: { lastSeenAt: true },
      }),
      this.prisma.guardianRefreshToken.findMany({
        where: { guardianId: guardian.id, createdAt: { gte: ninety } },
        orderBy: { createdAt: "desc" },
        select: { userAgent: true, createdAt: true },
      }),
      this.prisma.broadcastRecipient.findMany({
        where: { guardianId: guardian.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { readAt: true, createdAt: true, broadcast: { select: { title: true, isMandatory: true } } },
      }),
      this.prisma.broadcastRecipient.count({ where: { guardianId: guardian.id, readAt: null } }),
      this.prisma.paymentReceipt.findMany({
        where: { guardianId: guardian.id, createdAt: { gte: ninety } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, status: true },
      }),
    ]);

    const sum = (from: Date) => views.filter((v) => v.startedAt >= from).reduce((s, v) => s + v.durationSec, 0);

    // Kunlik daqiqalar (30 kun) va soatlar bo'yicha taqsimot (qaysi vaqtda kiradi)
    const perDay = new Map<string, number>();
    const hours = Array.from({ length: 24 }, () => 0);
    for (const v of views) {
      const key = localDateKey(v.startedAt);
      perDay.set(key, (perDay.get(key) ?? 0) + v.durationSec);
      hours[new Date(v.startedAt.getTime() + TZ_OFFSET_MS).getUTCHours()] += Math.max(v.durationSec, 1);
    }
    const daily = Array.from({ length: 30 }, (_, i) => {
      const key = localDateKey(new Date(month.getTime() + i * DAY_MS));
      return { date: key, seconds: perDay.get(key) ?? 0 };
    });

    // Bo'limlar
    const pageStats = new Map<string, { page: string; views: number; seconds: number; lastAt: Date }>();
    for (const v of views) {
      const cur = pageStats.get(v.page);
      if (cur) {
        cur.views += 1;
        cur.seconds += v.durationSec;
        if (v.startedAt > cur.lastAt) cur.lastAt = v.startedAt;
      } else {
        pageStats.set(v.page, { page: v.page, views: 1, seconds: v.durationSec, lastAt: v.startedAt });
      }
    }

    // Kirishlar (seanslar): ko'rishlar orasida 30 daqiqadan ko'p tanaffus — yangi kirish
    const asc = [...views].reverse();
    let visits = 0;
    let prevEnd = 0;
    for (const v of asc) {
      if (!visits || v.startedAt.getTime() - prevEnd > VISIT_GAP_MS) visits += 1;
      prevEnd = Math.max(prevEnd, v.lastSeenAt.getTime());
    }
    const monthSeconds = sum(month);

    // Qurilmalar: bir xil brauzer bir marta, oxirgi kirish vaqti bilan
    const devices = new Map<string, { userAgent: string | null; lastAt: Date; logins: number }>();
    for (const s of sessions) {
      const key = s.userAgent ?? "";
      const cur = devices.get(key);
      if (cur) cur.logins += 1;
      else devices.set(key, { userAgent: s.userAgent, lastAt: s.createdAt, logins: 1 });
    }

    const connected = !!guardian.passwordHash;
    const lastSeenAt = lastView?.lastSeenAt ?? null;
    const lastActivity = maxDate(lastSeenAt, guardian.lastLoginAt);
    const resultViews = views.filter((v) => (CHILD_RESULT_PAGES as readonly string[]).includes(v.page));

    return {
      guardian: {
        id: guardian.id,
        fullName: guardian.fullName,
        phone: guardian.phone,
        connected,
        level: levelOf(connected, lastActivity, now),
        lastLoginAt: guardian.lastLoginAt,
        lastActivityAt: lastActivity,
        createdAt: guardian.createdAt,
      },
      children: guardian.children.map((c) => ({
        id: c.child.id,
        fullName: c.child.fullName,
        publicId: c.child.publicId,
        relation: c.relation,
        groupName: c.child.group?.name ?? null,
        branchName: c.child.branch?.name ?? null,
        receivesNotifications: c.canReceiveNotifications,
      })),
      stats: {
        secondsToday: sum(today),
        secondsWeek: sum(week),
        secondsMonth: monthSeconds,
        activeDays30: perDay.size,
        visits30: visits,
        avgVisitSeconds: visits ? Math.round(monthSeconds / visits) : 0,
        resultViews30: resultViews.length,
        lastResultViewAt: resultViews[0]?.startedAt ?? null,
      },
      daily,
      hours,
      pages: [...pageStats.values()].sort((a, b) => b.seconds - a.seconds || b.views - a.views),
      recent: views.slice(0, 40).map((v) => ({
        id: v.id,
        page: v.page,
        childName: v.child?.fullName ?? null,
        startedAt: v.startedAt,
        durationSec: v.durationSec,
      })),
      devices: [...devices.values()].slice(0, 6),
      push: guardian.pushSubscriptions.map((p) => ({ userAgent: p.userAgent, createdAt: p.createdAt })),
      messages: {
        unread,
        recent: inbox.map((r) => ({
          title: r.broadcast.title,
          mandatory: r.broadcast.isMandatory,
          sentAt: r.createdAt,
          readAt: r.readAt,
        })),
      },
      receipts: {
        count90: receipts.length,
        lastAt: receipts[0]?.createdAt ?? null,
      },
    };
  }
}
