/**
 * Ota-ona kabineti bo'limlari — faollik yozuvlarida (`GuardianPageView.page`)
 * faqat shu kalitlar saqlanadi. Panelda nomi va tartibi shu yerdan olinadi.
 */
export const PARENT_PAGES = [
  "home",
  "kundalik",
  "jadval",
  "fayllar",
  "tolov",
  "dokon",
  "foydali",
  "xabarlar",
  "sozlamalar",
  "tanlash",
] as const;

export type ParentPage = (typeof PARENT_PAGES)[number];

/**
 * Bola natijalari va kuni ko'rinadigan bo'limlar — «bolasini kuzatyaptimi»
 * ko'rsatkichi shulardan hisoblanadi.
 */
export const CHILD_RESULT_PAGES: readonly ParentPage[] = ["home", "kundalik", "jadval", "fayllar"];

/** Brauzer ping oralig'i 30 s; bitta ping bundan ortiq vaqt qo'shmaydi (uxlab qolgan tab hisoblanmasin). */
export const MAX_PING_GAP_SEC = 75;
