import { Injectable } from "@nestjs/common";
import { Prisma, SubscriptionStatus, WalletTransactionType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { periodRange } from "../dashboard/period-range";
import { isAutoRenewEnabled } from "./subscription-billing.service";
import type { BillingTransactionsQueryDto } from "./dto/billing-query.dto";

const DAY_MS = 24 * 60 * 60 * 1000;
const CSV_MAX_ROWS = 5000;
const TX_TYPE_LABEL: Record<WalletTransactionType, string> = {
  TOP_UP: "To'ldirish",
  SUBSCRIPTION_CHARGE: "Obuna to'lovi",
  REFUND: "Qaytarish",
  BONUS: "Bonus",
  ADJUSTMENT: "Tuzatish",
};

/** "Moliya" sahifasi: platforma bo'ylab tushum, yechimlar navbati va hamyon jurnali. */
@Injectable()
export class PlatformBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(now: Date = new Date()) {
    const month = periodRange("month", now);
    const thisMonth = { gte: month.start, lt: month.end };
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

    const [topUps, charges, balance, upcoming, overdue] = await Promise.all([
      this.prisma.walletTransaction.aggregate({ _sum: { amount: true }, _count: true, where: { type: "TOP_UP", createdAt: thisMonth } }),
      this.prisma.walletTransaction.aggregate({ _sum: { amount: true }, _count: true, where: { type: "SUBSCRIPTION_CHARGE", createdAt: thisMonth } }),
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.subscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { gt: now, lte: weekAhead }, organization: { status: "ACTIVE" } },
        select: { plan: { select: { priceMonthly: true } }, organization: { select: { wallet: { select: { balance: true } } } } },
      }),
      this.prisma.subscription.findMany({
        where: {
          OR: [
            { status: SubscriptionStatus.GRACE_PERIOD },
            // Billing to'xtatgan (qarang: SubscriptionBillingService.settle)
            { status: SubscriptionStatus.SUSPENDED, graceUntil: { not: null } },
          ],
        },
        select: { status: true, plan: { select: { priceMonthly: true } } },
      }),
    ]);

    const upcomingAmount = upcoming.reduce((sum, sub) => sum + Number(sub.plan.priceMonthly), 0);
    const upcomingShort = upcoming.filter(
      (sub) => Number(sub.organization.wallet?.balance ?? 0) < Number(sub.plan.priceMonthly),
    ).length;

    return {
      autoRenew: isAutoRenewEnabled(),
      month: { start: month.start, end: month.end },
      topUps: { amount: Number(topUps._sum.amount ?? 0), count: topUps._count },
      charges: { amount: Math.abs(Number(charges._sum.amount ?? 0)), count: charges._count },
      walletBalance: Number(balance._sum.balance ?? 0),
      upcomingWeek: { count: upcoming.length, amount: upcomingAmount, insufficient: upcomingShort },
      overdue: {
        grace: overdue.filter((sub) => sub.status === SubscriptionStatus.GRACE_PERIOD).length,
        suspended: overdue.filter((sub) => sub.status === SubscriptionStatus.SUSPENDED).length,
        amount: overdue.reduce((sum, sub) => sum + Number(sub.plan.priceMonthly), 0),
      },
    };
  }

  /** Yaqin `days` kunda yangilanadigan (va muddati o'tgan) obunalar — pul yetadimi. */
  async renewals(days: number, now: Date = new Date()) {
    const until = new Date(now.getTime() + days * DAY_MS);
    const subs = await this.prisma.subscription.findMany({
      where: {
        OR: [
          { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { lte: until } },
          { status: SubscriptionStatus.GRACE_PERIOD },
          { status: SubscriptionStatus.SUSPENDED, graceUntil: { not: null } },
        ],
        organization: { status: { not: "ARCHIVED" } },
      },
      orderBy: { currentPeriodEnd: "asc" },
      take: 200,
      select: {
        status: true,
        currentPeriodEnd: true,
        graceUntil: true,
        trialEndsAt: true,
        plan: { select: { name: true, priceMonthly: true } },
        organization: { select: { id: true, name: true, slug: true, status: true, wallet: { select: { balance: true } } } },
      },
    });
    return subs.map((sub) => {
      const price = Number(sub.plan.priceMonthly);
      const balance = Number(sub.organization.wallet?.balance ?? 0);
      return {
        organization: { id: sub.organization.id, name: sub.organization.name, slug: sub.organization.slug, status: sub.organization.status },
        plan: { name: sub.plan.name, priceMonthly: price },
        status: sub.status,
        periodEnd: sub.currentPeriodEnd,
        graceUntil: sub.graceUntil,
        trialEndsAt: sub.trialEndsAt,
        balance,
        enough: balance >= price,
      };
    });
  }

  async transactions(query: BillingTransactionsQueryDto) {
    const where = this.transactionsWhere(query);
    const [items, total, sums] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: transactionSelect,
      }),
      this.prisma.walletTransaction.count({ where }),
      this.prisma.walletTransaction.groupBy({ by: ["type"], where, _sum: { amount: true }, orderBy: { type: "asc" } }),
    ]);
    const totals: Partial<Record<WalletTransactionType, number>> = {};
    for (const row of sums) {
      totals[row.type] = Number((row._sum as { amount: Prisma.Decimal | null } | undefined)?.amount ?? 0);
    }
    return {
      data: items.map(toRow),
      meta: { page: query.page, limit: query.limit, total, totals },
    };
  }

  /** CSV (Excel'da ochiladi): BOM + nuqtali vergul — o'zbek/rus Excel sozlamasida ustunlar to'g'ri bo'linadi. */
  async transactionsCsv(query: BillingTransactionsQueryDto): Promise<string> {
    const items = await this.prisma.walletTransaction.findMany({
      where: this.transactionsWhere(query),
      orderBy: { createdAt: "desc" },
      take: CSV_MAX_ROWS,
      select: transactionSelect,
    });
    const escape = (value: string | number | null) => {
      const text = value === null ? "" : String(value);
      return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = ["Sana", "Bog'cha", "Manzil", "Turi", "Summa", "Balans", "Izoh", "Kiritgan"];
    const lines = items.map(toRow).map((row) =>
      [
        row.createdAt.toISOString().replace("T", " ").slice(0, 16),
        row.organization.name,
        row.organization.slug,
        TX_TYPE_LABEL[row.type],
        row.amount,
        row.balanceAfter,
        row.note,
        row.createdBy ?? "Tizim",
      ]
        .map(escape)
        .join(";"),
    );
    return "﻿" + [header.join(";"), ...lines].join("\n");
  }

  private transactionsWhere(query: BillingTransactionsQueryDto): Prisma.WalletTransactionWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lt: new Date(query.to) } : {}) } }
        : {}),
      ...(search
        ? {
            wallet: {
              organization: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { slug: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
    };
  }
}

const transactionSelect = {
  id: true,
  type: true,
  amount: true,
  balanceAfter: true,
  note: true,
  createdAt: true,
  createdByUser: { select: { fullName: true, login: true } },
  wallet: { select: { organization: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.WalletTransactionSelect;

function toRow(tx: Prisma.WalletTransactionGetPayload<{ select: typeof transactionSelect }>) {
  return {
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    balanceAfter: Number(tx.balanceAfter),
    note: tx.note,
    createdAt: tx.createdAt,
    createdBy: tx.createdByUser?.fullName || tx.createdByUser?.login || null,
    organization: tx.wallet.organization,
  };
}
