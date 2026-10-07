"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ComponentType, MouseEventHandler } from "react";
import type { IconProps } from "@/components/ui/icons";
import { Spinner } from "./spinner";

const BASE =
  "inline-flex h-11 shrink-0 select-none items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-[transform,background-color,opacity] duration-150 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-45";

const VARIANT = {
  primary:
    "bg-[var(--color-primary)] text-white shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--color-primary)_55%,transparent)] hover:bg-[var(--color-primary-hover)]",
  pill: "bg-[#767680]/[0.12] text-[var(--color-text)] hover:bg-[#767680]/[0.18]",
} as const;

/**
 * iOS tugmasi. `compact` — telefonda faqat ikonka (44×44 doira), md dan
 * matn bilan; shunda sarlavha kartasidagi amallar hech qachon ekrandan
 * chiqib ketmaydi. Faqat ikonka ko'ringanda nom `aria-label`da qoladi.
 */
export function IosButton({
  label,
  icon: Icon,
  variant = "pill",
  compact = false,
  href,
  onClick,
  loading = false,
  disabled,
  className,
}: {
  label: string;
  icon?: ComponentType<IconProps>;
  variant?: keyof typeof VARIANT;
  compact?: boolean;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const classes = clsx(BASE, VARIANT[variant], compact && Icon && "w-11 px-0 md:w-auto md:px-5", className);
  const content = (
    <>
      {loading ? <Spinner className="h-[18px] w-[18px]" /> : Icon && <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={2.1} />}
      <span className={clsx(compact && Icon && "sr-only md:not-sr-only")}>{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes} aria-label={compact ? label : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} aria-label={compact ? label : undefined}>
      {content}
    </button>
  );
}
