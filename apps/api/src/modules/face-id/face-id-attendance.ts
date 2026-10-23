/**
 * Yuz tanish voqealaridan kunlik xodim davomatini hisoblash — sof
 * funksiyalar (bazaga bog'liq emas), shuning uchun alohida sinovdan o'tadi.
 *
 * Qoida (filial vaqt zonasi, odatda Asia/Tashkent, bo'yicha bir kun):
 * - Terminal yo'nalish bersa (kirish va chiqish bitta terminalda, odam
 *   ekranda "KIRISH"/"CHIQISH"ni tanlaydi) — kelgan vaqti birinchi kirish,
 *   ketgani oxirgi chiqish. Kirish tanlanmagan bo'lsa ham kelgani birinchi
 *   voqea (odam "kelmadi" bo'lib qolmasin); chiqishdan keyin yana kirgan
 *   bo'lsa — hali ketmagan.
 * - Yo'nalish bo'lmasa — birinchi voqea kelgan, oxirgisi ketgan vaqti.
 *   Ketish faqat kelishdan kamida `MIN_CHECKOUT_GAP_MINUTES` keyin bo'lsa
 *   yoziladi: aks holda terminal oldida ikki marta yuz ko'rsatish "ketdi"
 *   deb yozilib qolardi.
 */

export const MIN_CHECKOUT_GAP_MINUTES = 30;

export type FaceIdDirection = "in" | "out";

/** Bitta terminal voqeasi: vaqti va (terminal bersa) yo'nalishi. */
export interface FaceIdPassage {
  time: Date;
  direction?: FaceIdDirection | null;
}

/**
 * Hikvision AcsEvent'dagi `attendanceStatus` → yo'nalish. Terminalda
 * davomat rejimi yoqilmagan bo'lsa maydon bo'lmaydi yoki "undefined" keladi.
 */
export function directionFromRaw(raw: unknown): FaceIdDirection | null {
  const status = raw && typeof raw === "object" ? (raw as { attendanceStatus?: unknown }).attendanceStatus : undefined;
  switch (status) {
    case "checkIn":
    case "breakIn":
    case "overtimeIn":
      return "in";
    case "checkOut":
    case "breakOut":
    case "overtimeOut":
      return "out";
    default:
      return null;
  }
}

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
  events: Array<Date | FaceIdPassage>,
  opts: { timeZone: string; openTime?: string | null; graceMinutes: number },
): DailyAttendance | null {
  if (events.length === 0) return null;
  const sorted = events
    .map((e) => (e instanceof Date ? { time: e, direction: null } : { time: e.time, direction: e.direction ?? null }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  let arrival: Date;
  let departure: Date | null;
  if (sorted.some((e) => e.direction)) {
    arrival = (sorted.find((e) => e.direction === "in") ?? sorted[0]).time;
    const lastOut = [...sorted].reverse().find((e) => e.direction === "out" && e.time > arrival);
    const backInside = lastOut && sorted.some((e) => e.direction === "in" && e.time > lastOut.time);
    departure = lastOut && !backInside ? lastOut.time : null;
  } else {
    arrival = sorted[0].time;
    const last = sorted[sorted.length - 1].time;
    departure = (last.getTime() - arrival.getTime()) / 60_000 >= MIN_CHECKOUT_GAP_MINUTES ? last : null;
  }
  const checkInTime = localTimeHHMM(arrival, opts.timeZone);
  const checkOutTime = departure ? localTimeHHMM(departure, opts.timeZone) : null;

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
