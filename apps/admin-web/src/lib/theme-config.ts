/**
 * Tizim rangi — foydalanuvchi Sozlamalarda tanlaydi, butun panel (tugmalar,
 * faol bo'limlar, yon panel, qidiruv, ikonkalar) shu rangga o'tadi.
 *
 * Tayyor to'plamlar globals.css da (`:root[data-theme="..."]`), bu yerda
 * ro'yxat va namunaviy ranglar. Foydalanuvchi o'z rangini ham tanlay oladi
 * («#rrggbb») — unda to'plam shu rangdan hisoblanadi (`customThemeVars`).
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

/** Foydalanuvchi o'zi tanlagan rang — «#rrggbb» */
export type CustomColor = `#${string}`;
/** Tizim rangi: tayyor to'plam nomi yoki o'z rangi */
export type ThemeValue = ThemeKey | CustomColor;

export const isCustomColor = (value: unknown): value is CustomColor => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
export const isThemeValue = (value: unknown): value is ThemeValue => isThemeKey(value) || isCustomColor(value);

/** O'z rangi uchun hisoblangan CSS o'zgaruvchilari — keyingi ochilishda darhol qo'llash uchun */
export const THEME_VARS_STORAGE_KEY = "bogcha:theme-vars";

/** globals.css dagi `:root[data-theme]` bloklari bilan bir xil o'zgaruvchilar */
export const CUSTOM_THEME_VARS = [
  "--color-primary",
  "--color-primary-hover",
  "--accent-rail",
  "--accent-rail-2",
  "--accent-bright",
  "--accent-light",
  "--accent-pale",
  "--accent-orb-from",
  "--accent-orb-to",
  "--accent-orb-ink",
  "--accent-soft",
  "--accent-soft-ink",
  "--accent-soft-icon",
] as const;

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function hsl(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, l)));
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Oq matn bilan kontrast (WCAG) */
function contrastWithWhite(h: number, s: number, l: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hslToRgb(h, s, l);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (lum + 0.05);
}

/**
 * Bitta rangdan butun to'plam: tugma rangi, to'q yon panel, yorqin urg'ular,
 * och fonlar — tayyor to'plamlardagi nisbatlar bilan. Juda och rang
 * tanlansa, tugma rangi oq yozuv o'qiladigan darajagacha to'qlashtiriladi.
 */
export function customThemeVars(hex: CustomColor): Record<(typeof CUSTOM_THEME_VARS)[number], string> {
  const [h, s0, l0] = hexToHsl(hex);
  const s = Math.min(s0, 92);
  let l = l0;
  while (l > 18 && contrastWithWhite(h, s, l) < 3.6) l -= 2;
  const primary = l === l0 ? hex.toLowerCase() : hsl(h, s, l);
  const tone = Math.min(s, 70);
  return {
    "--color-primary": primary,
    "--color-primary-hover": hsl(h, s, l - 7),
    "--accent-rail": hsl(h, Math.min(s, 55), 9),
    "--accent-rail-2": hsl(h, Math.min(s, 50), 13),
    "--accent-bright": hsl(h, Math.max(tone, s * 0.9), 64),
    "--accent-light": hsl(h, Math.max(tone, s * 0.9), 76),
    "--accent-pale": hsl(h, tone, 91),
    "--accent-orb-from": hsl(h, tone, 86),
    "--accent-orb-to": hsl(h, Math.max(tone, s * 0.9), 62),
    "--accent-orb-ink": hsl(h, Math.min(s, 70), 16),
    "--accent-soft": hsl(h, Math.min(s, 80), 96.5),
    "--accent-soft-ink": hsl(h, Math.min(s, 70), 24),
    "--accent-soft-icon": primary,
  };
}

/**
 * <head> ichida birinchi chizishdan oldin ishlaydigan skript — aks holda
 * sahifa bir lahza yashil ko'rinib, keyin tanlangan rangga "sakraydi".
 * O'z rangi tanlangan bo'lsa, oldindan hisoblangan o'zgaruvchilar qo'yiladi.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),r=document.documentElement;if(t&&t.charAt(0)==="#"){var v=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_VARS_STORAGE_KEY)})||"null");if(v){for(var k in v)r.style.setProperty(k,v[k]);r.dataset.theme="custom";}}else if(t&&t!=="green")r.dataset.theme=t;}catch(e){}`;
