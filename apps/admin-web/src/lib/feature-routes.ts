"use client";

import { useFeatureEnabled } from "./use-auth";

/**
 * Panel sahifasi → platforma funksiyasi. Kalit — `/{slug}/` (yoki
 * `/{slug}/{filial}/`) dan keyingi birinchi bo'lak. Funksiya o'chirilgan
 * bo'lsa: menyu bandi va tanlagich tugmasi yashiriladi, manzil bilan
 * kirilsa sahifa o'rniga «Bu bo'lim o'chirilgan» ko'rinadi.
 *
 * API'dagi `apps/api/src/common/features/feature-catalog.ts` bilan mos
 * bo'lishi kerak (u yerda — so'rov yo'llari, bu yerda — sahifalar).
 */
const ROUTE_FEATURES: Record<string, string> = {
  attendance: "attendance",
  "audit-logs": "auditLogs",
  calls: "pickups",
  pickups: "pickups",
  cash: "cash",
  "cash-report": "cash",
  expenses: "cash",
  coin: "coins",
  crm: "crm",
  "daily-reports": "dailyReports",
  debtors: "billing",
  finance: "billing",
  payments: "billing",
  "group-payments": "billing",
  discounts: "discounts",
  employees: "employees",
  "face-id": "faceId",
  hr: "hr",
  lending: "landing",
  lessons: "lessons",
  "lesson-attendance": "lessons",
  "my-lessons": "lessons",
  materials: "groupMaterials",
  messages: "notifications",
  notifications: "notifications",
  "my-notifications": "employeeNotifications",
  nutrition: "nutrition",
  "payment-receipts": "paymentReceipts",
  reminders: "paymentReminders",
  "staff-attendance": "staffAttendance",
  "staff-absences": "staffAttendance",
  timetable: "diary",
  useful: "useful",
};

/** Sahifa manzili qaysi funksiyaga tegishli (`/test-bogcha/filial-1/nutrition` → "nutrition"); yo'q bo'lsa null. */
export function featureForPath(path: string): string | null {
  const segs = path.split(/[?#]/)[0].split("/").filter(Boolean).slice(1);
  // Birinchi bo'lak — sahifa; topilmasa ikkinchisi (birinchisi filial yoki «network» bo'lishi mumkin)
  return ROUTE_FEATURES[segs[0]] ?? ROUTE_FEATURES[segs[1]] ?? null;
}

/** Menyu va tanlagichlar uchun: `(href) => ko'rsatilsinmi`. */
export function useRouteFeatureOn() {
  const isOn = useFeatureEnabled();
  return (href: string) => {
    const feature = featureForPath(href);
    return !feature || isOn(feature);
  };
}
