"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useTr } from "@/i18n/tr";
import { THUMB_MS, useSegmentThumb, type ThumbBox, type ThumbStart } from "./segment-thumb";
import { useRouteFeatureOn } from "@/lib/feature-routes";

export interface SectionTab<K extends string = string> {
  key: K;
  href: string;
  label: string;
  /** Telefonda tanlagichga sig'ishi uchun qisqa nom */
  short: string;
}

/**
 * Sahifalar orasidagi surilish: bosilganda tabletka eski sahifada surila
 * boshlaydi; yangi sahifa ochilganda u yo'lning qolgan qismini davom ettiradi
 * (har sahifa o'z tanlagichini chizadi, shuning uchun holat shu yerda turadi).
 */
let flight: { key: string; to: number; from: ThumbBox; target: ThumbBox; at: number } | null = null;

/** cubic-bezier(0.32, 0.72, 0, 1) ga yaqin — kuchli sekinlashuv */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

function takeFlight(key: string, current: number): ThumbStart | null {
  // `flight` tozalanmaydi: dev rejimida React initializer'ni ikki marta chaqiradi;
  // eskirgan yozuv vaqt bo'yicha o'zi rad etiladi.
  const f = flight;
  if (!f || f.key !== key || f.to !== current || typeof performance === "undefined") return null;
  const elapsed = performance.now() - f.at;
  if (elapsed >= THUMB_MS - 30) return null;
  const p = easeOut(Math.max(0, elapsed) / THUMB_MS);
  return {
    box: { x: f.from.x + (f.target.x - f.from.x) * p, w: f.from.w + (f.target.w - f.from.w) * p },
    ms: Math.round(THUMB_MS - elapsed),
  };
}

/**
 * Bitta bo'limning sahifalari orasida o'tish (masalan «Bugungi ishlar»,
 * «Xodimlar»): menyuda bo'lim bitta band, sahifalar esa tepadagi shu
 * tanlagich bilan almashadi. Ko'rinishi iOS segmentidek (kulrang yo'lak,
 * oq tabletka suriladi), lekin har bandi — havola (sahifalar oldindan
 * yuklanadi). Telefonda qisqa nomlar va tor chetlar — hammasi bir qatorga sig'adi.
 */
export function SectionTabs<K extends string>({ tabs: allTabs, current, label }: { tabs: SectionTab<K>[]; current: K; label: string }) {
  const tr = useTr();
  // Platforma o'chirgan funksiya sahifalari tanlagichda ko'rinmaydi
  const routeOn = useRouteFeatureOn();
  const tabs = allTabs.filter((t) => routeOn(t.href));
  const flightKey = tabs.map((t) => t.key).join("|");
  const currentIndex = tabs.findIndex((t) => t.key === current);
  const [pending, setPending] = useState<{ from: K; to: number } | null>(null);
  const [start] = useState(() => takeFlight(flightKey, currentIndex));
  // Bosilgan band darhol tanlanadi (yangi sahifa yuklanguncha); sahifa almashsa — o'sha
  const shown = pending && pending.from === current ? pending.to : currentIndex;
  const { containerRef, thumbStyle, measure } = useSegmentThumb<HTMLElement>(shown, start);

  if (tabs.length < 2) return null;
  return (
    <nav
      ref={containerRef}
      aria-label={tr(label)}
      className="relative grid rounded-full bg-[#767680]/[0.12] p-[3px]"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none bottom-[3px] top-[3px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]"
        style={thumbStyle}
      />
      {tabs.map((t, i) => {
        const active = i === shown;
        return (
          <Link
            key={t.key}
            href={t.href}
            data-seg=""
            aria-current={t.key === current ? "page" : undefined}
            onClick={(e) => {
              if (i === shown || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              const from = measure(shown);
              const target = measure(i);
              if (from && target) flight = { key: flightKey, to: i, from, target, at: performance.now() };
              setPending({ from: current, to: i });
            }}
            className={clsx(
              "relative z-[1] flex h-8 min-w-0 items-center justify-center rounded-full px-1.5 text-[13px] text-[var(--color-text)] transition-opacity active:opacity-60 sm:px-3",
              active ? "font-semibold" : "font-medium",
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
