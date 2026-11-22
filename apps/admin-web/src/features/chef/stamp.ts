/**
 * Menyu va taom suratlari qachon qo'yilganini yozish — bog'cha vaqti
 * (Toshkent) bo'yicha: «Bugun, 09:10», «Kecha, 12:05», «20-noyabr, 18:40».
 * Oshpaz bosh sahifadagi menyu kecha yoki undan oldin qo'yilganmi, bir
 * qarashda bilsin.
 */

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" });
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hour12: false });

/** "YYYY-MM-DD" ± kun */
function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Tr = (key: string, ...args: (string | number)[]) => string;

/** ISO vaqt → kun («Bugun», «Kecha», «20-noyabr») va soat («12:05») */
export function stampParts(iso: string, today: string, tr: Tr): { day: string; time: string; isToday: boolean } {
  const date = new Date(iso);
  const key = DAY.format(date);
  const time = TIME.format(date);
  if (key === today) return { day: tr("Bugun"), time, isToday: true };
  if (key === shiftDay(today, -1)) return { day: tr("Kecha"), time, isToday: false };
  return { day: `${Number(key.slice(8, 10))}-${tr(MONTHS[Number(key.slice(5, 7)) - 1])}`, time, isToday: false };
}

/** «Kecha, 12:05» */
export function stampLabel(iso: string, today: string, tr: Tr): string {
  const { day, time } = stampParts(iso, today, tr);
  return `${day}, ${time}`;
}

/** Surat burchagidagi qisqa belgi: «12:05» (bugun), «Kecha 12:05», «20.11 12:05» */
export function stampBadge(iso: string, today: string, tr: Tr): string {
  const { day, time, isToday } = stampParts(iso, today, tr);
  if (isToday) return time;
  const key = DAY.format(new Date(iso));
  return key === shiftDay(today, -1) ? `${day} ${time}` : `${key.slice(8, 10)}.${key.slice(5, 7)} ${time}`;
}
