"use client";

/** Tovar surati shu o'lchamda saqlanadi — kartochkada ham, oynada ham yetarli. */
const PHOTO_SIZE = 640;

/** Yuklanadigan faylning eng katta hajmi. */
export const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;

export type ProductPhotoResult = { ok: true; image: string } | { ok: false; reason: string };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });
}

/**
 * Tovar suratini tayyorlaydi: hajmi tekshiriladi, so'ng markazdan kvadrat
 * qilib kesilib, PHOTO_SIZE ga keltiriladi. Bola/xodim suratidan farqli —
 * bu yerda buyum tushadi, yuz emas, shuning uchun yuz aniqlash shart emas.
 */
export async function prepareProductPhoto(file: File): Promise<ProductPhotoResult> {
  if (file.size > MAX_PRODUCT_PHOTO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace(".", ",");
    return { ok: false, reason: `Rasm juda katta (${mb} MB). 5 MB gacha bo'lgan surat yuklang.` };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, reason: "Bu faylni rasm sifatida o'qib bo'lmadi" };
  }

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, reason: "Rasmni qayta ishlash imkoni bo'lmadi" };
  ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);

  return { ok: true, image: canvas.toDataURL("image/jpeg", 0.85) };
}
