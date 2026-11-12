"use client";

import { SectionTabs } from "@/components/ios/section-tabs";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";

/**
 * Filial menyusidagi bo'limlar — har biri menyuda bitta band (birinchi
 * sahifa ochiladi), qolgan sahifalarga sahifa tepasidagi tanlagich bilan
 * o'tiladi. Shu ro'yxat ham menyuni (sidebar), ham tanlagichni quradi —
 * ikkalasi bir-biridan ajralib ketmasin.
 */
export type BranchSection = "daily" | "faceId" | "coin" | "useful";

const SECTIONS: Record<BranchSection, { key: string; path: string; label: string; short: string }[]> = {
  daily: [
    { key: "nutrition", path: "/nutrition", label: "Ovqatlanish", short: "Ovqat" },
    { key: "lessons", path: "/lessons/schedule", label: "Dars jadvali", short: "Darslar" },
    { key: "timetable", path: "/timetable", label: "Haftalik jadval", short: "Haftalik" },
  ],
  faceId: [
    { key: "devices", path: "/face-id/devices", label: "Qurilmalar", short: "Qurilmalar" },
    { key: "registrations", path: "/face-id/registrations", label: "Yuz ro'yxati", short: "Yuz ro'yxati" },
  ],
  coin: [
    { key: "children", path: "/coin/children", label: "Bolalar", short: "Bolalar" },
    { key: "shop", path: "/coin/shop", label: "Do'kon", short: "Do'kon" },
  ],
  useful: [
    { key: "poems", path: "/useful/poems", label: "She'rlar", short: "She'rlar" },
    { key: "proverbs", path: "/useful/proverbs", label: "Maqollar", short: "Maqollar" },
    { key: "tales", path: "/useful/tales", label: "Ertaklar", short: "Ertaklar" },
  ],
};

export function branchSectionTabs(section: BranchSection, base: string) {
  return SECTIONS[section].map((t) => ({ ...t, href: `${base}${t.path}` }));
}

/** Menyu bandi: birinchi sahifa ochiladi, qolganlari ochiq bo'lganda ham band faol */
export function branchSectionLeaf(section: BranchSection, base: string) {
  const tabs = branchSectionTabs(section, base);
  return { href: tabs[0].href, alsoActive: tabs.slice(1).map((t) => t.href) };
}

/**
 * Bu bo'limlar menyusi bor rollar: filial admini, administrator va filialni
 * ko'rayotgan Super Admin. Kundalik ish va Yulduzcha sahifalari boshqa
 * rollarda (oshpaz — Ovqatlanish) o'z menyusidan ochiladi — tanlagich
 * ularga boshqa bo'lim sahifalarini taklif qilmasin. Face ID va Foydalida
 * tanlagich avvaldan hammaga ko'rinardi — shunday qoladi.
 */
const EVERYONE: BranchSection[] = ["faceId", "useful"];
const SECTION_LABEL: Record<BranchSection, string> = { daily: "Kundalik ish", faceId: "Face ID", coin: "Yulduzcha", useful: "Foydali" };

export function BranchSectionTabs({ slug, section, current }: { slug: string; section: BranchSection; current: string }) {
  const { user } = useAuth();
  const { base, branchSlug } = useBranchContext(slug);
  const role = user?.role;
  const operational = role === "BRANCH_ADMIN" || role === "MANAGER" || (role === "NETWORK_ADMIN" && !!branchSlug);
  if (!EVERYONE.includes(section) && !operational) return null;
  return <SectionTabs tabs={branchSectionTabs(section, base)} current={current} label={SECTION_LABEL[section]} />;
}
