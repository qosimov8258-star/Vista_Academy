import type { AnalyticsPeriod } from "./dto/analytics-query.dto";

/** Platforma Toshkent vaqtida ishlaydi (UTC+5, yozgi vaqt yo'q). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PeriodRange {
  start: Date;
  /** Oxiri kirmaydi: [start, end) */
  end: Date;
  previousStart: Date;
}

/**
 * Joriy kalendar davri (bugun / shu hafta (dushanbadan) / shu oy / shu yil)
 * va undan oldingi xuddi shunday davr — "o'tgan davrga nisbatan" uchun.
 */
export function periodRange(period: AnalyticsPeriod, now: Date = new Date()): PeriodRange {
  // Toshkent devor soatini UTC getterlar bilan o'qish uchun siljitilgan sana
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const toUtc = (wallClockMs: number) => new Date(wallClockMs - TASHKENT_OFFSET_MS);

  switch (period) {
    case "day": {
      const start = Date.UTC(y, m, d);
      return { start: toUtc(start), end: toUtc(start + DAY_MS), previousStart: toUtc(start - DAY_MS) };
    }
    case "week": {
      const mondayOffset = (local.getUTCDay() + 6) % 7;
      const start = Date.UTC(y, m, d - mondayOffset);
      return { start: toUtc(start), end: toUtc(start + 7 * DAY_MS), previousStart: toUtc(start - 7 * DAY_MS) };
    }
    case "month":
      return {
        start: toUtc(Date.UTC(y, m, 1)),
        end: toUtc(Date.UTC(y, m + 1, 1)),
        previousStart: toUtc(Date.UTC(y, m - 1, 1)),
      };
    case "year":
      return {
        start: toUtc(Date.UTC(y, 0, 1)),
        end: toUtc(Date.UTC(y + 1, 0, 1)),
        previousStart: toUtc(Date.UTC(y - 1, 0, 1)),
      };
  }
}

/** Oxirgi `count` oy kalitlari ("2026-10"), eskisidan yangisiga — Toshkent vaqtida. */
export function lastMonthKeys(count: number, now: Date = new Date()): string[] {
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - i, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** `lastMonthKeys` ning birinchi oyi boshlanishi (UTC) — SQL filtri uchun. */
export function monthKeyStart(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1) - TASHKENT_OFFSET_MS);
}

/** O'zgarish foizi; oldingi qiymat 0 bo'lsa solishtirib bo'lmaydi — null. */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
