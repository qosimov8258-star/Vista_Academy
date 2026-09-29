/**
 * ISAPI vaqt formati: "2026-09-29T08:00:00+05:00" — qurilmaning mahalliy
 * vaqti zona siljishi bilan. Siljish filial vaqt zonasidan (ERP beradi)
 * hisoblanadi, kompyuter soatidan emas.
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
