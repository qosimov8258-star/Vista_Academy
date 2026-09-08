"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// iOS uslubida: tekis to'ldirilgan yuzalar, gradient/glass yo'q, bosilganda
// tugma sal kichrayadi — bu "haqiqiy tugmani bosdim" hissini beradi.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white shadow-[var(--shadow-card)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)]",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] shadow-[var(--shadow-card)] hover:bg-[var(--color-surface-hover)]",
  danger: "bg-[var(--color-danger)] text-white shadow-[var(--shadow-card)] hover:brightness-95",
  ghost: "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[13px] px-3 py-1.5 rounded-[var(--radius-md)] gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-[var(--radius-lg)] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex cursor-pointer items-center justify-center font-medium transition-all duration-150",
          "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
          "motion-reduce:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

/**
 * Faqat ikonkadan iborat tugma (yopish, tozalash, sahifalash). Bosish maydoni
 * ko'rinadigan ikonkadan kattaroq — kichik nishonga urinish shart emas.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(({ label, className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-subtle)]",
        "transition-all duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
        "active:scale-90 disabled:pointer-events-none disabled:opacity-30 motion-reduce:active:scale-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
IconButton.displayName = "IconButton";
