"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatCompactMoney, formatMoney, monthShort } from "@/lib/format";
import { ArrowUpRightIcon } from "@/components/ui/icons";

/** Ox o'qi uchun "chiroyli" yuqori chegara: 1, 2, 2.5, 5 × 10^n */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * exponent) return step * exponent;
  }
  return 10 * exponent;
}

const TICKS = 4;

/**
 * Oylar bo'yicha tushum — rasmdagidek yumaloq ustunlar. Tanlangan oy
 * (standart: joriy oy) kulrang bilan ajraladi va summasi ustida ko'rinadi.
 * Telefonda oxirgi 6 oy, kengroq ekranda 12 oy.
 */
export function RevenueChart({ data, loading }: { data: { month: string; total: number }[]; loading?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = data[data.length - 1]?.month;
  const active = selected ?? current;
  const max = niceMax(Math.max(0, ...data.map((d) => d.total)));
  const total = data.reduce((sum, d) => sum + d.total, 0);
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * (TICKS - i));

  return (
    <section className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-medium text-[var(--color-text)]">Tushum</h2>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            Hamyonga kelib tushgan to&apos;lovlar · 12 oyda {formatCompactMoney(total)} so&apos;m
          </p>
        </div>
        <Link
          href="/bogchalar"
          aria-label="Bog'chalar hamyonlariga o'tish"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
        >
          <ArrowUpRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 flex h-[236px] gap-3">
        {/* Y o'qi */}
        <div className="flex flex-col justify-between pb-7 text-right text-[12px] tabular-nums text-[var(--color-text-muted)]">
          {/* Yuklanishda yozuvsiz: Intl server (Node) va brauzerda kasrni turlicha yozadi — hydration farqi */}
          {ticks.map((tick) => (
            <span key={tick} className="min-w-[38px] leading-none">
              {loading ? "\u00a0" : formatCompactMoney(tick)}
            </span>
          ))}
        </div>

        {/* Ustunlar */}
        <div className="flex min-w-0 flex-1 items-end justify-between gap-2 sm:gap-3">
          {data.map((point, index) => {
            const isActive = point.month === active;
            const height = loading ? 30 + ((index * 37) % 50) : max > 0 ? (point.total / max) * 100 : 0;
            return (
              <div
                key={point.month}
                className={clsx("flex h-full min-w-0 flex-1 flex-col items-center", index < data.length - 6 && "hidden sm:flex")}
              >
                <div className="relative flex w-full flex-1 items-end justify-center">
                  {isActive && !loading && (
                    <span className="absolute z-10 -translate-y-2 whitespace-nowrap rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-[var(--shadow-raised)]" style={{ bottom: `${Math.max(height, 4)}%` }}>
                      {formatCompactMoney(point.total)}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setSelected(point.month)}
                    aria-pressed={isActive}
                    aria-label={`${monthShort(point.month)} ${point.month.slice(0, 4)}: ${formatMoney(point.total)}`}
                    title={formatMoney(point.total)}
                    className={clsx(
                      "w-full max-w-[44px] cursor-pointer rounded-[14px] transition-[height,background-color] duration-500 ease-[var(--ease-ios)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
                      loading
                        ? "animate-pulse bg-[var(--color-surface-sunken)]"
                        : isActive
                          ? "bg-[var(--color-accent-muted)]"
                          : "bg-[var(--color-ink)] bg-[image:repeating-linear-gradient(135deg,rgba(255,255,255,0.06)_0_10px,transparent_10px_20px)] hover:bg-[var(--color-ink-raised)]",
                    )}
                    // Bo'sh oy ham ko'rinib tursin — ingichka "pol" balandligi
                    style={{ height: `${Math.max(height, 3)}%` }}
                  />
                </div>
                <span
                  className={clsx(
                    "mt-2.5 h-[18px] text-[13px]",
                    isActive ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
                  )}
                >
                  {monthShort(point.month)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
