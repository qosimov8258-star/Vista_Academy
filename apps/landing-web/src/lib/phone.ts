/** O'zbekistonda haqiqatda mavjud bo'lgan uyali operator kodlari (masalan: Beeline, Ucell, Mobiuz, Humans, Perfectum). */
const VALID_OPERATOR_CODES = new Set([
  "20", "33", "50", "77", "80", "87", "88", "90", "91", "92", "93", "94", "95", "97", "98", "99",
]);

/**
 * O'zbek telefon raqamini "+998XXXXXXXXX" ko'rinishiga keltiradi. Foydalanuvchi
 * raqamni bo'sh joy, tire yoki qavs bilan yozishi mumkin ("+998 90 123 45 67",
 * "90-123-45-67" va h.k.) — bularning barchasi to'g'ri deb qabul qilinadi.
 * Operator kodi (dastlabki ikki raqam) O'zbekistonda mavjud bo'lgan kodlardan
 * biri bo'lishi shart, aks holda va format mos kelmasa `null` qaytaradi.
 */
export function normalizeUzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  let core: string;
  if (digits.length === 12 && digits.startsWith("998")) {
    core = digits.slice(3);
  } else if (digits.length === 9) {
    core = digits;
  } else {
    return null;
  }

  if (!VALID_OPERATOR_CODES.has(core.slice(0, 2))) {
    return null;
  }

  return `+998${core}`;
}
