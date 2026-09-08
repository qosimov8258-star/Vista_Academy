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
    "bg-[var(--color-primary)] text-white shadow-[var(--shadow-card)] hover:bg-[var(--color-primary-hover)] focus-visible:ring-[var(--color-primary)]/40",
  // Brend rangining yengil foni — ikkinchi darajali, lekin ko'zga tashlanadigan amal
  secondary:
    "bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/16 focus-visible:ring-[var(--color-primary)]/40",
  // Neytral to'ldirilgan — ramkasiz, tinch
  tertiary:
    "bg-[var(--color-surface-sunken)] text-[var(--color-text)] hover:bg-[var(--color-border)] focus-visible:ring-[var(--color-primary)]/30",
  // Oq fon + ingichka ramka
  outline:
    "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] shadow-[var(--shadow-card)] hover:bg-[var(--color-surface-hover)] focus-visible:ring-[var(--color-primary)]/30",
  ghost:
    "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] focus-visible:ring-[var(--color-primary)]/30",
  danger:
    "bg-[var(--color-danger)] text-white shadow-[var(--shadow-card)] hover:brightness-95 focus-visible:ring-[var(--color-danger)]/40",
  // O'chirish kabi amalning yumshoqroq ko'rinishi
  dangerSoft:
    "bg-[var(--color-danger-bg)] text-[var(--color-danger)] hover:brightness-[0.97] focus-visible:ring-[var(--color-danger)]/30",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-[18px] text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2.5",
};

const iconOnlySizeClasses: Record<Size, string> = {
  sm: "h-8 w-8 p-0 gap-0",
  md: "h-10 w-10 p-0 gap-0",
  lg: "h-12 w-12 p-0 gap-0",
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
          "inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full font-medium",
          "transition-all duration-150 active:scale-[0.97] motion-reduce:active:scale-100",
          "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
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
