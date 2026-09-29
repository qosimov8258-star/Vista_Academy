"use client";

import { useQuery } from "@tanstack/react-query";
import type { DiaryDay, DiaryDaySummary, DiaryItem, DiaryMedia } from "@/features/diary/types";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";

export type { DiaryActivityKind, DiaryDay, DiaryDaySummary, DiaryItem, DiaryMedia } from "@/features/diary/types";

/**
 * Kundalik — guruhning kun tartibi, tarbiyachi belgilari va kun lahzalari.
 *
 *   GET /app/parent/children/:childId/diary?date=YYYY-MM-DD   → DiaryDay
 *   GET /app/parent/children/:childId/diary/days?count=14     → DiaryDaySummary[]
 *   GET /app/parent/diary/media/:id/file | /poster            → fayl (video Range bilan)
 *
 * Tarbiyachi tomoni va to'liq shartnoma: docs/kundalik-api.md.
 */

const noRetryOnAuth = (count: number, error: unknown) =>
  !(error instanceof ApiError && [400, 401, 404].includes(error.status)) && count < 1;

export function useDiaryDay(childId: string | null, date: string | null) {
  return useQuery({
    queryKey: ["parent-diary", childId, date ?? "today"],
    queryFn: () =>
      parentApi.get<DiaryDay>(
        `/app/parent/children/${childId}/diary${date ? `?date=${encodeURIComponent(date)}` : ""}`,
      ),
    enabled: !!childId,
    retry: noRetryOnAuth,
    // Bugungi kun jonli: tarbiyachi belgilagani bir daqiqa ichida ko'rinadi
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && data.date === data.today ? 60_000 : false;
    },
    refetchOnWindowFocus: true,
  });
}

export function useDiaryDays(childId: string | null) {
  return useQuery({
    queryKey: ["parent-diary-days", childId],
    queryFn: () => parentApi.get<DiaryDaySummary[]>(`/app/parent/children/${childId}/diary/days?count=14`),
    enabled: !!childId,
    retry: noRetryOnAuth,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function mediaUrl(media: Pick<DiaryMedia, "id">, variant: "file" | "poster" = "file"): string {
  return `${PARENT_API_URL}/app/parent/diary/media/${media.id}/${variant}`;
}

/** Galereyaga saqlash uchun faylning o'zi (cookie bilan) */
export async function fetchMediaFile(media: DiaryMedia, date: string, index: number): Promise<File> {
  const response = await fetch(mediaUrl(media), { credentials: "include" });
  if (!response.ok) {
    throw new Error("Faylni yuklab bo'lmadi");
  }
  const blob = await response.blob();
  const extension =
    media.mimeType === "image/png"
      ? "png"
      : media.mimeType === "image/webp"
        ? "webp"
        : media.mimeType === "video/webm"
          ? "webm"
          : media.mimeType === "video/quicktime"
            ? "mov"
            : media.kind === "VIDEO"
              ? "mp4"
              : "jpg";
  return new File([blob], `kundalik-${date}-${index + 1}.${extension}`, { type: media.mimeType });
}

/* --------------------------------------------------------------- vaqt */

const TIMEZONE = "Asia/Tashkent";

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Bog'cha vaqti bo'yicha hozirgi daqiqa (kun boshidan) */
export function nowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const WEEKDAYS_LONG = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const WEEKDAYS_SHORT = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];

export function weekdayIndex(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/** "2026-09-16" → "Chorshanba, 16-sentabr" */
export function prettyDay(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return `${WEEKDAYS_LONG[d.getUTCDay()]}, ${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`;
}

export function dayNumber(date: string): number {
  return Number(date.slice(8, 10));
}

export function isWeekend(date: string): boolean {
  const wd = weekdayIndex(date);
  return wd === 0 || wd === 6;
}

/** ISO vaqt → "12:05" (bog'cha vaqti bilan) */
export function clockOf(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function durationLabel(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type ItemPhase = "done" | "now" | "later" | "missed";

/**
 * Bandning holati. Faqat bugun uchun "hozir" va "keyin" bor; o'tgan kunda
 * belgilanmagan band "missed" — ota-onaga qo'rqitmasdan, xira ko'rsatiladi.
 */
export function phaseOf(items: DiaryItem[], index: number, isToday: boolean, now: number): ItemPhase {
  const item = items[index];
  if (item.done) return "done";
  if (!isToday) return "missed";
  const start = minutesOf(item.startTime);
  if (start > now) return "later";
  const nextStart = items.slice(index + 1).find((next) => minutesOf(next.startTime) > start);
  const end = item.endTime ? minutesOf(item.endTime) : nextStart ? minutesOf(nextStart.startTime) : start + 60;
  return now < end ? "now" : "missed";
}
