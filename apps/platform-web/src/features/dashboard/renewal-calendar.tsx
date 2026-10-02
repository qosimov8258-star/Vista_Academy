"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { DashboardAnalytics } from "@/lib/types";
import { monthLong, weekdayShort } from "@/lib/format";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

/** Ma'lumot 14 kun oldinga bor — undan uzoq haftalarga o'tish ma'nosiz. */
const MAX_WEEK_OFFSET = 2;

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/**
 * Obuna muddatlari kalendari: hafta tasmasida obunasi tugaydigan kunlar
 * nuqta bilan belgilangan, kun tanlansa — o'sha kuni tugaydiganlar.
 * Pastida — faol obunalar ulushi.
 *
 * Faqat brauzerda (ma'lumot kelgach) chizilsin: "bugun" server va brauzer
 * vaqt mintaqasida farq qilib, hydration xatosi bermasin.
 */
export function RenewalCalendar({ data }: { data: DashboardAnalytics }) {
  const today = useMemo(() => new Date(), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(() => dayKey(today));

  const days = useMemo(() => {
    const start = startOfWeek(today);
    start.setDate(start.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [today, weekOffset]);

  const byDay = useMemo(() => {
    const map = new Map<string, DashboardAnalytics["expiring"]>();
    for (const item of data.expiring) {
      const key = dayKey(new Date(item.periodEnd));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [data]);

  const selectedItems = byDay.get(selected) ?? [];
  const middle = days[3];
  const subs = data.subscriptions;
  const activeShare = subs.total > 0 ? Math.round((subs.active / subs.total) * 100) : 0;

  return (
    <section className="flex flex-col rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={weekOffset <= -1}
          aria-label="Oldingi hafta"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-default disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <h2 className="text-[16px] font-medium text-[var(--color-text)]">
          {monthLong(middle.getMonth())} {middle.getFullYear()}
        </h2>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={weekOffset >= MAX_WEEK_OFFSET}
          aria-label="Keyingi hafta"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-default disabled:opacity-30"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1" role="listbox" aria-label="Kunlar">
        {days.map((day) => {
          const key = dayKey(day);
          const isSelected = key === selected;
          const isToday = key === dayKey(today);
          const count = byDay.get(key)?.length ?? 0;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={`${day.getDate()} ${monthLong(day.getMonth())}${count ? `, ${count} ta obuna tugaydi` : ""}`}
              onClick={() => setSelected(key)}
              className={clsx(
                "flex cursor-pointer flex-col items-center gap-3 rounded-[16px] py-3 transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                isSelected
                  ? "bg-[var(--color-accent-muted)] text-white shadow-[var(--shadow-raised)]"
                  : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
              )}
            >
              <span className={clsx("text-[12.5px]", isSelected ? "font-semibold" : "text-[var(--color-text-muted)]", isToday && !isSelected && "font-semibold text-[var(--color-text)]")}>
                {weekdayShort(day.getDay())}
              </span>
              <span className="text-[15px] font-semibold tabular-nums">{day.getDate()}</span>
              <span
                aria-hidden
                className={clsx("h-1.5 w-1.5 rounded-full", count ? (isSelected ? "bg-white" : "bg-[var(--color-danger)]") : "bg-transparent")}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[64px] flex-1">
        {selectedItems.length === 0 ? (
          <p className="pt-3 text-center text-[13px] text-[var(--color-text-muted)]">Bu kunda tugaydigan obuna yo&apos;q</p>
        ) : (
          <ul className="space-y-1">
            {selectedItems.map((item) => (
              <li key={item.organization.id}>
                <Link
                  href={`/bogchalar/${item.organization.id}`}
                  className="flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-[13.5px] transition-colors hover:bg-[var(--color-surface-hover)]"
                >
                  <span className="truncate font-medium text-[var(--color-text)]">{item.organization.name}</span>
                  <span className="shrink-0 text-[12.5px] text-[var(--color-text-muted)]">{item.plan.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Faol obunalar ulushi */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-[var(--color-border)] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-[var(--color-text)]">Faol obunalar</p>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            {`${subs.active} / ${subs.total} bog'cha`}
            {subs.grace + subs.suspended > 0 && ` · ${subs.grace + subs.suspended} tasi e'tibor talab qiladi`}
          </p>
        </div>
        <Donut percent={activeShare} />
      </div>
    </section>
  );
}

function Donut({ percent }: { percent: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-[60px] w-[60px] shrink-0" role="img" aria-label={`${percent}%`}>
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="7" />
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="var(--color-accent-muted)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-[var(--ease-ios)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
        {percent}%
      </span>
    </div>
  );
}
