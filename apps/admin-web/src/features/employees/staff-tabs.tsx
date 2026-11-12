"use client";

import { SectionTabs } from "@/components/ios/section-tabs";
import { useBranchContext } from "@/lib/use-branch-context";

export type StaffTabKey = "list" | "hr" | "attendance";

/**
 * «Xodimlar» — bitta bo'lim: menyuda bitta band (ro'yxat ochiladi),
 * HR va xodimlar davomatiga tepadagi tanlagich bilan o'tiladi. Kim nimani
 * ko'rishi menyudagi avvalgi qoida bilan bir xil: HR — administratorga
 * (MANAGER) ko'rinmaydi. Tanlagich faqat shu bo'lim menyusi bor rollarda:
 * filial admini, administrator va filialni ko'rayotgan Super Admin
 * (moliyachining Xodimlar sahifasi o'z menyusidan ochiladi — unda yo'q).
 */
export function staffTabs({ base, role, inBranchContext }: { base: string; role: string | undefined; inBranchContext: boolean }) {
  const hasSection = role === "BRANCH_ADMIN" || role === "MANAGER" || (role === "NETWORK_ADMIN" && inBranchContext);
  if (!hasSection) return [];
  return [
    { key: "list" as const, href: `${base}/employees`, label: "Xodimlar ro'yxati", short: "Ro'yxat" },
    ...(role === "MANAGER" ? [] : [{ key: "hr" as const, href: `${base}/hr`, label: "Ish haqi (HR)", short: "Ish haqi" }]),
    { key: "attendance" as const, href: `${base}/staff-attendance`, label: "Xodimlar davomati", short: "Davomat" },
  ];
}

/** Sahifa tepasidagi tanlagich: Xodimlar ro'yxati · Ish haqi (HR) · Xodimlar davomati */
export function StaffTabs({ slug, role, current }: { slug: string; role: string | undefined; current: StaffTabKey }) {
  const { base, branchSlug } = useBranchContext(slug);
  return <SectionTabs tabs={staffTabs({ base, role, inBranchContext: !!branchSlug })} current={current} label="Xodimlar" />;
}
