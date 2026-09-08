/**
 * Telefon raqamini bitta ko'rinishga keltiradi: +998901234567.
 *
 * Bu vasiylarni telefon bo'yicha topish uchun zarur — aks holda "90 123 45 67"
 * va "+998901234567" ikki xil odam bo'lib qoladi va aka-uka bir ota-onaga
 * bog'lanmaydi.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  // 901234567 → +998901234567
  if (digits.length === 9) return `+998${digits}`;
  // 998901234567 → +998901234567
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  // 8901234567 yoki 0901234567 kabi ichki formatlar
  if (digits.length === 10 && (digits.startsWith("8") || digits.startsWith("0"))) {
    return `+998${digits.slice(1)}`;
  }

  // Tanib bo'lmadi — hech bo'lmasa raqamlarni saqlaymiz
  return digits ? `+${digits}` : raw.trim();
}
