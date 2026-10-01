// Rus lokali minglikni bo'linmas probel (U+00A0) bilan ajratadi — oddiy
// probelga almashtiriladi, aks holda nusxalanganda g'alati belgi chiqadi.
const NBSP = / /g;

/** "116,4 mln" — vidjet va kartalarda to'liq summa sig'maydi, to'liqi title'da */
export function compactMoney(value: number, tr: (text: string) => string = (t) => t): string {
  const abs = Math.abs(value);
  const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 }).replace(NBSP, " ");
  if (abs >= 1_000_000_000) return `${fmt(value / 1_000_000_000)} ${tr("mlrd")}`;
  if (abs >= 1_000_000) return `${fmt(value / 1_000_000)} ${tr("mln")}`;
  if (abs >= 1_000) return `${fmt(value / 1_000)} ${tr("ming")}`;
  return fmt(value);
}

/** "116 360 000 so'm" — title va aniq qiymat uchun */
export const fullMoney = (value: number, tr: (text: string) => string = (t) => t): string =>
  `${Math.round(value).toLocaleString("ru-RU").replace(NBSP, " ")} ${tr("so'm")}`;
