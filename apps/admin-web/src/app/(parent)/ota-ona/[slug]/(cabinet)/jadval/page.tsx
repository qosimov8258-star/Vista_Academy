"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { CalendarIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import { EmptyCard, ListSkeleton, LoadErrorCard } from "../foydali/ui";
import { ChildSwitcher } from "../child-switcher";
import { useSelectedChild } from "../use-selected-child";
import { DAY_LONG, DAY_SHORT, isNowRow, timeLabel, todayIndex, visibleDays, type TimetableRow } from "@/features/timetable/shared";
import { useTr } from "@/i18n/tr";

interface ParentTimetable {
  groupId: string | null;
  groupName: string | null;
  note: string;
  rows: TimetableRow[];
  /** Bog'cha vaqti bo'yicha bugungi sana (YYYY-MM-DD) */
  today: string;
}

/** Har 30 soniyada yangilanadigan soat — "hozir" belgisi siljib borsin */
function useNowMinutes(): number {
  const [now, setNow] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const timer = window.setInterval(() => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Haftalik jadval — bolaning guruhi kun tartibi (Du … Sha). Bugungi kun
 * oldindan tanlangan, hozirgi mashg'ulot ajratib ko'rsatiladi. "Hafta"
 * ko'rinishida — bog'chadagi qog'oz jadval kabi butun hafta.
 * Faqat o'qish; to'ldirish — admin panelidagi "Haftalik jadval".
 */
export default function ParentTimetablePage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const router = useRouter();
  const now = useNowMinutes();

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

  const { child, childId, multiple } = useSelectedChild(slug, meQuery.data?.children);
  const timetableQuery = useQuery({
    queryKey: ["parent-timetable", childId],
    queryFn: () => parentApi.get<ParentTimetable>(`/app/parent/children/${childId}/timetable`),
    enabled: !!childId,
    retry: false,
  });
  const data = timetableQuery.data;
  const rows = data?.rows ?? [];
  const days = visibleDays(rows);

  const [today, setToday] = useState<number | null>(null);
  const [day, setDay] = useState(0);
  const [mode, setMode] = useState<"day" | "week">("day");
  useEffect(() => {
    const t = todayIndex();
    setToday(t);
    setDay(t === 6 ? 0 : t);
  }, []);
  const dayRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.cells[day]?.trim());

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <header>
        <h1 className={`${styles.roundedFont} text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]`}>
          {tr("Haftalik jadval")}
        </h1>
        <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--p-muted)]">
          {data?.groupName ? tr("«{0}» guruhining kun tartibi", data.groupName) : tr("Guruhning kun tartibi")}
        </p>
      </header>

      {multiple && child && <ChildSwitcher slug={slug} child={child} />}

      {!data ? (
        timetableQuery.isError || meQuery.isError ? (
          <LoadErrorCard
            error={timetableQuery.error ?? meQuery.error}
            onRetry={() => {
              meQuery.refetch();
              timetableQuery.refetch();
            }}
            loginHref={`/ota-ona/${slug}/kirish`}
          />
        ) : (
          <ListSkeleton rows={5} />
        )
      ) : !data.groupId ? (
        <EmptyCard Icon={CalendarIcon} tone="sky" title={tr("Bola hali guruhga biriktirilmagan")} text={tr("Guruhga qo'shilgach, uning haftalik jadvali shu yerda ko'rinadi.")} />
      ) : rows.length === 0 ? (
        <EmptyCard Icon={CalendarIcon} tone="sky" title={tr("Jadval hali kiritilmagan")} text={tr("Bog'cha jadvalni to'ldirgach, shu yerda kunma-kun ko'rinadi.")} />
      ) : (
        <div className="space-y-4 pb-6 pt-5">
          {/* Kun / Hafta */}
          <div className="flex rounded-full bg-[var(--p-sunken)] p-1" role="radiogroup" aria-label={tr("Ko'rinish")}>
            {(["day", "week"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={clsx(
                  "h-9 flex-1 rounded-full text-[14.5px] font-bold transition-colors",
                  mode === m ? "bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)]" : "text-[var(--p-muted)]",
                )}
              >
                {m === "day" ? tr("Kun") : tr("Hafta")}
              </button>
            ))}
          </div>

          {mode === "day" ? (
            <>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={tr("Hafta kuni")}>
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={day === d}
                    aria-label={tr(DAY_LONG[d])}
                    onClick={() => setDay(d)}
                    className={clsx(
                      "flex h-12 flex-col items-center justify-center rounded-2xl text-[14px] font-bold transition-colors",
                      day === d ? "bg-[var(--p-sun)] text-white shadow-[var(--p-shadow)]" : "bg-[var(--p-card)] text-[var(--p-ink)]",
                    )}
                  >
                    {tr(DAY_SHORT[d])}
                    {d === today && <span className={clsx("mt-0.5 h-1 w-1 rounded-full", day === d ? "bg-white" : "bg-[var(--p-sun)]")} aria-hidden="true" />}
                  </button>
                ))}
              </div>

              <section className="overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
                <p className="px-5 pb-1 pt-4 text-[13px] font-bold text-[var(--p-muted)]">
                  {tr(DAY_LONG[day])}
                  {day === today ? ` · ${tr("bugun")}` : ""}
                </p>
                {dayRows.length === 0 ? (
                  <p className="px-5 pb-5 pt-1 text-[15px] text-[var(--p-muted)]">{tr("Bu kuni mashg'ulot yo'q")}</p>
                ) : (
                  <ul className="pb-2">
                    {dayRows.map(({ row, index }) => {
                      const current = day === today && isNowRow(rows, index, now);
                      return (
                        <li key={`${row.startTime}-${row.endTime}`} className={clsx("mx-2 flex items-start gap-3 rounded-2xl px-3 py-2.5", current && "bg-[var(--p-sun)]/16")}>
                          <span className="w-[92px] shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-[var(--p-muted)]">{timeLabel(row)}</span>
                          <span className="min-w-0 flex-1 text-[15.5px] font-semibold leading-snug text-[var(--p-ink)]">
                            {row.cells[day]}
                            {current && (
                              <span className="ml-2 inline-flex h-5 items-center rounded-full bg-[var(--p-sun)] px-2 align-[1px] text-[11.5px] font-bold text-white">
                                {tr("Hozir")}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          ) : (
            // Butun hafta — bog'chadagi qog'oz jadval kabi; ekranga sig'masa yonga suriladi
            <section className="overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-[var(--p-card)] px-3 py-3 text-left font-bold text-[var(--p-muted)]">{tr("Vaqt")}</th>
                      {days.map((d) => (
                        <th key={d} className={clsx("px-2 py-3 text-center font-bold", d === today ? "text-[var(--p-sun-ink)]" : "text-[var(--p-ink)]")}>
                          {tr(DAY_SHORT[d])}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.startTime}-${row.endTime}`} className="border-t border-[var(--p-line)]">
                        <td className="sticky left-0 whitespace-nowrap bg-[var(--p-card)] px-3 py-2 font-semibold tabular-nums text-[var(--p-muted)]">{timeLabel(row)}</td>
                        {days.map((d) => (
                          <td key={d} className={clsx("px-2 py-2 text-center leading-snug text-[var(--p-ink)]", d === today && "bg-[var(--p-sun)]/10")}>
                            {row.cells[d] || <span className="text-[var(--p-muted)]">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {data.note && (
            <section className="rounded-[var(--p-radius)] bg-[var(--p-sky)]/12 px-5 py-4">
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-[var(--p-ink)]">{data.note}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
