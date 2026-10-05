/**
 * iOS grouped dizayn tizimi — umumiy qiymatlar (iOS Settings uslubi).
 * Urg'u rangi — tizim rangi `--color-primary` (Sozlamalarda tanlanadi).
 * Panelda hozircha qorong'i rejim yo'q, shuning uchun `dark:` variantlar
 * yozilmagan — butun panel uchun birdaniga qo'shiladi.
 */

/** iOS tizim ranglari */
export const IOS = {
  green: "#34c759",
  orange: "#ff9500",
  red: "#ff3b30",
  blue: "#007aff",
  gray: "#8e8e93",
} as const;

/** Sahifa kartasi: 32px burchak, ramkasiz, yumshoq soya */
export const PAGE_CARD = "rounded-[32px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(23,52,110,0.12)]";

/** Bo'lim bloki (Group ichidagi oq blok) */
export const GROUP_BLOCK = "overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(23,52,110,0.10)]";

/** Bo'lim sarlavhasi */
export const SECTION_TITLE = "px-4 pb-2 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#6d6d72]";

/** Qatorlar orasidagi ajratgich — chapdan 16px ichkarida, birinchi qatorda yo'q */
export const ROW_SEPARATOR = "pointer-events-none absolute left-4 right-0 top-0 h-px bg-[#c6c6c8]/60 group-first/row:hidden";

/** Bosiladigan qator foni */
export const ROW_PRESS = "transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]";
