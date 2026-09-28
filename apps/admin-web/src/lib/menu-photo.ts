"use client";

/** Taom surati uzun tomoni shu o'lchamgacha kichraytiriladi — telefonda to'liq ekranga yetadi. */
const MAX_SIDE = 1280;

/** Yuklanadigan faylning eng katta hajmi (kamerada olingan asl surat). */
export const MAX_MENU_PHOTO_FILE_BYTES = 15 * 1024 * 1024;

/**
 * Serverga boradigan data URL chegarasi: server 700 KB gacha surat qabul
 * qiladi, base64 esa hajmni ~1,37 barobar oshiradi.
 */
const MAX_DATA_URL_LENGTH = 940_000;

export type MenuPhotoResult = { ok: true; image: string } | { ok: false; reason: string };

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
 * Taom suratini tayyorlaydi. Tovar suratidan farqli — kvadrat qilib
 * kesilmaydi (dasturxon butunligicha ko'rinsin), faqat kichraytiriladi.
 * Hajm chegaradan oshsa, sifat va o'lcham bosqichma-bosqich tushiriladi.
 */
export async function prepareMenuPhoto(file: File): Promise<MenuPhotoResult> {
  if (file.size > MAX_MENU_PHOTO_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace(".", ",");
    return { ok: false, reason: `Rasm juda katta (${mb} MB). 15 MB gacha bo'lgan surat yuklang.` };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, reason: "Bu faylni rasm sifatida o'qib bo'lmadi" };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, reason: "Rasmni qayta ishlash imkoni bo'lmadi" };

  for (const [side, quality] of [
    [MAX_SIDE, 0.82],
    [MAX_SIDE, 0.7],
    [1024, 0.7],
    [800, 0.65],
  ] as const) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", quality);
    if (image.length <= MAX_DATA_URL_LENGTH) return { ok: true, image };
  }
  return { ok: false, reason: "Rasmni kichraytirib bo'lmadi — boshqa surat tanlang" };
}
