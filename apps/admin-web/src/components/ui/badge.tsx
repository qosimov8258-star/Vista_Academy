import { HTMLAttributes } from "react";
import clsx from "clsx";

type Tone = "success" | "warning" | "danger" | "neutral" | "primary" | "info";

// Barcha ranglar token'lardan. Ilgari `primary` indigo fonda brend rangidagi
// matn edi — ikki xil rang bir chipda.
const toneClasses: Record<Tone, string> = {
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
  primary: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  info: "bg-sky-50 text-sky-700",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none tracking-[-0.005em]",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
