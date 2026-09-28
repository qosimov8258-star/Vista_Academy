"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { MenuMeal, ParentAccount, ParentChild, ParentDay } from "@/lib/types";
import { MEAL_LOOK } from "@/features/chef/meal-card";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

const todayTashkent = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso: string, n: number) => new Date(utc(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
function mondayOf(iso: string): string {
  const day = utc(iso).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}
const dayTitle = (iso: string) => `${WEEKDAYS[utc(iso).getUTCDay()]}, ${utc(iso).getUTCDate()}-${MONTHS[utc(iso).getUTCMonth()]}`;

/** Ovqatlar kun tartibi bo'yicha; rangi kabinet palitrasidan (qorong'i rejimda ham mos) */
const MEALS: { meal: MenuMeal; label: string; field: "breakfast" | "lunch" | "snack"; tint: string; ink: string }[] = [
  { meal: "BREAKFAST", label: "Nonushta", field: "breakfast", tint: "bg-[var(--p-sun)]/18", ink: "text-[var(--p-sun-ink)]" },
  { meal: "LUNCH", label: "Tushlik", field: "lunch", tint: "bg-[var(--p-coral)]/16", ink: "text-[var(--p-coral)]" },
  { meal: "SNACK", label: "Kechki ovqat", field: "snack", tint: "bg-[var(--p-lilac)]/18", ink: "text-[var(--p-lilac-ink)]" },
];

/**
 * Kundalik — bolaning kuni tarix bo'lib saqlanadi. Hozircha ovqat tartibi:
 * har kuni nima berilgani (menyu) va oshpaz yuklagan tayyor ovqat suratlari.
 * Tepadagi hafta tasmasi bilan o'tgan kunlarni ham, rejadagi menyuni ham
 * ko'rish mumkin.
 */
export default function ParentDiaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const today = todayTashkent();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [selected, setSelected] = useState(today);
  const [viewing, setViewing] = useState<{ src: string; label: string } | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  useEffect(() => {
    if (meQuery.isError && meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/ota-ona/${slug}/kirish`);
    }
  }, [meQuery.isError, meQuery.error, router, slug]);

  const children = meQuery.data?.children ?? [];
  const childId = activeChildId ?? children[0]?.id ?? null;

  const dayQuery = useQuery({
    queryKey: ["parent-day", childId, selected],
    queryFn: () => parentApi.get<ParentDay>(`/app/parent/children/${childId}/day?date=${selected}`),
    enabled: !!childId,
  });
  const day = dayQuery.data;

  const goWeek = (delta: number) => {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelected(next <= today && today <= addDays(next, 6) ? today : next);
  };

  const hasMenu = !!day?.menu && !!(day.menu.breakfast || day.menu.lunch || day.menu.snack);
  const hasPhotos = (day?.menuPhotos?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--p-ink)]">Kundalik</h1>
          <p className="mt-0.5 text-[14px] text-[var(--p-muted)]">Bolangiz kuni qanday o&apos;tdi</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <WeekArrow direction="prev" onClick={() => goWeek(-1)} />
          <WeekArrow direction="next" onClick={() => goWeek(1)} />
        </div>
      </header>

      {children.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChildId(c.id)}
              className={clsx(
                "shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors",
                c.id === childId ? "bg-[var(--p-coral)] text-white" : "bg-[var(--p-panel)] text-[var(--p-muted)]",
              )}
            >
              {c.fullName.split(" ").slice(-1)[0]}
            </button>
          ))}
        </div>
      )}

      {/* Hafta kunlari */}
      <div className="mt-4 grid grid-cols-7 gap-1 rounded-[22px] bg-[var(--p-card)] p-1.5 shadow-[var(--p-shadow)]">
        {days.map((d, i) => {
          const active = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              aria-pressed={active}
              className={clsx(
                "flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors",
                active ? "bg-[var(--p-sun)] text-[#2c2320]" : "active:bg-[var(--p-sunken)]",
              )}
            >
              <span className={clsx("text-[11.5px] font-semibold", active ? "text-[#2c2320]/70" : "text-[var(--p-muted)]")}>
                {SHORT_DAYS[i]}
              </span>
              <span
                className={clsx(
                  "text-[17px] font-bold tabular-nums",
                  active ? "" : d === today ? "text-[var(--p-sun-ink)]" : "text-[var(--p-ink)]",
                )}
              >
                {utc(d).getUTCDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <h2 className="text-[17px] font-bold text-[var(--p-ink)]">{dayTitle(selected)}</h2>
        {selected === today && (
          <span className="rounded-full bg-[var(--p-sun)]/18 px-2 py-0.5 text-[11.5px] font-bold text-[var(--p-sun-ink)]">Bugun</span>
        )}
      </div>

      <section className="mt-3 rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--p-ink)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--p-sun)]" />
          Ovqat tartibi
        </h3>

        {dayQuery.isLoading || !childId ? (
          <div className="mt-4 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--p-sunken)]" />
            ))}
          </div>
        ) : !hasMenu && !hasPhotos ? (
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--p-muted)]">
            {selected > today ? "Bu kun uchun menyu hali tuzilmagan" : "Bu kun uchun menyu kiritilmagan"}
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
                    {photos.length > 0 && childId && (
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
      </section>

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
    </div>
  );
}

function WeekArrow({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Oldingi hafta" : "Keyingi hafta"}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)] active:bg-[var(--p-sunken)]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={clsx("h-5 w-5", direction === "prev" && "rotate-180")} aria-hidden>
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
