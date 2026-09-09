"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

/**
 * Variant nomlari HeroUI Button bilan bir xil, ko'rinishi ham shunga
 * moslangan: to'liq dumaloq shakl, bosilganda sal kichrayish, klaviatura
 * fokusi uchun halqa. Kutubxonaning o'zi olinmagan — u o'z temasi bilan
 * keladi va `onClick` o'rniga `onPress` ishlatadi, ya'ni loyihadagi barcha
 * tugmalarni qayta yozish kerak bo'lardi. Ranglar bu yerda dizayn
 * token'laridan olinadi, shuning uchun ikkala ilovada ham o'z brendida chiqadi.
 */
type Variant = "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger" | "dangerSoft";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Faqat ikonka: kvadrat shaklda, yon bo'shliqsiz. */
  isIconOnly?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  // To'ldirilgan asosiy amal
  primary:
    "bg-[var(--color-primary)] text-white shadow-[var(--shadow-primary)] hover:bg-[var(--color-primary-hover)] focus-visible:ring-[var(--color-primary)]/25",
  // Brend rangining yengil foni — ikkinchi darajali, lekin ko'zga tashlanadigan amal
  secondary:
    "bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/[0.16] focus-visible:ring-[var(--color-primary)]/25",
  // Neytral to'ldirilgan — ramkasiz, tinch
  tertiary:
    "bg-[var(--color-surface-sunken)] text-[var(--color-text)] hover:bg-[var(--color-border)] focus-visible:ring-[var(--color-primary)]/20",
  // Oq fon + ingichka ramka
  outline:
    "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border-hair)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-surface-hover)] focus-visible:ring-[var(--color-primary)]/20",
  ghost:
    "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)] focus-visible:ring-[var(--color-primary)]/20",
  danger:
    "bg-[var(--color-danger)] text-white shadow-[0_1px_2px_rgba(220,38,38,0.24),0_6px_16px_-6px_rgba(220,38,38,0.4)] hover:brightness-95 focus-visible:ring-[var(--color-danger)]/25",
  // O'chirish kabi amalning yumshoqroq ko'rinishi
  dangerSoft:
    "bg-[var(--color-danger-bg)] text-[var(--color-danger)] hover:brightness-[0.96] focus-visible:ring-[var(--color-danger)]/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px] gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-[52px] px-6 text-[17px] gap-2.5",
};

const iconOnlySizeClasses: Record<Size, string> = {
  sm: "h-9 w-9 p-0 gap-0",
  md: "h-11 w-11 p-0 gap-0",
  lg: "h-[52px] w-[52px] p-0 gap-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      isIconOnly,
      fullWidth,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        data-pending={loading ? "true" : undefined}
        className={clsx(
          "inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full font-semibold tracking-[-0.006em]",
          "transition-[transform,background-color,box-shadow,filter] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
          "outline-none focus-visible:ring-4 focus-visible:ring-offset-0",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          isIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
