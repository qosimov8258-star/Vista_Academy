"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { MenuMeal, ParentDay } from "@/lib/types";
import { MEAL_LOOK } from "@/features/chef/meal-card";

/** Ovqatlar kun tartibi bo'yicha; rangi kabinet palitrasidan (qorong'i rejimda ham mos) */
const MEALS: { meal: MenuMeal; label: string; field: "breakfast" | "lunch" | "snack"; tint: string; ink: string }[] = [
  { meal: "BREAKFAST", label: "Nonushta", field: "breakfast", tint: "bg-[var(--p-sun)]/18", ink: "text-[var(--p-sun-ink)]" },
  { meal: "LUNCH", label: "Tushlik", field: "lunch", tint: "bg-[var(--p-coral)]/16", ink: "text-[var(--p-coral)]" },
  { meal: "SNACK", label: "Kechki ovqat", field: "snack", tint: "bg-[var(--p-lilac)]/18", ink: "text-[var(--p-lilac-ink)]" },
];

/**
 * Kundalikdagi ovqat tartibi: tanlangan kunda nima berilgani (menyu) va
 * oshpaz yuklagan tayyor taom suratlari. Kun tartibi va lahzalar bilan bir
 * sahifada — bola kunining bir qismi.
 */
export function MealsSection({ childId, date, isFuture }: { childId: string; date: string; isFuture: boolean }) {
  const [viewing, setViewing] = useState<{ src: string; label: string } | null>(null);

  const dayQuery = useQuery({
    queryKey: ["parent-day", childId, date],
    queryFn: () => parentApi.get<ParentDay>(`/app/parent/children/${childId}/day?date=${date}`),
  });
  const day = dayQuery.data;
  const hasMenu = !!day?.menu && !!(day.menu.breakfast || day.menu.lunch || day.menu.snack);
  const hasPhotos = (day?.menuPhotos?.length ?? 0) > 0;

  return (
    <section className="mt-5 rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]">
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--p-ink)]">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--p-sun)]" />
        Ovqat tartibi
      </h3>

      {dayQuery.isLoading ? (
        <div className="mt-4 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--p-sunken)]" />
          ))}
        </div>
      ) : !hasMenu && !hasPhotos ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--p-muted)]">
          {isFuture ? "Bu kun uchun menyu hali tuzilmagan" : "Bu kun uchun menyu kiritilmagan"}
        </p>
      ) : (
        <ol className="relative mt-4">
          {MEALS.map((m, i) => {
            const photos = (day?.menuPhotos ?? []).filter((p) => p.meal === m.meal);
            const text = day?.menu?.[m.field] ?? null;
            const Icon = MEAL_LOOK[m.meal].Icon;
            const last = i === MEALS.length - 1;
            return (
              <li key={m.meal} className="relative flex gap-3.5 pb-5 last:pb-0">
                {/* Vaqt chizig'i */}
                {!last && <span className="absolute bottom-0 left-[21px] top-12 w-[2px] rounded-full bg-[var(--p-line)]" aria-hidden />}
                <span className={clsx("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", m.tint, m.ink)}>
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">{m.label}</p>
                  <p className={clsx("mt-0.5 text-[15.5px] leading-relaxed", text ? "text-[var(--p-ink)]" : "text-[var(--p-muted)]")}>
                    {text || "—"}
                  </p>
                  {photos.length > 0 && (
                    <div className="-mr-5 mt-2.5 flex gap-2 overflow-x-auto pb-1 pr-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {photos.map((p) => {
                        const src = `${PARENT_API_URL}/app/parent/children/${childId}/menu-photos/${p.id}`;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setViewing({ src, label: m.label })}
                            className="h-28 w-36 shrink-0 overflow-hidden rounded-2xl bg-[var(--p-sunken)] active:opacity-80"
                            aria-label={`${m.label} suratini kattalashtirish`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={m.label} loading="lazy" className="h-full w-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {viewing && (
        <button
          type="button"
          onClick={() => setViewing(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4"
          aria-label="Yopish"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing.src} alt={viewing.label} className="max-h-[85dvh] max-w-full rounded-2xl object-contain" />
          <span className="text-[14px] font-semibold text-white/80">{viewing.label} · yopish uchun bosing</span>
        </button>
      )}
    </section>
  );
}
