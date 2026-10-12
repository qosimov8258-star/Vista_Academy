import type { PaymentMethod, PaymentStatus } from "@/lib/types";

/** Kassada tanlanadigan usullar — 3×2 to'r (tartib: eng ko'p ishlatiladigani birinchi) */
export const PAY_METHODS: PaymentMethod[] = ["CASH", "CLICK", "PAYME", "CARD", "BANK_TRANSFER", "MOBILE_APP"];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Naqd",
  CLICK: "Click",
  PAYME: "Payme",
  CARD: "Karta",
  BANK_TRANSFER: "O'tkazma",
  MOBILE_APP: "Ilova",
  UZUM: "Uzum",
  BANKOMAT: "Bankomat",
  OTHER: "Boshqa",
};

/** Usul belgisi (nuqta) rangi — iOS tizim ranglari */
export const METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: "#34c759",
  CLICK: "#007aff",
  PAYME: "#30b0c7",
  CARD: "#5856d6",
  BANK_TRANSFER: "#af52de",
  MOBILE_APP: "#ff9500",
  UZUM: "#ff2d55",
  BANKOMAT: "#00c7be",
  OTHER: "#8e8e93",
};

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** "2026-10" → "Oktabr 2026" */
export function periodLabel(period: string, tr: (key: string) => string): string {
  const [y, m] = period.split("-").map(Number);
  const name = tr(MONTHS[(m ?? 1) - 1] ?? "");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** "2026-10" ± oy */
export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 7);
}

/** 1250000 → "1 250 000" */
export function groupDigits(value: number | string): string {
  return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** `GET /app/cash/children?period=` qatori */
export interface PeriodChild {
  childId: string;
  childName: string;
  publicId: number | null;
  groupId: string | null;
  groupName: string | null;
  state: "PAID" | "PARTIAL" | "OVERDUE" | "NONE";
  billed: number;
  paid: number;
  remaining: number;
  /** Barcha oylar bo'yicha ochiq qarz */
  totalDebt: number;
}

export interface PeriodGroup {
  groupId: string;
  name: string;
  total: number;
  paid: number;
  partial: number;
  overdue: number;
  none: number;
  billed: number;
  collected: number;
}

/** `GET /app/payments?childId=` qatori */
export interface ChildPayment {
  id: string;
  childId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  note: string | null;
  refundedAt: string | null;
  /** Bekor qilish sababi va kim bekor qilgani */
  refundReason: string | null;
  refundedByName: string | null;
  createdAt: string;
  hasReceiptImage: boolean;
  recordedByName: string | null;
  periods: { invoiceId: string; period: string; amount: string }[];
}

/** Chek suratini brauzerda kichraytirib, data URL qiladi (server 3MB gacha qabul qiladi). */
export function prepareReceiptPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Rasmni qayta ishlab bo'lmadi"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });
}
