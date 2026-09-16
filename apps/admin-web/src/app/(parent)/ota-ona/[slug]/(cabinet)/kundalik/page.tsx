"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import styles from "../../parent.module.css";
import { EmptyCard, ListSkeleton, LoadErrorCard } from "../foydali/ui";
import { DayContent, DayStrip } from "./day-view";
import { nowMinutes, useDiaryDay, useDiaryDays, type DiaryMedia } from "./diary";
import { DiaryIcon } from "./kinds";
import { MediaViewer } from "./media-viewer";

/** Har 30 soniyada yangilanadigan soat — "hozir" belgisi siljib borsin */
function useNowMinutes(): number {
  const [now, setNow] = useState(() => nowMinutes());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowMinutes()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Kundalik — bola bog'chada kuni qanday o'tayotganini ko'rsatadi:
 * tarbiyachi belgilagan mashg'ulotlar vaqt chizig'ida, kun lahzalari
 * (rasm va video) alohida galereyada. Bugungi kun har daqiqada yangilanadi.
 */
export default function ParentDiaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ items: DiaryMedia[]; index: number } | null>(null);

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
  const daysQuery = useDiaryDays(childId);
  const dayQuery = useDiaryDay(childId, selectedDate);
  const day = dayQuery.data;
  const now = useNowMinutes();

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <header>
        <h1 className={`${styles.roundedFont} text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]`}>
          Kundalik
        </h1>
        <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--p-muted)]">
          {day?.group ? `${day.group.name} · bog'chadagi kun` : "Bolangizning bog'chadagi kuni"}
        </p>
      </header>

      {children.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveChildId(c.id);
                setSelectedDate(null);
              }}
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

      {daysQuery.data && daysQuery.data.length > 0 && (
        <DayStrip
          days={daysQuery.data}
          selected={selectedDate ?? daysQuery.data[0].date}
          onSelect={(date) => setSelectedDate(date === daysQuery.data?.[0].date ? null : date)}
        />
      )}

      {!day ? (
        dayQuery.isError || meQuery.isError ? (
          <LoadErrorCard
            error={dayQuery.error ?? meQuery.error}
            onRetry={() => {
              meQuery.refetch();
              dayQuery.refetch();
            }}
            loginHref={`/ota-ona/${slug}/kirish`}
          />
        ) : meQuery.data && children.length === 0 ? (
          <EmptyCard Icon={DiaryIcon} tone="sun" title="Bola biriktirilmagan" text="Kabinetingizga hali bola biriktirilmagan — bog'cha ma'muriyatiga murojaat qiling." />
        ) : (
          <>
            <div className="mt-5 h-[132px] animate-pulse rounded-[var(--p-radius)] bg-[var(--p-card)]/70 motion-reduce:animate-none" />
            <ListSkeleton rows={4} />
          </>
        )
      ) : (
        <DayContent
          key={`${childId}-${day.date}`}
          day={day}
          now={now}
          onOpenMedia={(items, index) => setViewer({ items, index })}
        />
      )}

      {viewer && day && (
        <MediaViewer items={viewer.items} startIndex={viewer.index} date={day.date} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
