import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, SubscriptionStatus, WalletTransactionType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

/** Muddat tugab, hamyonda pul yetmasa — shuncha kun panel ochiq qoladi. */
export const GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Avtomatik yangilash (cron) yoqilganmi. Standart — O'CHIQ: yoqilgan zahoti
 * muddati o'tgan va hamyoni bo'sh bog'chalar imtiyozli davrga, 7 kundan keyin
 * esa to'xtatishga o'tadi. Shuning uchun serverda ataylab
 * `SUBSCRIPTION_BILLING_CRON=on` qo'yiladi (hamyonlar tayyor bo'lgach).
 * Hamyon to'ldirilganda qayta ochish va operator tugmalari doim ishlaydi.
 */
export function isAutoRenewEnabled(): boolean {
  return process.env.SUBSCRIPTION_BILLING_CRON === "on";
}

export type SettleOutcome = "renewed" | "reactivated" | "grace" | "suspended" | "noop";

type Tx = Prisma.TransactionClient;

/** Oy qo'shish; 31-yanvar + 1 oy = 28/29-fevral (keyingi oyga "toshib" ketmaydi). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const fmt = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Platforma obunalarining pul tomoni: hamyondan oylik to'lovni yechish,
 * imtiyozli davr (GRACE_PERIOD) va to'xtatish.
 *
 * Hayot sikli:
 * - ACTIVE, muddat tugadi → hamyonda yetarli bo'lsa yechiladi va davr 1 oyga
 *   uzayadi; yetmasa → GRACE_PERIOD (7 kun, panel ochiq).
 * - GRACE_PERIOD → pul tushsa yechiladi (davr uzluksiz davom etadi);
 *   `graceUntil` o'tib ketsa → SUSPENDED (panel yopiladi).
 * - Billing to'xtatgan obuna (SUSPENDED + `graceUntil` bor) — hamyon
 *   to'ldirilganda pul yetsa qayta ochiladi, yangi davr SHU KUNDAN
 *   boshlanadi (yopiq turgan kunlar uchun pul olinmaydi). Operator qo'lda
 *   to'xtatgan obuna (`graceUntil` = null) avtomatik ochilmaydi.
 *
 * Har bir amal obuna va hamyon qatorlarini `FOR UPDATE` bilan qulflaydi —
 * cron, hamyon to'ldirish va operator tugmasi bir vaqtda kelsa ham ikki
 * marta yechilmaydi.
 */
