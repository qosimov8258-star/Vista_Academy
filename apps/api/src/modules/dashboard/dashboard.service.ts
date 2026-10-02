import { Injectable } from "@nestjs/common";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { AnalyticsPeriod } from "./dto/analytics-query.dto";
import { changePercent, lastMonthKeys, monthKeyStart, periodRange } from "./period-range";

/** Dashboard grafigi necha oyni ko'rsatadi. */
const REVENUE_MONTHS = 12;
/** Shuncha kun ichida tugaydigan obunalar "e'tibor talab qiladi". */
const EXPIRY_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalOrganizations,
      activeOrganizations,
      totalBranches,
      activeSubscriptions,
      graceSubscriptions,
      suspendedSubscriptions,
      walletBalanceAgg,
      recentOrganizations,
    ] = await this.prisma.$transaction([
      this.prisma.organization.count({ where: { status: { not: "ARCHIVED" } } }),
      this.prisma.organization.count({ where: { status: "ACTIVE" } }),
      this.prisma.branch.count(),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.GRACE_PERIOD } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.SUSPENDED } }),
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { branches: true, subscription: { include: { plan: true } } },
      }),
    ]);

    const mrr = await this.calculateMrr();

    return {
      totalOrganizations,
      activeOrganizations,
      totalBranches,
      activeSubscriptions,
      graceSubscriptions,
      suspendedSubscriptions,
      totalWalletBalance: walletBalanceAgg._sum.balance ?? new Prisma.Decimal(0),
      mrr,
      recentOrganizations,
    };
  }

  /**
   * Dashboard analitikasi: tanlangan kalendar davri (Toshkent vaqti) uchun
   * KPI'lar va oldingi davrga nisbatan o'zgarish, oylik tushum, muddati
   * tugayotgan obunalar va so'nggi hamyon amallari.
   *
   * "Tushum" — hamyonga kelib tushgan pul (TOP_UP): platforma hozircha
   * obuna haqini hamyondan avtomatik yechmaydi, shuning uchun haqiqiy
   * kelgan pul shu.
   */
  async getAnalytics(period: AnalyticsPeriod) {
    const now = new Date();
    const range = periodRange(period, now);
    const current = { gte: range.start, lt: range.end };
    const previous = { gte: range.previousStart, lt: range.start };
    const monthKeys = lastMonthKeys(REVENUE_MONTHS, now);

    const [
      revenueNow,
      revenuePrev,
      newOrgsNow,
      newOrgsPrev,
      activeChildren,
      childrenBefore,
      childrenNow,
      totalOrganizations,
      subscriptionsByStatus,
      plans,
      expiring,
      recentTransactions,
    ] = await Promise.all([
      this.prisma.walletTransaction.aggregate({ _sum: { amount: true }, where: { type: "TOP_UP", createdAt: current } }),
      this.prisma.walletTransaction.aggregate({ _sum: { amount: true }, where: { type: "TOP_UP", createdAt: previous } }),
      this.prisma.organization.count({ where: { createdAt: current } }),
      this.prisma.organization.count({ where: { createdAt: previous } }),
      this.prisma.child.count({ where: { status: "ACTIVE" } }),
      this.prisma.child.count({ where: { createdAt: { lt: range.start } } }),
      this.prisma.child.count({ where: { createdAt: current } }),
      this.prisma.organization.count({ where: { status: { not: "ARCHIVED" } } }),
      this.prisma.subscription.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
      this.prisma.plan.findMany({
        orderBy: { priceMonthly: "asc" },
        select: { id: true, name: true, priceMonthly: true, _count: { select: { subscriptions: true } } },
      }),
      this.prisma.subscription.findMany({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
          currentPeriodEnd: { lt: new Date(now.getTime() + EXPIRY_WINDOW_DAYS * DAY_MS) },
        },
        orderBy: { currentPeriodEnd: "asc" },
        take: 30,
        select: {
          status: true,
          currentPeriodEnd: true,
          graceUntil: true,
          plan: { select: { name: true, priceMonthly: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.walletTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          note: true,
          createdAt: true,
          createdByUser: { select: { fullName: true, login: true } },
          wallet: { select: { organization: { select: { id: true, name: true, slug: true } } } },
        },
      }),
    ]);

    const revenueRows = await this.prisma.$queryRaw<{ month: string; total: Prisma.Decimal | null }[]>`
      SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'), 'YYYY-MM') AS month,
             SUM(amount) AS total
      FROM wallet_transactions
      WHERE type = 'TOP_UP' AND created_at >= ${monthKeyStart(monthKeys[0])}
      GROUP BY 1
    `;
    const revenueByMonth = new Map(revenueRows.map((row) => [row.month, Number(row.total ?? 0)]));

    const revenueCurrent = Number(revenueNow._sum.amount ?? 0);
    const revenuePrevious = Number(revenuePrev._sum.amount ?? 0);
    const statusCount = (status: SubscriptionStatus) =>
      subscriptionsByStatus.find((row) => row.status === status)?._count._all ?? 0;
    const activeSubscriptions = statusCount(SubscriptionStatus.ACTIVE);
    const mrr = (await this.calculateMrr()).toNumber();

    return {
      period,
      range: { start: range.start, end: range.end },
      kpis: {
        revenue: { value: revenueCurrent, previous: revenuePrevious, changePct: changePercent(revenueCurrent, revenuePrevious) },
        activeChildren: {
          value: activeChildren,
          added: childrenNow,
          changePct: childrenBefore > 0 ? Math.round((childrenNow / childrenBefore) * 1000) / 10 : null,
        },
        newOrganizations: { value: newOrgsNow, previous: newOrgsPrev, changePct: changePercent(newOrgsNow, newOrgsPrev) },
        mrr: { value: mrr, activeSubscriptions },
      },
      revenueByMonth: monthKeys.map((month) => ({ month, total: revenueByMonth.get(month) ?? 0 })),
      subscriptions: {
        total: totalOrganizations,
        active: activeSubscriptions,
        grace: statusCount(SubscriptionStatus.GRACE_PERIOD),
        suspended: statusCount(SubscriptionStatus.SUSPENDED),
        cancelled: statusCount(SubscriptionStatus.CANCELLED),
        none: Math.max(0, totalOrganizations - subscriptionsByStatus.reduce((sum, row) => sum + row._count._all, 0)),
      },
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceMonthly: Number(plan.priceMonthly),
        subscribers: plan._count.subscriptions,
      })),
      expiring: expiring.map((sub) => ({
        organization: sub.organization,
        plan: { name: sub.plan.name, priceMonthly: Number(sub.plan.priceMonthly) },
        status: sub.status,
        periodEnd: sub.currentPeriodEnd,
        graceUntil: sub.graceUntil,
      })),
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        balanceAfter: Number(tx.balanceAfter),
        note: tx.note,
        createdAt: tx.createdAt,
        createdBy: tx.createdByUser?.fullName || tx.createdByUser?.login || null,
        organization: tx.wallet.organization,
      })),
    };
  }

  private async calculateMrr(): Promise<Prisma.Decimal> {
    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });
    return activeSubs.reduce((sum, sub) => sum.add(sub.plan.priceMonthly), new Prisma.Decimal(0));
  }
}
