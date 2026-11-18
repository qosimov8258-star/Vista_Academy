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
 * Ro'yxat berilsa — sahifa hammasi yoqilgandagina ochiladi.
 */
const ROUTE_FEATURES: Record<string, string | string[]> = {
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
  // Kayfiyat belgilash kundalik hisobotning bir qismi — u o'chsa, bu ham yashirinadi
  mood: "dailyReports",
  // Qarzdorlar va to'lovlar ro'yxati /cash/* dan o'qiladi — kassa ham kerak
  debtors: ["billing", "cash"],
  finance: "billing",
  payments: ["billing", "cash"],
  "group-payments": ["billing", "cash"],
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
  // Ota-onalar faolligi (feature/ota-ona-faolligi) — kabinet bo'lmasa ma'nosiz
  parents: "parentCabinet",
};

/**
 * Bo'lim ichidagi sahifa o'z funksiyasiga ega bo'lsa (`useful/articles`) —
 * bo'limniki ustiga qo'shiladi: ikkalasi ham yoqilgan bo'lishi kerak.
 */
const SUB_ROUTE_FEATURES: Record<string, string> = {
  "useful/articles": "articles",
  "useful/gallery": "gallery",
};

/** Sahifa manzili qaysi funksiyalarga tegishli (`/test-bogcha/filial-1/nutrition` → ["nutrition"]); yo'q bo'lsa bo'sh. */
export function featureForPath(path: string): string[] {
  const segs = path.split(/[?#]/)[0].split("/").filter(Boolean).slice(1);
  // Birinchi bo'lak — sahifa; topilmasa ikkinchisi (birinchisi filial yoki «network» bo'lishi mumkin)
  const at = ROUTE_FEATURES[segs[0]] ? 0 : ROUTE_FEATURES[segs[1]] ? 1 : -1;
  if (at < 0) return [];
  const value = ROUTE_FEATURES[segs[at]];
  const features = Array.isArray(value) ? value : [value];
  const sub = SUB_ROUTE_FEATURES[`${segs[at]}/${segs[at + 1] ?? ""}`];
  return sub ? [...features, sub] : features;
}

/** Menyu va tanlagichlar uchun: `(href) => ko'rsatilsinmi`. */
export function useRouteFeatureOn() {
  const isOn = useFeatureEnabled();
  return (href: string) => featureForPath(href).every(isOn);
}
