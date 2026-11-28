/**
 * Qishki bezak davri (Toshkent vaqti bo'yicha): 20-noyabrdan fevral
 * oxirigacha. Shu kunlarda kabinetda qor yog'adi, fon va kartalar qishki
 * ko'rinishda bo'ladi; mart kelishi bilan o'zi oddiy holatga qaytadi.
 */
const WINTER_START = { month: 11, day: 20 };

export function isWinterSeason(now: Date = new Date()): boolean {
  const [month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  if (month === 12 || month === 1 || month === 2) return true;
  return month === WINTER_START.month && day >= WINTER_START.day;
}
