import { NotFoundException } from "@nestjs/common";
import { Response } from "express";
import { R2Service } from "../modules/storage/r2.service";

/**
 * R2/Bytes ikki oqimli media javobi: `key` bo'lsa qisqa muddatli imzolangan
 * R2 havolasiga 302 redirect qilinadi (brauzer <img>/<video> uni o'zi kuzatadi,
 * Range so'rovlarini ham R2'ning o'zi qo'llab-quvvatlaydi). `key` yo'q bo'lsa —
 * eski yo'l: baytlar to'g'ridan-to'g'ri javobga yoziladi.
 *
 * Redirect javobida Cache-Control atayin qisqa (imzo muddatidan kam) qilib
 * qo'yiladi — aks holda brauzer eskirgan imzolangan havolani uzoq keshlab,
 * keyingi ochishda 403 beradi.
 */
export async function sendMediaResponse(
  res: Response,
  r2: R2Service,
  media: { key: string | null; bytes: Uint8Array | null; mimeType: string | null },
  notFoundMessage: string,
): Promise<void> {
  if (media.key) {
    const url = await r2.getPresignedReadUrl(media.key);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.redirect(302, url);
    return;
  }
  if (!media.bytes || !media.mimeType) {
    throw new NotFoundException(notFoundMessage);
  }
  // Cache-Control atayin tegilmaydi — yo'nalish o'zining (@Header()) qiymatini
  // saqlab qoladi, chunki bu yerda haqiqiy baytlar uzatiladi va imzo muddati
  // bilan bog'liq muammo yo'q.
  res.setHeader("Content-Type", media.mimeType);
  res.send(Buffer.from(media.bytes));
}
