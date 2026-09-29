/**
 * Tizim rangi — foydalanuvchi Sozlamalarda tanlaydi, butun panel (tugmalar,
 * faol bo'limlar, yon panel, qidiruv, ikonkalar) shu rangga o'tadi.
 *
 * Rang qiymatlari globals.css da (`:root[data-theme="..."]`), bu yerda
 * faqat ro'yxat va namunaviy ranglar. Tanlov shu brauzerda saqlanadi.
 */
export const THEMES = [
  { key: "green", label: "Yashil", swatch: "#10b981", dark: "#0d241b" },
  { key: "blue", label: "Ko'k", swatch: "#3b82f6", dark: "#0f1b33" },
  { key: "indigo", label: "Indigo", swatch: "#6366f1", dark: "#15173b" },
  { key: "violet", label: "Binafsha", swatch: "#8b5cf6", dark: "#1c1233" },
  { key: "pink", label: "Pushti", swatch: "#ec4899", dark: "#2a0f1e" },
  { key: "orange", label: "To'q sariq", swatch: "#f97316", dark: "#2a1608" },
  { key: "teal", label: "Moviy", swatch: "#06b6d4", dark: "#08222b" },
  { key: "slate", label: "Grafit", swatch: "#64748b", dark: "#0f141b" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

export const THEME_STORAGE_KEY = "bogcha:theme";
export const DEFAULT_THEME: ThemeKey = "green";

export const isThemeKey = (value: unknown): value is ThemeKey => THEMES.some((t) => t.key === value);

/**
 * <head> ichida birinchi chizishdan oldin ishlaydigan skript — aks holda
 * sahifa bir lahza yashil ko'rinib, keyin tanlangan rangga "sakraydi".
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t&&t!=="green")document.documentElement.dataset.theme=t;}catch(e){}`;
