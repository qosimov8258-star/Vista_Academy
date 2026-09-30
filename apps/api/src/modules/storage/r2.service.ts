import { randomUUID } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2Config, r2Config } from "./r2-config";

/**
 * Cloudflare R2 (S3-mos) bilan ishlash. Har bir chaqiruvchi avval `enabled`ni
 * tekshirishi kerak — o'chirilgan holatda boshqa metodlar xato tashlaydi.
 */
@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly config: R2Config | null;
  private readonly client: S3Client | null;

  constructor() {
    this.config = r2Config();
    this.client = this.config
      ? new S3Client({
          region: "auto",
          endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
          forcePathStyle: true,
          credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          },
          // R2 AWS SDK v3'ning yangi sukut checksum sarlavhalarini to'liq qo'llab-quvvatlamaydi.
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
        })
      : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  private requireClient(): { client: S3Client; config: R2Config } {
    if (!this.client || !this.config) {
      throw new Error("R2 sozlanmagan — chaqiruvchi avval `enabled`ni tekshirishi kerak");
    }
    return { client: this.client, config: this.config };
  }

  /** `<prefix><organizationId>/<tur>/<uuid>` — taxmin qilib bo'lmaydigan obyekt kaliti. */
  buildKey(organizationId: string, type: string): string {
    const { config } = this.requireClient();
    return `${config.keyPrefix}${organizationId}/${type}/${randomUUID()}`;
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const { client, config } = this.requireClient();
    await client.send(new PutObjectCommand({ Bucket: config.bucketName, Key: key, Body: buffer, ContentType: contentType }));
  }

  async getPresignedReadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const { client, config } = this.requireClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucketName, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  /** Brauzer bo'lmagan o'quvchilar uchun (Face ID terminal agenti) — bayt serverda o'qiladi, redirect qilinmaydi. */
  async getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType?: string }> {
    const { client, config } = this.requireClient();
    const result = await client.send(new GetObjectCommand({ Bucket: config.bucketName, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`R2 obyekti bo'sh yoki topilmadi: ${key}`);
    }
    return { buffer: Buffer.from(bytes), contentType: result.ContentType };
  }

  /**
   * Eng yaxshi urinish — hech qachon otilmaydi (rasm/fayl o'chirish
   * foydalanuvchi uchun muvaffaqiyatli ko'rinishi kerak). Boshqa metodlardan
   * farqli o'laroq `enabled`ni o'zi tekshiradi: chaqiruvchi bazadan o'qigan
   * eski `*Key` R2 avval yoqilgan paytda yozilgan bo'lishi mumkin — keyinroq
   * R2 o'chirilgan bo'lsa ham (masalan sozlamalar olib tashlansa), tozalash
   * urinishi jim tarzda o'tkazib yuborilishi kerak, `requireClient()` xatosi
   * bilan butun so'rovni qulatmasligi kerak.
   */
  async deleteObject(key: string): Promise<void> {
    if (!this.client || !this.config) {
      return;
    }
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucketName, Key: key }));
    } catch (err) {
      this.logger.warn(`R2 obyektini o'chirib bo'lmadi: ${key} — ${(err as Error).message}`);
    }
  }
}
