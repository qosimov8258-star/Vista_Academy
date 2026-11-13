import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { CHILD_RESULT_PAGES, PARENT_PAGES } from "../parent/parent-activity.constants";

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
