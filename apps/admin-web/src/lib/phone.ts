/**
 * O'zbekiston mobil operatorlarining +998 dan keyingi ikki xonali kodlari.
 * Yangi operator yoki kod qo'shilsa shu ro'yxatni yangilash kifoya.
 */
export const UZBEK_MOBILE_CODES = ["20", "33", "50", "77", "88", "90", "91", "93", "94", "95", "97", "98", "99"] as const;

export type UzbekPhoneError = "prefix" | "length" | "code";

/**
 * Telefon raqamini O'zbekiston formatiga tekshiradi: +998 dan keyin operator
 * kodi va 7 xonali abonent raqami — jami 998 bilan birga 12 ta raqam
 * (masalan +998901234567). To'g'ri bo'lsa null, aks holda xato turini qaytaradi.
 */
export function validateUzbekPhone(value: string): UzbekPhoneError | null {
  const digits = value.replace(/\D/g, "");
  if (!digits.startsWith("998")) return "prefix";
  if (digits.length !== 12) return "length";
  const code = digits.slice(3, 5);
  if (!(UZBEK_MOBILE_CODES as readonly string[]).includes(code)) return "code";
  return null;
}
