"use client";

import clsx from "clsx";

/**
 * Yozuvsiz on/off tugmasi. Yoqilganda yashil, o'chirilganda kulrang —
 * holat rangdan va tugma joylashuvidan o'qiladi, matn kerak emas.
 */
export function Switch({
  checked,
  onChange,
  loading = false,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      onClick={onChange}
      className={clsx(
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] disabled:cursor-wait disabled:opacity-70",
        checked
          ? "bg-[var(--color-success)] shadow-[0_0_0_1px_rgba(5,150,105,0.25),0_0_14px_rgba(5,150,105,0.35)]"
          : "bg-[var(--color-border)] shadow-[inset_0_1px_2px_rgba(16,24,40,0.08)]",
        className,
      )}
    >
      <span
        className={clsx(
          "inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.2),0_2px_6px_rgba(16,24,40,0.15)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          checked ? "translate-x-7" : "translate-x-1",
        )}
      >
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--color-text-muted)] border-t-transparent" />
        )}
      </span>
    </button>
  );
}
