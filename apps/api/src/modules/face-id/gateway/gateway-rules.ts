import { randomInt } from "crypto";

/** O'xshash belgilarsiz (0/O, 1/l/I) — terminalga qo'lda kiritiladi. */
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KEY_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const randomFrom = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");

/** ISUP «Device ID» — butun platformada noyob (to'qnashsa chaqiruvchi qayta yasaydi). */
export const newIsupDeviceId = () => `ZR${randomFrom(ID_CHARS, 6)}`;

/**
 * ISUP kaliti. Terminal (DS-K1T342EX, V4.39) 8–16 belgi va albatta katta
 * harf + kichik harf + raqam talab qiladi — faqat kichik harfli kalitni
 * «Encryption Key» maydoni qabul qilmaydi (haqiqiy qurilmada tekshirilgan).
 */
export const isStrongIsupKey = (k: string) => k.length >= 8 && k.length <= 16 && /[A-Z]/.test(k) && /[a-z]/.test(k) && /\d/.test(k);
export const newIsupKey = () => {
  for (;;) {
    const k = randomFrom(KEY_CHARS, 12);
    if (isStrongIsupKey(k)) return k;
  }
};

/**
 * ISAPI vaqt formati: "2026-09-29T08:00:00+05:00" — qurilmaning mahalliy
 * vaqti zona siljishi bilan. Siljish filial vaqt zonasidan hisoblanadi
 * (hik-agent/src/time.ts bilan bir xil).
 */
export function isapiTime(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  // "GMT+05:00" → "+05:00"; "GMT" (UTC) → "+00:00"
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : String(parts.timeZoneName).replace("GMT", "");
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

/** UTF-8 baytlari bo'yicha xavfsiz qisqartirish — terminal ismga 32 bayt joy beradi. */
export function truncateUtf8(text: string, maxBytes: number): string {
  let out = "";
  for (const ch of text) {
    if (Buffer.byteLength(out + ch, "utf8") > maxBytes) break;
    out += ch;
  }
  return out;
}
