"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTr } from "@/i18n/tr";

export const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** "YYYY-MM-DD" ± kun (UTC bo'yicha — mintaqa farqi sanani surib yubormasin) */
export function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "7-oktabr" (yil boshqa bo'lsa — "7-oktabr 2025") */
export function dayMonthLabel(date: string, tr: (key: string) => string, currentYear?: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const year = d.getUTCFullYear();
  return `${d.getUTCDate()}-${tr(MONTHS[d.getUTCMonth()])}${currentYear && year !== currentYear ? ` ${year}` : ""}`;
}

const ARROW = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[transform,opacity] active:scale-[0.92] disabled:opacity-30";

/**
 * Davr kapsulasi: ‹ nom › — kun, hafta yoki oy tanlash uchun umumiy
 * ko'rinish. `children` — o'rtadagi nom (ixtiyoriy yashirin kalendar bilan).
 * `reset` berilsa yonida "Bugun" / "Shu hafta" kapsulasi chiqadi.
 */
export function PeriodStepper({
  children,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  nextDisabled,
  reset,
}: {
  children: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  nextDisabled?: boolean;
  reset?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-10 max-w-full items-center rounded-full bg-[#767680]/[0.12] px-0.5">
        <button type="button" className={ARROW} onClick={onPrev} aria-label={prevLabel}>
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
        <div className="relative flex h-9 min-w-0 items-center px-1.5 text-[15px] font-medium tabular-nums text-[var(--color-text)]">{children}</div>
        <button type="button" className={ARROW} onClick={onNext} disabled={nextDisabled} aria-label={nextLabel}>
          <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
      </div>
      {reset && (
        <button
          type="button"
          onClick={reset.onClick}
          className="h-10 rounded-full bg-[#767680]/[0.12] px-4 text-[15px] font-medium text-[var(--color-primary)] transition-transform active:scale-[0.96]"
        >
          {reset.label}
        </button>
      )}
    </div>
  );
}

/**
 * Kun tanlash — bitta kulrang kapsula: ‹ sana ▾ ›. Strelkalar oy/yil
 * chegarasidan ham o'tadi; o'rtasi bosilsa tizim kalendari ochiladi.
 * Bugundan boshqa kun tanlansa yonida "Bugun" kapsulasi chiqadi.
 * `max` berilsa undan keyingi kunga o'tkazilmaydi.
 */
export function DayStepper({ value, onChange, today, max }: { value: string; onChange: (value: string) => void; today: string; max?: string }) {
  const tr = useTr();
  const inputRef = useRef<HTMLInputElement>(null);
  const d = new Date(`${value}T00:00:00Z`);
  const currentYear = new Date(`${today}T00:00:00Z`).getUTCFullYear();
  const dayMonth = dayMonthLabel(value, tr, currentYear);
  const label =
    value === today
      ? `${tr("Bugun")}, ${dayMonth}`
      : value === shiftDay(today, -1)
        ? `${tr("Kecha")}, ${dayMonth}`
        : `${tr(WEEKDAYS[d.getUTCDay()])}, ${dayMonth}`;

  return (
    <PeriodStepper
      onPrev={() => onChange(shiftDay(value, -1))}
      onNext={() => onChange(shiftDay(value, 1))}
      prevLabel={tr("Oldingi kun")}
      nextLabel={tr("Keyingi kun")}
      nextDisabled={!!max && value >= max}
      reset={value !== today ? { label: tr("Bugun"), onClick: () => onChange(today) } : undefined}
    >
      <label className="flex h-9 cursor-pointer items-center">
        {label}
        <input
          ref={inputRef}
          type="date"
          value={value}
          max={max}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          onClick={() => {
            try {
              inputRef.current?.showPicker();
            } catch {
              // showPicker bo'lmagan brauzerda — oddiy fokus yetadi
            }
          }}
          aria-label={tr("Sana")}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </PeriodStepper>
  );
}
