"use client";

/** Belgilar 256x256 da saqlanadi — bundan kattasi ekranda ham ko'rinmaydi. */
export const AVATAR_SIZE = 256;

/** Yuklashdan oldingi eng katta fayl hajmi. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Faylni kvadrat qilib kesadi (markazidan), 256x256 ga kichraytiradi va
 * JPEG data URL qaytaradi.
 *
 * Server tomonga tayyor, kichik rasm boradi: telefonda olingan surat bir
 * necha megabayt bo'ladi, belgi uchun esa 256px yetarli.
 */
export async function resizeToSquare(file: File, size: number = AVATAR_SIZE): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Rasmni qayta ishlash imkoni bo'lmadi");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Logo uchun: rasm kesilmaydi — kvadrat ichiga to'liq sig'diriladi (atrofi
 * shaffof) va PNG qaytariladi. Logolar ko'pincha keng va shaffof fonli,
 * markazdan kesish ularni buzib qo'yardi.
 */
export async function fitToSquarePng(file: File, size: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(size / bitmap.width, size / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Rasmni qayta ishlash imkoni bo'lmadi");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();
  return canvas.toDataURL("image/png");
}
