import { HTMLAttributes } from "react";
import clsx from "clsx";

/**
 * iOS "grouped list" uslubidagi panel: kulrang fon ustida qattiq oq yuza,
 * keng burchaklar, ingichka chegara va deyarli sezilmas soya. Blur yo'q.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("border-b border-[var(--color-separator)] px-5 py-3.5", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx("text-[15px] font-semibold text-[var(--color-text)]", className)} {...props} />;
}

/**
 * Panel ustidagi kichik izoh sarlavhasi — iOS Sozlamalaridagi bo'lim
 * sarlavhalari kabi, panelning o'zidan tashqarida turadi.
 */
export function SectionLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={clsx(
        "px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]",
        className,
      )}
      {...props}
    />
  );
}
