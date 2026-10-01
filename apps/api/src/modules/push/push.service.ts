import { Injectable, Logger } from "@nestjs/common";
import * as webpush from "web-push";
import { PrismaService } from "../../database/prisma.service";
import { SubscribePushDto } from "./dto/subscribe-push.dto";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Ota-ona kabineti uchun brauzer push (Web Push). Tashqi SMS/Telegram
 * provayder shart emas — kalit juftligi (`VAPID_*`) o'zimizda generatsiya
 * qilingan, Google/Mozilla push serverlariga to'g'ridan-to'g'ri yuboriladi.
 *
 * Kalitlar berilmagan bo'lsa (lokal `.env` to'ldirilmagan) xizmat jim
 * o'tkazib yuboradi — panel ishlashda davom etadi, faqat tashqi
 * bildirishnoma kelmaydi.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    this.configured = Boolean(publicKey && privateKey && subject);
    if (this.configured) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    } else {
      this.logger.warn("VAPID kalitlari sozlanmagan — push bildirishnoma o'chirilgan");
    }
  }

  getPublicKey(): string | null {
    return this.configured ? process.env.VAPID_PUBLIC_KEY! : null;
  }

  async subscribe(guardianId: string, dto: SubscribePushDto, userAgent?: string) {
    await this.prisma.guardianPushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { guardianId, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent },
      create: { guardianId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent },
    });
    return { success: true };
  }

  async unsubscribe(guardianId: string, endpoint: string) {
    await this.prisma.guardianPushSubscription.deleteMany({ where: { guardianId, endpoint } });
    return { success: true };
  }

  /** Bir nechta ota-onaga (va ularning har bir qurilmasiga) push yuboradi. Muvaffaqiyatsiz (muddati o'tgan) obunalar o'chiriladi. */
  async sendToGuardians(guardianIds: string[], payload: PushPayload): Promise<void> {
    if (!this.configured || guardianIds.length === 0) return;
    const subscriptions = await this.prisma.guardianPushSubscription.findMany({
      where: { guardianId: { in: guardianIds } },
    });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.guardianPushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else {
            this.logger.warn(`Push yuborilmadi (guardian=${sub.guardianId}): ${(error as Error).message}`);
          }
        }
      }),
    );
  }
}
