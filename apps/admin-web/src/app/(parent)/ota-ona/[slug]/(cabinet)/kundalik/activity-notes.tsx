"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import styles from "../../parent.module.css";
import { parentApi } from "@/lib/parent-api";
import type { ParentDay } from "@/lib/types";
import { useTr } from "@/i18n/tr";

/**
 * «Bugun nima qildik» — tarbiyachi kunlik hisobotga yozgan mashg'ulotlar.
 * Ilgari bosh sahifada to'liq turardi va uzun dars rejasi bilan sahifani
 * egallab olardi; endi Kundalikda, tanlangan kun uchun, uzun bo'lsa
 * yig'ilgan holda («To'liq o'qish»).
 */
export function ActivityNotes({ childId, date, isToday }: { childId: string; date: string; isToday: boolean }) {
  const tr = useTr();
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({
    queryKey: ["parent-day", childId, date],
    queryFn: () => parentApi.get<ParentDay>(`/app/parent/children/${childId}/day?date=${date}`),
    staleTime: 60_000,
  });
  const notes = query.data?.report?.activityNotes?.trim();
  if (!query.data) return null;
  const long = !!notes && (notes.length > 280 || notes.split("\n").length > 5);

  return (
    <section className="mt-5 rounded-[var(--p-radius)] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--p-lilac)]/16 text-[var(--p-lilac-ink)]">
          <NotebookPen className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <h2 className={`${styles.roundedFont} text-[18px] font-extrabold text-[var(--p-ink)]`}>
          {isToday ? tr("Bugun nima qildik") : tr("Shu kuni nima qildik")}
        </h2>
      </div>
      {notes ? (
        <>
          <p className={`mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[var(--p-ink)] ${long && !expanded ? "line-clamp-5" : ""}`}>
            {notes}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 min-h-[36px] text-[14px] font-bold text-[var(--p-lilac-ink)]"
            >
              {expanded ? tr("Yig'ish") : tr("To'liq o'qish")}
            </button>
          )}
        </>
      ) : (
        <p className="mt-3 text-[14px] text-[var(--p-muted)]">{tr("Tarbiyachi hali yozmadi")}</p>
      )}
    </section>
  );
}
