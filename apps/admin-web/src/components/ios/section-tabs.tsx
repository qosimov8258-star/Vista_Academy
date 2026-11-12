"use client";

import Link from "next/link";
import clsx from "clsx";
import { useTr } from "@/i18n/tr";

export interface SectionTab<K extends string = string> {
  key: K;
  href: string;
  label: string;
  /** Telefonda tanlagichga sig'ishi uchun qisqa nom */
  short: string;
}

/**
 * Bitta bo'limning sahifalari orasida o'tish (masalan «Bugungi ishlar»,
 * «Xodimlar»): menyuda bo'lim bitta band, sahifalar esa tepadagi shu
 * tanlagich bilan almashadi. Ko'rinishi iOS segmentidek (kulrang yo'lak,
 * tanlangani oq), lekin har bandi — havola (sahifalar oldindan yuklanadi).
 * Telefonda qisqa nomlar va tor chetlar — hammasi bir qatorga sig'adi.
 */
export function SectionTabs<K extends string>({ tabs, current, label }: { tabs: SectionTab<K>[]; current: K; label: string }) {
  const tr = useTr();
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={tr(label)} className="grid rounded-full bg-[#767680]/[0.12] p-[3px]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex h-8 min-w-0 items-center justify-center rounded-full px-1.5 text-[13px] text-[var(--color-text)] transition-[background-color,opacity] active:opacity-60 sm:px-3",
              active ? "bg-white font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]" : "font-medium",
            )}
          >
            <span className="truncate sm:hidden">{tr(t.short)}</span>
            <span className="hidden truncate sm:inline">{tr(t.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
