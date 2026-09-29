"use client";

/** Yuklanadigan chek suratining eng katta hajmi. */
export const MAX_RECEIPT_PHOTO_BYTES = 3 * 1024 * 1024;

/** Uzun tomonning eng katta o'lchami — chek matni o'qiladigan darajada saqlanadi. */
const MAX_DIMENSION = 1280;

export type ReceiptPhotoResult = { ok: true; image: string } | { ok: false; reason: string };

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
 * To'lov cheki suratini yuklashga tayyorlaydi: hajmini tekshiradi va
 * uzun tomoni MAX_DIMENSION dan katta bo'lsa kichraytiradi. Bola surati
 * uchun ishlatiladigan `prepareChildPhoto`dan farqli — bu yerda yuz
 * qidirilmaydi va kvadratga kesilmaydi, chek to'liq ko'rinishi kerak.
 */
export async function prepareReceiptPhoto(file: File): Promise<ReceiptPhotoResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "Faqat rasm fayli yuklash mumkin" };
  }
  if (file.size > MAX_RECEIPT_PHOTO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace(".", ",");
    return { ok: false, reason: `Rasm juda katta (${mb} MB). 3 MB gacha bo'lgan surat yuklang.` };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, reason: "Bu faylni rasm sifatida o'qib bo'lmadi" };
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { ok: false, reason: "Rasmni qayta ishlash imkoni bo'lmadi" };
  }
  ctx.drawImage(img, 0, 0, width, height);
  return { ok: true, image: canvas.toDataURL("image/jpeg", 0.88) };
}
