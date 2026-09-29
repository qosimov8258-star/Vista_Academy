"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LessonSchedule, Weekday } from "@/lib/types";
import { ClockIcon } from "@/components/ui/icons";
import { EmptyRow, Group, LargeTitle, Row, SkeletonRows, TeacherPage } from "./teacher-ui";
import styles from "./teacher.module.css";

const WEEK: { key: Weekday; short: string; label: string }[] = [
  { key: "MONDAY", short: "Du", label: "Dushanba" },
  { key: "TUESDAY", short: "Se", label: "Seshanba" },
  { key: "WEDNESDAY", short: "Ch", label: "Chorshanba" },
  { key: "THURSDAY", short: "Pa", label: "Payshanba" },
  { key: "FRIDAY", short: "Ju", label: "Juma" },
  { key: "SATURDAY", short: "Sh", label: "Shanba" },
  { key: "SUNDAY", short: "Ya", label: "Yakshanba" },
];
const WEEKDAY_BY_JS_DAY: Weekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/**
 * Tarbiyachining dars jadvali — iOS Taqvimidagidek tepada hafta tasmasi
 * (darsi bor kunlar ostida nuqta), ostida tanlangan kun darslari.
 * Jadvalni filial admini tuzadi — bu yerda faqat ko'rinadi.
 */
export function TeacherSchedule({ slug }: { slug: string }) {
  const [today, setToday] = useState<Weekday | null>(null);
  const [day, setDay] = useState<Weekday>("MONDAY");
  // Hafta kuni foydalanuvchi soatiga bog'liq — faqat brauzerda hisoblanadi
  useEffect(() => {
    const t = WEEKDAY_BY_JS_DAY[new Date().getDay()];
    setToday(t);
    setDay(t);
  }, []);

  // Bosh sahifa bilan bir xil kalit — tarbiyachiga faqat o'z guruhlari darslari keladi
  const query = useQuery({
    queryKey: ["lesson-schedules", slug, "dashboard"],
    queryFn: () => api.get<LessonSchedule[]>("/app/lesson-schedules"),
  });
  const all = query.data ?? [];
  const lessons = all.filter((l) => l.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const current = WEEK.find((d) => d.key === day)!;

  return (
    <TeacherPage>
      <LargeTitle title="Dars jadvali" subtitle={`Haftasiga ${all.length} ta dars`} />

      {/* Hafta tasmasi */}
      <div className={clsx(styles.group, "grid grid-cols-7 gap-1 p-2")} role="tablist" aria-label="Hafta kuni">
        {WEEK.map((d) => {
          const active = d.key === day;
          const has = all.some((l) => l.weekday === d.key);
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={d.label}
              onClick={() => setDay(d.key)}
              className={clsx(
                "flex cursor-pointer flex-col items-center gap-1 rounded-[14px] py-2 transition-colors",
                active ? "bg-[var(--color-primary)] text-white" : "active:bg-black/5",
              )}
            >
              <span
                className={clsx(
                  "text-[14px] font-semibold",
                  !active && (d.key === today ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"),
                )}
              >
                {d.short}
              </span>
              <span
                className={clsx("h-1.5 w-1.5 rounded-full", has ? (active ? "bg-white" : "bg-[var(--color-primary)]") : "bg-transparent")}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <Group title={day === today ? `Bugun · ${current.label}` : current.label} footer="Dars jadvalini filial admini tuzadi. O'zgarsa, «Xabarlar»ga bildirishnoma keladi.">
        {query.isLoading ? (
          <SkeletonRows rows={3} />
        ) : query.isError ? (
          <EmptyRow title="Yuklab bo'lmadi" description={(query.error as Error).message} />
        ) : lessons.length === 0 ? (
          <EmptyRow icon={ClockIcon} title="Bu kunda dars yo'q" />
        ) : (
          lessons.map((lesson, i) => (
            <Row
              key={lesson.id}
              first={i === 0}
              leading={
                <span className="flex w-[40px] shrink-0 flex-col items-start leading-tight tabular-nums">
                  <span className="text-[15px] font-semibold text-[var(--color-text)]">{lesson.startTime}</span>
                  <span className="text-[12.5px] text-[var(--color-text-muted)]">{lesson.endTime}</span>
                </span>
              }
              title={lesson.subject || "Dars"}
              subtitle={`${lesson.group.name} · ${lesson.employee.fullName}`}
            />
          ))
        )}
      </Group>
    </TeacherPage>
  );
}
