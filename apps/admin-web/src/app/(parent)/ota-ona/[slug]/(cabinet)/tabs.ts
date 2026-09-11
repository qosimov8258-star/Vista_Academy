import { BulbIcon, HomeIcon, NoteIcon, SettingsIcon } from "@/components/ui/icons";

/**
 * Pastki menyu tartibi. Menyu ham, sahifa o'tishi ham shu ro'yxatdan
 * foydalanadi: o'tish yo'nalishi (chapga yoki o'ngga) aynan shu tartib
 * bilan hisoblanadi, shuning uchun ular ikki joyda takrorlanmasligi kerak.
 */
export const CABINET_TABS = [
  { href: "", label: "Bosh menu", icon: HomeIcon },
  { href: "/kundalik", label: "Kundalik", icon: NoteIcon },
  { href: "/foydali", label: "Foydali", icon: BulbIcon },
  { href: "/sozlamalar", label: "Sozlamalar", icon: SettingsIcon },
] as const;

/**
 * Manzil qaysi bo'limga tegishli. Topilmasa -1 — bunda o'tish yo'nalishi
 * emas, oddiy yumshoq paydo bo'lish ishlatiladi.
 */
export function tabIndexOf(pathname: string, base: string): number {
  if (pathname === base || pathname === `${base}/`) {
    return 0;
  }
  return CABINET_TABS.findIndex((tab) => tab.href !== "" && pathname.startsWith(`${base}${tab.href}`));
}
