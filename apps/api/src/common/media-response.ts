import { NotFoundException } from "@nestjs/common";
import { Response } from "express";
import { R2Service } from "../modules/storage/r2.service";

/**
 * R2/Bytes ikki oqimli media javobi: `key` bo'lsa fayl R2'dan serverda
 * o'qiladi, `key` yo'q bo'lsa — eski yo'l, baytlar bazadan. Ikkala holatda
 * ham baytlar shu javobning o'zida uzatiladi.
 *
 * R2'ga 302 redirect qilinmaydi: panel suratlarni `fetch()` bilan (token
 * sarlavhasi bilan) o'qiydi, redirect esa uni bucket'ga olib boradi — bucket'da
 * CORS yo'q, brauzer javobni bloklaydi va surat o'rnida bosh harflar qolib
 * ketardi. Bu yerdagi fayllar kichik (surat, chek, hujjat), proksi arzon.
 */
export async function sendMediaResponse(
  res: Response,
  r2: R2Service,
  media: { key: string | null; bytes: Uint8Array | null; mimeType: string | null },
  notFoundMessage: string,
): Promise<void> {
  if (media.key) {
    const object = await r2.getObjectBuffer(media.key).catch(() => null);
    if (!object) {
      throw new NotFoundException(notFoundMessage);
    }
    res.setHeader("Content-Type", media.mimeType ?? object.contentType ?? "application/octet-stream");
    res.send(object.buffer);
    return;
  }
  if (!media.bytes || !media.mimeType) {
    throw new NotFoundException(notFoundMessage);
  }
  // Cache-Control atayin tegilmaydi — yo'nalish o'zining (@Header()) qiymatini saqlab qoladi
  res.setHeader("Content-Type", media.mimeType);
  res.send(Buffer.from(media.bytes));
}
