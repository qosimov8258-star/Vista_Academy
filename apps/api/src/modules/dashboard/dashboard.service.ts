import { Injectable } from "@nestjs/common";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

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
      this.prisma.organization.count(),
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

  private async calculateMrr(): Promise<Prisma.Decimal> {
    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });
    return activeSubs.reduce((sum, sub) => sum.add(sub.plan.priceMonthly), new Prisma.Decimal(0));
  }
}