@Injectable()
export class SubscriptionBillingService {
  private readonly logger = new Logger(SubscriptionBillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Muddati tugagan (yoki imtiyozi o'tgan) barcha obunalarni hisob-kitob qiladi. */
  async runDue(now: Date = new Date()) {
    const due = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD] },
        currentPeriodEnd: { lte: now },
        // To'xtatilgan/arxivlangan bog'chadan pul yechilmaydi
        organization: { status: "ACTIVE" },
      },
      select: { organizationId: true },
    });
    const outcomes: Record<SettleOutcome, number> = { renewed: 0, reactivated: 0, grace: 0, suspended: 0, noop: 0 };
    for (const { organizationId } of due) {
      try {
        outcomes[await this.settle(organizationId, now)] += 1;
      } catch (error) {
        this.logger.error(`Obunani hisob-kitob qilib bo'lmadi: ${organizationId}`, error as Error);
      }
    }
    return { checked: due.length, ...outcomes };
  }

  /**
   * Bitta bog'cha: muddat tugagan bo'lsa — yechish, imtiyozli davr yoki
   * to'xtatish; billing to'xtatgan bo'lsa va pul yetsa — qayta ochish.
   */
  async settle(organizationId: string, now: Date = new Date()): Promise<SettleOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await this.lockSubscription(tx, organizationId);
      if (!subscription || subscription.status === SubscriptionStatus.CANCELLED) return "noop";
      // Operator bog'chani to'xtatgan/arxivlagan — yopiq bog'chadan pul yechilmaydi
      if (subscription.organization.status !== "ACTIVE") return "noop";

      const billingSuspended = subscription.status === SubscriptionStatus.SUSPENDED && subscription.graceUntil !== null;
      const due = subscription.currentPeriodEnd <= now;
      if (subscription.status === SubscriptionStatus.SUSPENDED && !billingSuspended) return "noop";
      if (!due && !billingSuspended) return "noop";

      // Imtiyozli davrda ham xizmat ishlagan — davr uzluksiz davom etadi;
      // yopiq turgan bog'cha esa yangi davrni bugundan boshlaydi.
      const start = billingSuspended ? now : subscription.currentPeriodEnd;
      const end = addMonths(start, 1);
      const charged = await this.chargeWallet(tx, organizationId, subscription.plan.priceMonthly, {
        note: `${subscription.plan.name}: ${fmt(start)} – ${fmt(end)}`,
      });

      if (charged) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: start,
            currentPeriodEnd: end,
            graceUntil: null,
            trialEndsAt: subscription.trialEndsAt && subscription.trialEndsAt <= now ? null : subscription.trialEndsAt,
          },
        });
        return billingSuspended ? "reactivated" : "renewed";
      }

      if (billingSuspended) return "noop";
      if (subscription.status === SubscriptionStatus.ACTIVE) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.GRACE_PERIOD, graceUntil: new Date(now.getTime() + GRACE_DAYS * DAY_MS) },
        });
        return "grace";
      }
      if (subscription.status === SubscriptionStatus.GRACE_PERIOD && (!subscription.graceUntil || subscription.graceUntil <= now)) {
        await tx.subscription.update({
          where: { id: subscription.id },
          // graceUntil saqlanadi — "billing to'xtatgan" belgisi (qarang: settle)
          data: { status: SubscriptionStatus.SUSPENDED, graceUntil: subscription.graceUntil ?? now },
        });
        return "suspended";
      }
      return "noop";
    });
  }

  /**
   * Operator: obunani N oyga uzaytirish. `charge` — hamyondan yechiladi
   * (yetmasa xato), aks holda bepul (masalan, kompensatsiya). Davr hozirgi
   * muddat tugashidan (o'tib ketgan bo'lsa — bugundan) davom etadi.
   */
  async extend(organizationId: string, months: number, charge: boolean, operatorId: string, now: Date = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await this.lockSubscription(tx, organizationId);
      if (!subscription) throw new NotFoundException("Bu bog'cha uchun obuna topilmadi");

      const continues = subscription.currentPeriodEnd > now && subscription.status !== SubscriptionStatus.SUSPENDED;
      const start = continues ? subscription.currentPeriodEnd : now;
      const end = addMonths(start, months);
      if (charge) {
        const amount = subscription.plan.priceMonthly.mul(months);
        const ok = await this.chargeWallet(tx, organizationId, amount, {
          note: `${subscription.plan.name} × ${months} oy: ${fmt(start)} – ${fmt(end)}`,
          createdByUserId: operatorId,
        });
        if (!ok) throw new BadRequestException(`Hamyonda mablag' yetarli emas — kerak: ${amount.toFixed(0)} so'm`);
      }
      return tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          // Davr boshi faqat yangi davr ochilganda o'zgaradi
          ...(continues ? {} : { currentPeriodStart: now }),
          currentPeriodEnd: end,
          graceUntil: null,
        },
        include: { plan: true },
      });
    });
  }

  private async lockSubscription(tx: Tx, organizationId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM subscriptions WHERE organization_id = ${organizationId} FOR UPDATE
    `;
    if (rows.length === 0) return null;
    return tx.subscription.findUniqueOrThrow({
      where: { id: rows[0].id },
      include: { plan: true, organization: { select: { status: true } } },
    });
  }

  /** Hamyondan yechish; mablag' yetmasa false. Bepul tarif (0 so'm) — doim true, yozuv yaratilmaydi. */
  private async chargeWallet(
    tx: Tx,
    organizationId: string,
    amount: Prisma.Decimal,
    opts: { note: string; createdByUserId?: string },
  ): Promise<boolean> {
    if (amount.lessThanOrEqualTo(0)) return true;
    const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>`
      SELECT id, balance FROM wallets WHERE organization_id = ${organizationId} FOR UPDATE
    `;
    const wallet = rows[0];
    if (!wallet) return false;
    const balance = new Prisma.Decimal(wallet.balance);
    if (balance.lessThan(amount)) return false;
    const balanceAfter = balance.sub(amount);
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.SUBSCRIPTION_CHARGE,
        amount: amount.negated(),
        balanceAfter,
        note: opts.note,
        createdByUserId: opts.createdByUserId,
      },
    });
    return true;
  }
}
