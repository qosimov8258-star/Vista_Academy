"use client";

/** Bola surati shu o'lchamda saqlanadi — kartochkada ham, ro'yxatda ham yetarli. */
const PHOTO_SIZE = 512;

/** Yuklanadigan faylning eng katta hajmi. */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/**
 * Yuz atrofidan kesiladigan kvadratning yuz balandligiga nisbati.
 * 2.2 — yuz, soch va bir oz yelka sig'adigan, portretga o'xshaydigan kadr.
 */
const CROP_RATIO = 2.2;

/**
 * Yuz kadrning eng kamida shuncha qismini egallashi kerak. Undan kichik
 * bo'lsa — bu uzoqdan olingan yoki to'liq gavdali surat, portret emas.
 */
const MIN_FACE_WIDTH_RATIO = 0.1;

export type PhotoResult =
  | { ok: true; image: string }
  | { ok: false; reason: string };

let detectorReady: Promise<typeof import("@vladmandic/face-api")> | null = null;

/**
 * Yuzni aniqlaydigan modelni yuklaydi. Model va kutubxona faqat shu yerda,
 * ya'ni foydalanuvchi surat tanlaganda yuklanadi — kirish sahifasi va
 * qolgan bo'limlar ularning og'irligini ko'tarmaydi.
 *
 * Model `public/face-model` dan olinadi, tashqi CDN'dan emas: panel ichki
 * tarmoqda, internetsiz ham ishlashi kerak.
 */
function loadDetector() {
  if (!detectorReady) {
    detectorReady = import("@vladmandic/face-api").then(async (faceapi) => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/face-model");
      return faceapi;
    });
    // Yuklab bo'lmasa keyingi urinishda qaytadan harakat qilinsin
    detectorReady.catch(() => {
      detectorReady = null;
    });
  }
  return detectorReady;
}

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

/** Yuz markazidan kvadrat kesib, PHOTO_SIZE ga keltiradi. */
function cropAround(
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
): string {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Kvadrat rasmdan chiqib ketmasin
  const side = Math.min(box.height * CROP_RATIO, img.naturalWidth, img.naturalHeight);
  const sx = Math.max(0, Math.min(cx - side / 2, img.naturalWidth - side));
  // Peshona va soch ko'proq sig'sin — markazdan bir oz yuqoriroq
  const sy = Math.max(0, Math.min(cy - side * 0.55, img.naturalHeight - side));

  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Rasmni qayta ishlash imkoni bo'lmadi");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Faylni bola surati sifatida tayyorlaydi.
 *
 * Qabul qilish shartlari:
 *   • hajmi 3 MB dan oshmasin;
 *   • rasmda aynan bitta yuz bo'lsin — yuz topilmasa yoki bir nechta bo'lsa
 *     rad etiladi;
 *   • yuz kadrda yetarlicha katta bo'lsin (uzoqdan olingan surat emas).
 *
 * Shartlar bajarilsa, surat yuz atrofidan kvadrat qilib kesiladi.
 *
 * Diqqat: bu tekshiruv brauzerda bajariladi va ma'lumot sifatini nazorat
 * qilish uchun. So'rovni to'g'ridan-to'g'ri API'ga yuborgan odam uni chetlab
 * o'ta oladi — server faqat format va hajmni tekshiradi.
 */
export async function prepareChildPhoto(file: File): Promise<PhotoResult> {
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace(".", ",");
    return { ok: false, reason: `Rasm juda katta (${mb} MB). 3 MB gacha bo'lgan surat yuklang.` };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, reason: "Bu faylni rasm sifatida o'qib bo'lmadi" };
  }

  let faceapi: Awaited<ReturnType<typeof loadDetector>>;
  try {
    faceapi = await loadDetector();
  } catch {
    return { ok: false, reason: "Yuzni tekshirish moduli yuklanmadi. Sahifani yangilab, qayta urinib ko'ring." };
  }

  const detections = await faceapi.detectAllFaces(
    img,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }),
  );

  if (detections.length === 0) {
    return { ok: false, reason: "Rasmda yuz topilmadi. Bolaning yuzi ko'rinib turgan suratni tanlang." };
  }
  if (detections.length > 1) {
    return {
      ok: false,
      reason: `Rasmda ${detections.length} ta yuz bor. Faqat bolaning o'zi tushgan suratni tanlang.`,
    };
  }

  const box = detections[0].box;
  if (box.width < img.naturalWidth * MIN_FACE_WIDTH_RATIO) {
    return { ok: false, reason: "Yuz juda kichik ko'rinyapti. Yaqindan olingan suratni tanlang." };
  }

  try {
    return { ok: true, image: cropAround(img, box) };
  } catch {
    return { ok: false, reason: "Rasmni qayta ishlab bo'lmadi" };
  }
}
