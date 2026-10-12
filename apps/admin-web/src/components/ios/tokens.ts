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

/** Sahifa kartasi: 18px burchak, ramka va soyasiz — iOS «inset grouped» (Sabot bilan bir xil) */
export const PAGE_CARD = "rounded-[18px] bg-white";

/** Bo'lim bloki (Group ichidagi oq blok) — sahifa kartasi bilan bir xil */
export const GROUP_BLOCK = "overflow-hidden rounded-[18px] bg-white";

/** Bo'lim sarlavhasi */
export const SECTION_TITLE = "px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]";

/**
 * Qatorlar orasidagi ajratgich — birinchi qatorda yo'q. Sukut bo'yicha
 * chapdan 16px; plitka/avatar bor qatorda matndan boshlanadi (`style.left`).
 */
export const ROW_SEPARATOR = "pointer-events-none absolute left-4 right-0 top-0 h-px bg-black/[0.08] group-first/row:hidden";

/** Bosiladigan qator foni */
export const ROW_PRESS = "transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]";
