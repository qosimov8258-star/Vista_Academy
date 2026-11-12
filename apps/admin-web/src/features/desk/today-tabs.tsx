"use client";

import { SectionTabs } from "@/components/ios/section-tabs";

export type TodayTabKey = "calls" | "called" | "pickups" | "board" | "weekly";

interface TodayTabDef {
  key: TodayTabKey;
  path: string;
  label: string;
  /** Telefonda tanlagichga sig'ishi uchun qisqa nom */
  short: string;
}

const TABS: TodayTabDef[] = [
  { key: "calls", path: "/calls", label: "Qo'ng'iroqlar", short: "Qo'ng'iroq" },
  { key: "called", path: "/calls/called", label: "Qo'ng'iroq qilinganlar", short: "Qilingan" },
  { key: "pickups", path: "/pickups", label: "Olib ketish", short: "Olib ketish" },
  { key: "board", path: "/board", label: "Bugungi holat", short: "Holat" },
  { key: "weekly", path: "/weekly-report", label: "Haftalik hisobot", short: "Hafta" },
];

/**
 * «Bugungi ishlar» — bitta bo'lim: menyuda bitta band, sahifalar orasida
 * tepadagi tanlagich bilan o'tiladi. Kim nimani ko'rishi menyudagi avvalgi
 * qoida bilan bir xil: qo'ng'iroqlar — filial admini va administratorga,
 * olib ketish — boshqalarga; filialni ko'rayotgan Super Admin uchun yo'q
 * (bu sahifalar faqat o'z filiali bor foydalanuvchida ishlaydi).
 * Birinchisi — asosiy sahifa (menyu bandi shunga olib boradi).
 */
export function todayTabs({ base, role, inBranchContext }: { base: string; role: string | undefined; inBranchContext: boolean }) {
  if (inBranchContext) return [];
  const desk = role === "MANAGER" || role === "BRANCH_ADMIN";
  return TABS.filter((t) => (t.key === "calls" || t.key === "called" ? desk : t.key === "pickups" ? !desk : true)).map((t) => ({
    ...t,
    href: `${base}${t.path}`,
  }));
}

/** Sahifa tepasidagi tanlagich: Qo'ng'iroqlar · Qilinganlar · Bugungi holat · Haftalik hisobot */
export function TodayTabs({ slug, role, current }: { slug: string; role: string | undefined; current: TodayTabKey }) {
  return <SectionTabs tabs={todayTabs({ base: `/${slug}`, role, inBranchContext: false })} current={current} label="Bugungi ishlar" />;
}
