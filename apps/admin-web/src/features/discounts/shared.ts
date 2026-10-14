import { groupDigits } from "@/features/payments/shared";

/**
 * Chegirmalar bo'limi — umumiy turlar va hisob-kitob. `computeDiscount`
 * API'dagi `discountAmountOf` (apps/api/src/modules/discounts/discount-rules.ts)
 * bilan aynan bir xil bo'lishi shart: oldindan ko'rish va server natijasi
 * bir xil chiqsin.
 */

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FINAL_AMOUNT";
export type DiscountScope = "ONE_MONTH" | "PERMANENT";

/** Chegirma qoidasi (API: `toRuleDto`) */
export interface DiscountRule {
  id: string;
  type: DiscountType;
  scope: DiscountScope;
  value: number;
  startPeriod: string;
  endPeriod: string | null;
  reason: string | null;
  /** false — to'xtatilgan (tarix), faqat ko'rish uchun */
  isActive: boolean;
  createdByName: string | null;
  createdAt: string;
  endedAt: string | null;
}

/** `GET /app/discounts` qatori — bolaning shu oydagi narxi va chegirmasi */
export interface DiscountRow {
  childId: string;
  publicId: number;
  fullName: string;
  groupId: string | null;
  groupName: string | null;
  branchId: string;
  branchName: string;
  gross: number;
  discount: number;
  net: number;
  /** 0..1 */
  rate: number;
  /** Shu oy uchun hisob-faktura bormi */
  invoiced: boolean;
  status: "NONE" | "ACTIVE" | "REVIEW";
  /** Shu oyda amal qilgan qoida (isActive=false — keyin to'xtatilgan) */
  rule: DiscountRule | null;
}

export interface DiscountGroupSlice {
  groupId: string;
  name: string;
  children: number;
  gross: number;
  discount: number;
  net: number;
  discounted: number;
  /** Butun foiz */
  averageRate: number;
}

export interface DiscountDashboard {
  period: string;
  currentPeriod: string;
  summary: {
    activeChildren: number;
    gross: number;
    discount: number;
    net: number;
    discountedChildren: number;
    reviewCount: number;
    /** Butun foiz */
    averageRate: number;
    highImpactThreshold: number;
  };
  byGroup: DiscountGroupSlice[];
  children: DiscountRow[];
}

/** "Tez chegirma": bitta ota-ona/telefon (GUARDIAN — aniq) yoki familiya (SURNAME — taxmin) */
export interface DiscountFamily {
  key: string;
  reason: "GUARDIAN" | "SURNAME";
  label: string;
  phone: string | null;
  children: DiscountRow[];
}

export interface DiscountInvoiceResult {
  changed: { period: string; from: number; to: number }[];
  paidUnchanged: string[];
  capped: string[];
}

export interface DiscountChildHistory {
  period: string;
  current: DiscountRow | null;
  history: DiscountRule[];
}

export interface DiscountMutationResult {
  discount: DiscountRule;
  replaced?: DiscountRule[];
  previousId?: string | null;
  invoices: DiscountInvoiceResult;
}

export interface BulkDiscountResult {
  count: number;
  replacedCount: number;
  invoices: DiscountInvoiceResult;
  items: { id: string; childId: string; name: string; replaced: boolean }[];
}

/** Katta chegirma chegarasi (API: HIGH_IMPACT_DISCOUNT) */
export const HIGH_IMPACT_DISCOUNT = 300_000;

export const DISCOUNT_COLOR = "#ff2d55";

/** Qoidaning oylik narxdan ayiradigan summasi — 0..gross, butun so'mga yaxlitlanadi */
export function computeDiscount(type: DiscountType, value: number, gross: number): number {
  if (!(gross > 0) || !Number.isFinite(value)) return 0;
  let raw = 0;
  if (type === "PERCENTAGE") raw = (gross * Math.min(value, 100)) / 100;
  else if (type === "FIXED_AMOUNT") raw = value;
  else raw = gross - Math.min(value, gross);
  return Math.round(Math.min(Math.max(raw, 0), gross));
}

/** 10 → "10", 12.5 → "12.5" */
export function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

type Tr = (key: string, ...args: unknown[]) => string;
const plain: Tr = (key, ...args) => key.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));

/** Qisqa yorliq: "10%", "−200 000", "2 500 000 narx" */
export function ruleLabel(rule: Pick<DiscountRule, "type" | "value">, tr: Tr = plain): string {
  if (rule.type === "PERCENTAGE") return `${formatPercent(rule.value)}%`;
  if (rule.type === "FIXED_AMOUNT") return `−${groupDigits(rule.value)}`;
  return tr("{0} narx", groupDigits(rule.value));
}

export const TYPE_LABEL: Record<DiscountType, string> = {
  PERCENTAGE: "Foiz",
  FIXED_AMOUNT: "Summa",
  FINAL_AMOUNT: "Yakuniy narx",
};

export const SCOPE_LABEL: Record<DiscountScope, string> = {
  ONE_MONTH: "Bir oylik",
  PERMANENT: "Doimiy",
};

/** "Foiz" / "Summa" / "Yakuniy narx" (tarjima qilinmagan kalit) */
export function typeLabel(type: DiscountType): string {
  return TYPE_LABEL[type];
}

/** "Bir oylik" / "Doimiy" (tarjima qilinmagan kalit) */
export function scopeLabel(scope: DiscountScope): string {
  return SCOPE_LABEL[scope];
}

/** Ism, "id12345" va guruh bo'yicha — har bir so'z topilishi shart */
export function matchesSearch(row: Pick<DiscountRow, "fullName" | "publicId" | "groupName">, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${row.fullName} id${row.publicId} ${row.groupName ?? ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
