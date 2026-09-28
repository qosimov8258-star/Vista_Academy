import clsx from "clsx";
import type { ComponentType } from "react";
import type { IconProps } from "@/components/ui/icons";

/** iOS tizim ranglari — har biri yuqoridan pastga yumshoq gradient */
export const IOS_TINT = {
  blue: "from-[#3a9bff] to-[#0a6cf0]",
  green: "from-[#4cd964] to-[#23a33d]",
  orange: "from-[#ffb340] to-[#f28a00]",
  purple: "from-[#c77dff] to-[#9a4be0]",
  pink: "from-[#ff6b8b] to-[#f0355f]",
  teal: "from-[#4cc9dd] to-[#1f9fb5]",
  indigo: "from-[#7d7bff] to-[#4b49d6]",
  red: "from-[#ff6961] to-[#e8392f]",
  gray: "from-[#a1a1a8] to-[#76767d]",
  emerald: "from-[#3fd79f] to-[#0f9a6c]",
  /** Tizim rangi (Sozlamalar) — tanlangan rangga qarab o'zgaradi */
  accent: "from-[var(--accent-bright)] to-[var(--color-primary)]",
} as const;
export type IosTint = keyof typeof IOS_TINT;

/**
 * iOS uslubidagi ikonka: rangli "squircle" (yumaloq kvadrat), ichida oq
 * belgi, tepasida nozik yorug'lik — iPhone bosh ekrani va Sozlamalar
 * ilovasidagi kabi.
 */
export function IosIcon({
  icon: Icon,
  tint,
  size = 44,
  className,
}: {
  icon: ComponentType<IconProps>;
  tint: IosTint;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "relative flex shrink-0 items-center justify-center bg-gradient-to-b text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(0,0,0,0.25)]",
        IOS_TINT[tint],
        className,
      )}
      // iOS ikonkasi radiusi — tomonining ~23%
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
      aria-hidden="true"
    >
      <Icon className="shrink-0" style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={1.9} />
    </span>
  );
}
