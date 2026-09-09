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
export async function resizeToSquare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
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
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
