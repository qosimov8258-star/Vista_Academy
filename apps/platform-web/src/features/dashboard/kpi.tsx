"use client";

import clsx from "clsx";
import type { AnalyticsPeriod } from "@/lib/types";

export const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "day", label: "Kun" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Oy" },
  { value: "year", label: "Yil" },
];

/** "o'tgan davrga nisbatan" — davr nomi bilan */
export const PREVIOUS_LABEL: Record<AnalyticsPeriod, string> = {
  day: "kechagiga nisbatan",
  week: "o'tgan haftaga nisbatan",
  month: "o'tgan oyga nisbatan",
  year: "o'tgan yilga nisbatan",
};

export function PeriodSwitcher({ value, onChange }: { value: AnalyticsPeriod; onChange: (period: AnalyticsPeriod) => void }) {
  return (
    <div role="radiogroup" aria-label="Davr" className="flex flex-wrap gap-2">
      {PERIODS.map((period) => {
        const active = period.value === value;
        return (
          <button
            key={period.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(period.value)}
            className={clsx(
              "h-10 cursor-pointer rounded-full px-5 text-[14px] font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
              active
                ? "bg-[var(--color-accent-muted)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)] hover:bg-[var(--color-surface-hover)]",
            )}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}

function TrendArrow({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {up ? (
        <>
          <path d="M1.5 11.5 6 7l3 3 5.5-5.5" />
          <path d="M10.5 4.5h4v4" />
        </>
      ) : (
        <>
          <path d="M1.5 4.5 6 9l3-3 5.5 5.5" />
          <path d="M10.5 11.5h4v-4" />
        </>
      )}
    </svg>
  );
}

/**
 * O'zgarish: o'q + ishora + foiz. Rang yagona belgi emas — o'q yo'nalishi
 * va "+"/"−" ham bor. Oldingi davr bo'sh bo'lsa (foiz yo'q) izoh ko'rsatiladi.
 */
export function Delta({ changePct, suffix, dark, fallback }: { changePct: number | null; suffix: string; dark?: boolean; fallback?: string }) {
  if (changePct === null) {
    return <p className={clsx("text-[12.5px]", dark ? "text-[var(--color-ink-muted)]" : "text-[var(--color-text-muted)]")}>{fallback ?? "solishtirish uchun ma'lumot yo'q"}</p>;
  }
  const up = changePct >= 0;
  const tone = up
    ? dark
      ? "text-[var(--color-success-on-ink)]"
      : "text-[var(--color-success)]"
    : dark
      ? "text-[var(--color-danger-on-ink)]"
      : "text-[var(--color-danger)]";
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
      <span className={clsx("inline-flex items-center gap-1 font-semibold", tone)}>
        <TrendArrow up={up} className="h-3.5 w-3.5" />
        {up ? "+" : "−"}
        {Math.abs(changePct).toLocaleString("uz-UZ")}%
      </span>
      <span className={dark ? "text-[var(--color-ink-muted)]" : "text-[var(--color-text-muted)]"}>{suffix}</span>
    </p>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  footer,
  dark,
  loading,
}: {
  label: string;
  value: string;
  unit?: string;
  footer: React.ReactNode;
  dark?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[var(--radius-xl)] px-5 py-5",
        dark
          ? "bg-[var(--color-ink)] text-[var(--color-ink-text)]"
          : "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)]",
      )}
    >
      {dark && (
        // Rasmdagidek qora kartada yumshoq diagonal yorug'lik
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-40 rotate-[25deg] rounded-[40px] bg-white/[0.05]"
        />
      )}
      <p className={clsx("relative text-[14px]", dark ? "text-[var(--color-ink-muted)]" : "text-[var(--color-text-muted)]")}>{label}</p>
      {loading ? (
        <span className={clsx("relative mt-3 block h-8 w-32 animate-pulse rounded-lg", dark ? "bg-white/10" : "bg-[var(--color-surface-sunken)]")} />
      ) : (
        <p className="relative mt-2 flex items-baseline gap-1.5">
          <span className="text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{value}</span>
          {unit && <span className={clsx("text-[14px] font-medium", dark ? "text-[var(--color-ink-muted)]" : "text-[var(--color-text-muted)]")}>{unit}</span>}
        </p>
      )}
      <div className="relative mt-2 min-h-[18px]">{!loading && footer}</div>
    </div>
  );
}
