import { BulbIcon, HomeIcon, NoteIcon, SettingsIcon, ShopIcon } from "@/components/ui/icons";

/**
 * Pastki menyu tartibi. Menyu ham, sahifa o'tishi ham shu ro'yxatdan
 * foydalanadi: o'tish yo'nalishi (chapga yoki o'ngga) aynan shu tartib
 * bilan hisoblanadi, shuning uchun ular ikki joyda takrorlanmasligi kerak.
 */
export const CABINET_TABS = [
  { href: "", label: "Bosh menu", icon: HomeIcon, hint: "Bugungi kun" },
  { href: "/kundalik", label: "Kundalik", icon: NoteIcon, hint: "Ovqat tartibi va kun" },
  { href: "/dokon", label: "Do'kon", icon: ShopIcon, hint: "Coinlarga sovg'alar" },
  { href: "/foydali", label: "Foydali", icon: BulbIcon, hint: "She'rlar, maqollar, ertaklar" },
  { href: "/sozlamalar", label: "Sozlamalar", icon: SettingsIcon, hint: "Parol, ko'rinish, chiqish" },
] as const;

/**
 * Pastki menyuda ko'pi bilan shuncha joy bor. Bo'limlar ko'p bo'lsa, oxirgi
 * joyni "Yana" egallaydi va sig'maganlari uning oynasida chiqadi — telefonda
 * har bir tugma bosh barmoqqa qulay kenglikda qoladi.
 */
export const TAB_BAR_SLOTS = 4;

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
