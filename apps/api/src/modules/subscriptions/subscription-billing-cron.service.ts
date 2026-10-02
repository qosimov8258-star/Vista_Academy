import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SubscriptionBillingService, isAutoRenewEnabled } from "./subscription-billing.service";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Ishga tushgach biroz kutib birinchi tekshiruv — deploy paytida bazaga yuklama tushmasin. */
const FIRST_RUN_DELAY_MS = 60 * 1000;

/**
 * Har 15 daqiqada muddati tugagan obunalarni hisob-kitob qiladi (hamyondan
 * yechish → imtiyozli davr → to'xtatish). API bitta jarayonda ishlaydi
 * (pm2 fork); bir vaqtda ikkita tekshiruv ketmasligi uchun jarayon ichidagi
 * bayroq yetarli, har bir obuna esa baribir qatordan qulflanadi.
 */
@Injectable()
export class SubscriptionBillingCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionBillingCronService.name);
  private intervalHandle?: ReturnType<typeof setInterval>;
  private timeoutHandle?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(private readonly billing: SubscriptionBillingService) {}

  onModuleInit() {
    if (!isAutoRenewEnabled()) {
      this.logger.warn("Obunalarni avtomatik yangilash o'chiq — yoqish uchun SUBSCRIPTION_BILLING_CRON=on");
      return;
    }
    this.timeoutHandle = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    this.intervalHandle = setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.billing.runDue();
      if (result.checked > 0) {
        this.logger.log(
          `Obunalar: ${result.checked} ta tekshirildi — yangilandi ${result.renewed}, imtiyozli ${result.grace}, to'xtatildi ${result.suspended}`,
        );
      }
    } catch (error) {
      this.logger.error("Obuna billing tekshiruvi xato berdi", error as Error);
    } finally {
      this.running = false;
    }
  }
}
