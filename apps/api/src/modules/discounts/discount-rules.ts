import type { DiscountScope, DiscountType } from "@prisma/client";

/**
 * Chegirma qoidalari — sof hisob-kitob (Sabot ERP'dagi "chegirmalar"
 * mantig'i, Vista'ning oylik hisob-fakturalariga moslab). Billing, kassa
 * va chegirmalar sahifasi bir xil natija bersin deb hammasi shu yerda.
 */

/** Hisob-kitobga kerak bo'lgan maydonlar (Prisma qatori ham, sinov ob'ekti ham mos keladi) */
export interface DiscountRule {
  id: string;
  type: DiscountType;
  scope: DiscountScope;
  value: unknown;
  startPeriod: string;
  endPeriod: string | null;
  isActive: boolean;
  createdAt: Date;
}

/** Katta chegirma belgisi — tasdiqlash talab qilinmaydi, faqat ko'zga tashlanadi */
export const HIGH_IMPACT_DISCOUNT = 300_000;

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Toshkent bo'yicha joriy oy, YYYY-MM */
export function currentPeriod(now = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 7);
}

/**
 * Qoida shu oyda amal qiladimi:
 * - bir oylik — faqat o'z oyida va faol bo'lsa;
 * - doimiy — boshlangan oydan, to'xtatilgan oygacha (shu oy kirmaydi).
 *   Faol bo'lmagan, lekin to'xtatilgan oyi yozilmagan qator hech qachon
 *   amal qilmaydi.
 */
export function discountAppliesIn(rule: DiscountRule, period: string): boolean {
  if (rule.scope === "ONE_MONTH") return rule.isActive && rule.startPeriod === period;
  if (period < rule.startPeriod) return false;
  if (rule.endPeriod) return period < rule.endPeriod;
  return rule.isActive;
}

/** Shu oy uchun bitta qoida: bir oylik doimiysini bosib ketadi, bir turdagilardan eng yangisi */
export function chooseDiscount<T extends DiscountRule>(rules: readonly T[], period: string): T | null {
  let best: T | null = null;
  for (const rule of rules) {
    if (!discountAppliesIn(rule, period)) continue;
    if (!best) {
      best = rule;
      continue;
    }
    const rank = (r: DiscountRule) => (r.scope === "ONE_MONTH" ? 1 : 0);
    if (rank(rule) > rank(best) || (rank(rule) === rank(best) && rule.createdAt > best.createdAt)) best = rule;
  }
  return best;
}

/** Qoidaning oylik narxdan ayiradigan summasi — 0 dan kam va narxdan ko'p emas, butun so'mga yaxlitlanadi */
export function discountAmountOf(rule: Pick<DiscountRule, "type" | "value"> | null, gross: number): number {
  if (!rule || !(gross > 0)) return 0;
  const value = Number(rule.value);
  let raw = 0;
  if (rule.type === "PERCENTAGE") raw = (gross * Math.min(value, 100)) / 100;
  else if (rule.type === "FIXED_AMOUNT") raw = value;
  else raw = gross - Math.min(value, gross);
  return Math.round(Math.min(Math.max(raw, 0), gross));
}

/** Shu oy uchun chegirma summasi (qoida bo'lmasa — 0) */
export function discountFor(rules: readonly DiscountRule[], period: string, gross: number): number {
  return discountAmountOf(chooseDiscount(rules, period), gross);
}

/** Kiritilgan qiymatni tekshirish — xato matni yoki null */
export function discountInputError(type: DiscountType, value: number): string | null {
  if (!Number.isFinite(value) || value < 0) return "Chegirma qiymati 0 dan kichik bo'lmasligi kerak";
  if (value === 0) return "Chegirma qiymatini kiriting";
  if (type === "PERCENTAGE" && value > 100) return "Foizli chegirma 100% dan oshmasligi kerak";
  return null;
}

/** Jurnal va izohlar uchun qisqa matn: "10% chegirma", "200 000 so'm chegirma", "oylik narx 2 000 000 so'm" */
export function discountText(rule: Pick<DiscountRule, "type" | "value">): string {
  const value = Number(rule.value);
  if (rule.type === "PERCENTAGE") return `${Number.isInteger(value) ? value : value.toFixed(2)}% chegirma`;
  if (rule.type === "FIXED_AMOUNT") return `${formatSum(value)} so'm chegirma`;
  return `oylik narx ${formatSum(value)} so'm`;
}

export function discountScopeText(rule: Pick<DiscountRule, "scope" | "startPeriod">): string {
  return rule.scope === "ONE_MONTH" ? `faqat ${periodText(rule.startPeriod)} uchun` : `${periodText(rule.startPeriod)} oyidan boshlab har oyga`;
}

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

export function periodText(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1] ?? period} ${y}`;
}

function formatSum(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Oila taxmini uchun familiya kaliti: kichik harf, apostroflarsiz;
 * "-ova/-eva/-ina" oxiridagi "a" olib tashlanadi (Aliyeva ≈ Aliyev).
 * 3 harfdan qisqa bo'lsa — kalit yo'q.
 */
export function surnameKey(lastName: string): string | null {
  let key = lastName
    .toLowerCase()
    .replace(/[ʻʼ’‘'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (key.length < 3) return null;
  if (/(ova|eva|ina)$/.test(key)) key = key.slice(0, -1);
  return key;
}

/** Telefon kaliti — oxirgi 9 raqam (bo'lmasa null) */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}
