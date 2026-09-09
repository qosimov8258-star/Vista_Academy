import { HTMLAttributes } from "react";
import clsx from "clsx";

/**
 * Yuza. Chegara deyarli ko'rinmas soch chizig'i, ajratish esa ikki qatlamli
 * soya orqali — tekis 1px ramka bilan "veb-jadval" ko'rinishi chiqadi.
 * `interactive` bosiladigan kartochkalar uchun: ustiga borilganda ko'tariladi.
 */
export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-xl)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        interactive &&
          "transition-all duration-[var(--dur-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("hairline border-b border-[var(--color-separator)] px-5 py-4 sm:px-6", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-5 py-5 sm:px-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx(
        "text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]",
        className,
      )}
      {...props}
    />
  );
}
