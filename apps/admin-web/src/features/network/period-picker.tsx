"use client";

import clsx from "clsx";
import { ChevronRightIcon } from "@/components/ui/icons";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Oy tanlagich: chap/o'ng strelkalar. Kelajakdagi oyga o'tib bo'lmaydi. */
export function PeriodPicker({
  period,
  max,
  onChange,
}: {
  period: string;
  max: string;
  onChange: (period: string) => void;
}) {
  const atMax = period >= max;
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-sunken)] p-1">
      <button
        type="button"
        onClick={() => onChange(shiftPeriod(period, -1))}
        aria-label="Oldingi oy"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
      >
        <ChevronRightIcon className="h-4 w-4 rotate-180" />
      </button>
      <span className="min-w-[118px] text-center text-[14px] font-semibold text-[var(--color-text)]">
        {formatPeriod(period)}
      </span>
      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange(shiftPeriod(period, 1))}
        aria-label="Keyingi oy"
        className={clsx(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          atMax
            ? "cursor-not-allowed text-[var(--color-text-muted)]/40"
            : "cursor-pointer text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]",
        )}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
