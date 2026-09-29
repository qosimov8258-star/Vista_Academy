import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { PaymentRemindersService, daysBetween, tashkentCurrentTime, tashkentTodayUtcMidnight } from "./payment-reminders.service";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** Cron har 5 daqiqada bir ishlaydi — aniq moslikni kafolatlash uchun ±2 daqiqalik tolerantlik. */
const MATCH_TOLERANCE_MINUTES = 2;
const MINUTES_PER_DAY = 24 * 60;

/**
 * Har 5 daqiqada barcha yoqilgan filial sozlamalarini tekshiradi: joriy
 * Toshkent vaqti `sendTimes`dagi biror qiymatga to'g'ri kelsa, o'sha
 * filialning eslatma oynasidagi to'lanmagan hisob-fakturalari uchun
 * `PaymentReminderDispatch` yozuvini yaratadi (faqat tarix/hisobot uchun —
 * tashqi xabar yuborilmaydi, ota-ona kabineti kartasi buni kutib turmaydi,
 * u har safar jonli hisoblanadi — `ParentService`ga qarang).
 */
@Injectable()
export class PaymentReminderCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReminderCronService.name);
  private intervalHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentRemindersService: PaymentRemindersService,
  ) {}

  onModuleInit() {
    this.intervalHandle = setInterval(() => {
      this.runCheck().catch((error) => this.logger.error("To'lov eslatmasi tekshiruvi xato berdi", error));
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  private async runCheck(): Promise<void> {
    const { hours, minutes } = tashkentCurrentTime();
    const currentMinutes = hours * 60 + minutes;
    const today = tashkentTodayUtcMidnight();

    const settingsList = await this.prisma.paymentReminderSettings.findMany({ where: { isEnabled: true } });

    for (const settings of settingsList) {
      const matchedSendTime = settings.sendTimes.find((sendTime) => matchesTolerance(sendTime, currentMinutes));
      if (!matchedSendTime) continue;

      const invoices = await this.paymentRemindersService.findUnpaidInvoices(settings.organizationId, settings.branchId, {
        daysBeforeDue: settings.daysBeforeDue,
        daysAfterDue: settings.daysAfterDue,
      });

      for (const invoice of invoices) {
        const remainingAmount = Math.max(
          0,
          Number(invoice.amount) - Number(invoice.discountAmount) - Number(invoice.paidAmount),
        );
        const message = this.paymentRemindersService.renderMessage(settings.messageTemplate, {
          childName: invoice.child.fullName,
          amount: remainingAmount,
          dueDate: invoice.dueDate,
          daysLeft: daysBetween(today, invoice.dueDate),
        });

        try {
          await this.prisma.paymentReminderDispatch.create({
            data: {
              organizationId: settings.organizationId,
              branchId: settings.branchId,
              childId: invoice.child.id,
              invoiceId: invoice.id,
              sendTime: matchedSendTime,
              dispatchDate: today,
              message,
            },
          });
        } catch {
          // `@@unique([invoiceId, sendTime, dispatchDate])` — bugun shu slot uchun
          // allaqachon yaratilgan, e'tiborsiz qoldiramiz.
        }
      }
    }
  }
}

/** "HH:mm" qiymati joriy vaqtga (daqiqada) ±MATCH_TOLERANCE_MINUTES ichida keladimi — kun chegarasi (23:59 -> 00:00) hisobga olinadi. */
function matchesTolerance(sendTime: string, currentMinutes: number): boolean {
  const [h, m] = sendTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const targetMinutes = h * 60 + m;
  const diff = Math.abs(currentMinutes - targetMinutes);
  return Math.min(diff, MINUTES_PER_DAY - diff) <= MATCH_TOLERANCE_MINUTES;
}
