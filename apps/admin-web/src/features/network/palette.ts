/**
 * Guruhlarga barqaror rang beradi: ro'yxatdagi o'rni emas, guruh id'si
 * bo'yicha tanlanadi — filtrlanganda ham guruh o'z rangini saqlab qoladi.
 */
export const GROUP_PALETTE = [
  { ring: "stroke-emerald-500", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-700" },
  { ring: "stroke-sky-500", chip: "bg-sky-50 text-sky-700", dot: "bg-sky-500", soft: "bg-sky-50", text: "text-sky-700" },
  { ring: "stroke-violet-500", chip: "bg-violet-50 text-violet-700", dot: "bg-violet-500", soft: "bg-violet-50", text: "text-violet-700" },
  { ring: "stroke-amber-500", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-700" },
  { ring: "stroke-rose-400", chip: "bg-rose-50 text-rose-600", dot: "bg-rose-400", soft: "bg-rose-50", text: "text-rose-600" },
  { ring: "stroke-teal-500", chip: "bg-teal-50 text-teal-700", dot: "bg-teal-500", soft: "bg-teal-50", text: "text-teal-700" },
] as const;

export type GroupPalette = (typeof GROUP_PALETTE)[number];

export function paletteFor(id: string): GroupPalette {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return GROUP_PALETTE[hash % GROUP_PALETTE.length];
}

/** "Chumolilar (3-4 yosh)" -> "CH" — kartochkadagi monogramma uchun. */
export function monogram(name: string): string {
  const letters = name.replace(/\(.*?\)/g, "").trim();
  return letters.slice(0, 2).toUpperCase() || "?";
}
