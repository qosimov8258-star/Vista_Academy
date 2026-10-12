import clsx from "clsx";
import type { ComponentType, CSSProperties } from "react";

/**
 * iOS tizim ranglari — tekis (gradient va soyasiz), iOS Sozlamalaridagidek.
 * Qiymatlar Sabot veb panelidagi `SYS` bilan bir xil: ikki mahsulot bir xil
 * ko'rinsin.
 */
export const IOS_TINT = {
  blue: "#007aff",
  green: "#34c759",
  orange: "#ff9500",
  purple: "#af52de",
  pink: "#ff2d55",
  teal: "#30b0c7",
  indigo: "#5856d6",
  red: "#ff3b30",
  gray: "#8e8e93",
  emerald: "#00c7be",
  /** Tizim rangi (Sozlamalar) — tanlangan rangga qarab o'zgaradi */
  accent: "var(--color-primary)",
} as const;
export type IosTint = keyof typeof IOS_TINT;

/** Ikonka komponenti: loyihaning o'z ikonkalari ham, lucide ham (ikkalasi SVG) */
export type AnyIcon = ComponentType<{ className?: string; style?: CSSProperties; strokeWidth?: number | string }>;

/** Plitka burchagi: qatorda 30px → 8px, karta boshida 40px → 12px (Sabot `IosTile`) */
function radiusFor(size: number) {
  if (size <= 32) return 8;
  if (size <= 44) return 12;
  return Math.round(size * 0.27);
}

/**
 * iOS uslubidagi plitka: tekis tizim rangi, ichida oq belgi — Sozlamalar
 * ilovasidagi kabi. Belgi plitkaning yarmi.
 */
export function IosIcon({
  icon: Icon,
  tint,
  size = 44,
  className,
}: {
  icon: AnyIcon;
  tint: IosTint;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={clsx("flex shrink-0 items-center justify-center text-white", className)}
      style={{ width: size, height: size, borderRadius: radiusFor(size), backgroundColor: IOS_TINT[tint] }}
      aria-hidden="true"
    >
      <Icon className="shrink-0" style={{ width: size / 2, height: size / 2 }} strokeWidth={2} />
    </span>
  );
}
