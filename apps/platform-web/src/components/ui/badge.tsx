import { HTMLAttributes } from "react";
import clsx from "clsx";

type Tone = "success" | "warning" | "danger" | "neutral" | "primary";

const toneClasses: Record<Tone, string> = {
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
  primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
};

const dotClasses: Record<Tone, string> = {
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  neutral: "bg-[var(--color-text-subtle)]",
  primary: "bg-[var(--color-primary)]",
};

/**
 * Holat nishoni. `dot` bilan rang yonida kichik nuqta chiqadi — holat faqat
 * rang orqali emas, shakl orqali ham ajraladi (rang ko'rmaydiganlar uchun).
 */
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}
