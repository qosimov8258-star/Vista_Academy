"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LessonSchedule, Weekday } from "@/lib/types";
import { CalendarIcon, ClockIcon } from "@/components/ios/icons";
import { IOS_TINT } from "@/features/director/ios-icon";
import { Pill } from "@/components/ios/pill";
import { ErrorState } from "@/components/ios/states";
import { EmptyRow, Group, LargeTitle, SkeletonRows, TeacherPage } from "./teacher-ui";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";

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
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** Guruh rangi — har guruh o'z rangida, jadvalda ko'z bilan tez ajraladi */
const GROUP_COLORS = [IOS_TINT.blue, IOS_TINT.orange, IOS_TINT.green, IOS_TINT.purple, IOS_TINT.pink, IOS_TINT.teal, IOS_TINT.indigo];
function groupColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Joriy haftaning kunlari (dushanbadan) — hafta tasmasida sana raqami uchun */
function currentWeekDates(now: Date): Record<Weekday, Date> {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7), 12);
  const out = {} as Record<Weekday, Date>;
  WEEK.forEach((d, i) => {
    out[d.key] = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12);
  });
  return out;
}

/**
 * Tarbiyachining dars jadvali — iOS Taqvimidagidek: tepada hafta tasmasi
 * (kun va sana, darsi bor kunlar ostida nuqta), ostida tanlangan kun
 * darslari vaqt bo'yicha; bugun bo'layotgan dars «Hozir» bilan belgilanadi.
 * Jadvalni filial admini tuzadi — bu yerda faqat ko'rinadi.
 */
export function TeacherSchedule({ slug }: { slug: string }) {
  const tr = useTr();
  const [now, setNow] = useState<Date | null>(null);
  const [day, setDay] = useState<Weekday>("MONDAY");
  // Hafta kuni va soat foydalanuvchi soatiga bog'liq — faqat brauzerda hisoblanadi
  useEffect(() => {
    const t = new Date();
    setNow(t);
    setDay(WEEKDAY_BY_JS_DAY[t.getDay()]);
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const today = now ? WEEKDAY_BY_JS_DAY[now.getDay()] : null;
  const dates = now ? currentWeekDates(now) : null;
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : -1;

  // Bosh sahifa bilan bir xil kalit — tarbiyachiga faqat o'z guruhlari darslari keladi
  const query = useQuery({
    queryKey: ["lesson-schedules", slug, "dashboard"],
    queryFn: () => api.get<LessonSchedule[]>("/app/lesson-schedules"),
  });
  const all = query.data ?? [];
  const countFor = (d: Weekday) => all.filter((l) => l.weekday === d).length;
  const lessons = all.filter((l) => l.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const current = WEEK.find((d) => d.key === day)!;
  const selectedDate = dates?.[day];
  const dayTitle = `${day === today ? `${tr("Bugun")} · ` : ""}${tr(current.label)}${selectedDate ? `, ${selectedDate.getDate()}-${tr(MONTHS[selectedDate.getMonth()])}` : ""}`;

  return (
    <TeacherPage>
      <LargeTitle
        icon={CalendarIcon}
        tint="orange"
        title={tr("Dars jadvali")}
        subtitle={
          query.data
            ? today
              ? tr("Bugun {0} ta dars · haftasiga {1} ta", countFor(today), all.length)
              : tr("Haftasiga {0} ta dars", all.length)
            : undefined
        }
      />

      {/* Hafta tasmasi: kun + sana; tanlangani tizim rangidagi doira, bugungi — rangli raqam */}
      <div className={clsx(styles.group, "grid grid-cols-7 px-1.5 py-2")} role="tablist" aria-label={tr("Hafta kuni")}>
        {WEEK.map((d) => {
          const active = d.key === day;
          const isToday = d.key === today;
          const has = countFor(d.key) > 0;
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tr(d.label)}
              onClick={() => setDay(d.key)}
              className="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] transition-colors active:bg-black/[0.04]"
            >
              <span className={clsx("text-[12px] font-medium", isToday && !active ? "text-[var(--color-primary)]" : "text-[#8e8e93]")}>{tr(d.short)}</span>
              <span
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-full text-[17px] tabular-nums transition-colors",
                  active
                    ? "bg-[var(--color-primary)] font-semibold text-white"
                    : isToday
                      ? "font-semibold text-[var(--color-primary)]"
                      : "text-[var(--color-text)]",
                )}
              >
                {dates ? dates[d.key].getDate() : tr(d.short)}
              </span>
              <span className={clsx("h-1.5 w-1.5 rounded-full", has ? "bg-[#c7c7cc]" : "bg-transparent")} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {query.isError && !query.data ? (
        <ErrorState message={tr((query.error as Error).message)} onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : (
        <Group
          title={dayTitle}
          action={lessons.length > 0 ? <span className="text-[13px] tabular-nums text-[#8e8e93]">{tr("{0} ta dars", lessons.length)}</span> : undefined}
          footer={tr("Dars jadvalini filial admini tuzadi. O'zgarsa, «Xabarlar»ga bildirishnoma keladi.")}
        >
          {query.isLoading ? (
            <SkeletonRows rows={3} />
          ) : lessons.length === 0 ? (
            <EmptyRow icon={ClockIcon} title={tr("Bu kunda dars yo'q")} description={tr("Boshqa kunni tanlang — darsi bor kunlar ostida nuqta bor.")} />
          ) : (
            lessons.map((lesson, i) => {
              const live = day === today && nowMinutes >= toMinutes(lesson.startTime) && nowMinutes < toMinutes(lesson.endTime);
              const done = day === today && nowMinutes >= toMinutes(lesson.endTime);
              const color = groupColor(lesson.group.id);
              return (
                <div key={lesson.id} className={clsx("relative flex min-h-[64px] items-center gap-3 px-4 py-2.5", done && "opacity-55")}>
                  {i > 0 && <span className="absolute left-[72px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
                  {/* Vaqt ustuni */}
                  <span className="flex w-[44px] shrink-0 flex-col leading-tight tabular-nums">
                    <span className="text-[15px] font-semibold text-[var(--color-text)]">{lesson.startTime}</span>
                    <span className="text-[12.5px] text-[#8e8e93]">{lesson.endTime}</span>
                  </span>
                  {/* Guruh rangidagi chiziq — iOS Taqvimidagidek */}
                  <span className="w-[3px] self-stretch rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-medium leading-snug text-[var(--color-text)]">{tr(lesson.subject || "Dars")}</span>
                    <span className="mt-0.5 block truncate text-[13px] leading-snug text-[#8e8e93]">
                      {[tr(lesson.group.name), lesson.room?.name ? tr(lesson.room.name) : null, lesson.employee.fullName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {live && <Pill color={IOS_TINT.green}>{tr("Hozir")}</Pill>}
                </div>
              );
            })
          )}
        </Group>
      )}
    </TeacherPage>
  );
}
