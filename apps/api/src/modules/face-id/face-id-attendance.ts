/**
 * Yuz tanish voqealaridan kunlik xodim davomatini hisoblash — sof
 * funksiyalar (bazaga bog'liq emas), shuning uchun alohida sinovdan o'tadi.
 *
 * Qoida: filial vaqt zonasi (odatda Asia/Tashkent) bo'yicha bir kundagi
 * birinchi voqea — kelgan, oxirgisi — ketgan vaqti. Ketish faqat kelishdan
 * kamida `MIN_CHECKOUT_GAP_MINUTES` keyin bo'lsa yoziladi: aks holda
 * terminal oldida ikki marta yuz ko'rsatish "ketdi" deb yozilib qolardi.
 */

export const MIN_CHECKOUT_GAP_MINUTES = 30;

/** Sana kaliti ("YYYY-MM-DD") berilgan vaqt zonasida. */
export function localDateKey(time: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(time);
}

/** "HH:MM" berilgan vaqt zonasida (24 soatlik). */
export function localTimeHHMM(time: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(time);
}

function minutesOf(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface DailyAttendance {
  checkInTime: string;
  checkOutTime: string | null;
  /** Filial ochilish vaqti belgilangan va kelish undan `graceMinutes`dan kech bo'lsa */
  late: boolean;
}

/**
 * Bir xodimning bir kundagi voqealari (tartibsiz ham bo'lishi mumkin) →
 * kelish/ketish vaqti. Voqea bo'lmasa `null`.
 */
export function computeDailyAttendance(
  times: Date[],
  opts: { timeZone: string; openTime?: string | null; graceMinutes: number },
): DailyAttendance | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const checkInTime = localTimeHHMM(first, opts.timeZone);
  const gapMinutes = (last.getTime() - first.getTime()) / 60_000;
  const checkOutTime = gapMinutes >= MIN_CHECKOUT_GAP_MINUTES ? localTimeHHMM(last, opts.timeZone) : null;

  const open = opts.openTime ? minutesOf(opts.openTime) : null;
  const arrived = minutesOf(checkInTime);
  const late = open !== null && arrived !== null && arrived > open + opts.graceMinutes;

  return { checkInTime, checkOutTime, late };
}

/**
 * Berilgan mahalliy sana atrofidagi UTC oralig'i — bazadan shu kun
 * voqealarini keng olib, keyin `localDateKey` bilan aniq saralash uchun.
 * Istalgan vaqt zonasi (UTC−14…+14) shu oraliqqa sig'adi.
 */
export function utcWindowAround(dateKey: string): { from: Date; to: Date } {
  const midnightUtc = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  return { from: new Date(midnightUtc - 14 * 3_600_000), to: new Date(midnightUtc + 38 * 3_600_000) };
}

/** Kechikishga beriladigan imtiyoz (daqiqa) — env'dan, noto'g'ri bo'lsa 10. */
export function lateGraceMinutes(): number {
  const raw = Number(process.env.FACE_ID_LATE_GRACE_MINUTES);
  return Number.isFinite(raw) && raw >= 0 ? raw : 10;
}
