import type { ReactNode } from "react";
import { IOS } from "./tokens";

/**
 * Holat yorlig'i: matn — `color`, fon — o'sha rangning ~12% shaffofi.
 * `color` hex bo'lishi shart (#rrggbb), masalan IOS.green.
 */
export function Pill({ color = IOS.gray, children, title }: { color?: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-semibold tabular-nums"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {children}
    </span>
  );
}

/**
 * Rasm yoki bosh harflar (odam — 2 ta, guruh/narsa — `letters={1}`);
 * fon — tizim rangining 12% i.
 */
export function IosAvatar({ name, src, size = 44, letters = 2 }: { name: string; src?: string | null; size?: number; letters?: 1 | 2 }) {
  // Faqat harf bilan boshlanadigan so'zlar: "Sobirova Malika" → "SM", "(4-5" o'tkazib yuboriladi
  const initials = name
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, letters)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/12 font-semibold text-[var(--color-primary)]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </span>
  );
}
