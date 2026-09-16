import { Weekday } from "@prisma/client";

/**
 * Kundalik cheklovlari. Media hozircha bazada saqlanadi, shuning uchun
 * hajm qat'iy: rasm va videoni tarbiyachi paneli yuborishdan oldin
 * brauzerda siqib/kichraytirib yuboradi (qarang: docs/kundalik-api.md).
 */
export const DIARY_LIMITS = {
  photoMaxBytes: 3 * 1024 * 1024,
  videoMaxBytes: 8 * 1024 * 1024,
  posterMaxBytes: 512 * 1024,
  /** Bir guruhga bir kunda */
  photosPerDay: 10,
  videosPerDay: 2,
  routineMaxItems: 30,
  titleMaxLength: 80,
  noteMaxLength: 500,
  captionMaxLength: 280,
  /** Ota-ona kabinetidagi kunlar tasmasi */
  parentDaysMax: 31,
} as const;

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const POSTER_MIME_TYPES = ["image/jpeg", "image/webp", "image/png"] as const;

/** "HH:mm", 00:00–23:59 */
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
/** "YYYY-MM-DD" */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_TIMEZONE = "Asia/Tashkent";

/** Dushanbadan juma'gacha — shablon bandining sukutdagi kunlari */
export const WORKDAYS: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
];

/** `Date.getUTCDay()` tartibida (0 — yakshanba) */
const WEEKDAY_BY_INDEX: Weekday[] = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
];

export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAY_BY_INDEX[toDateOnly(date).getUTCDay()];
}

/** Filial vaqt mintaqasidagi bugungi sana */
export function todayIn(timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone ?? DEFAULT_TIMEZONE }).format(new Date());
}

/** Sana haqiqiy kalendardagi kunmi ("2026-02-30" emas) */
export function isRealDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const parsed = toDateOnly(value);
  return !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
