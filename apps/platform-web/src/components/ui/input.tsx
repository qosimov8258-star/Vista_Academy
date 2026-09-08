"use client";

import { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";
import { ChevronDownIcon, CloseIcon, SearchIcon } from "./icons";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
}

// Barcha maydonlar uchun umumiy asos: yumshoq burchak, ingichka chegara va
// fokusda ingichka rangli halqa (qalin ko'k soya emas).
const fieldBase =
  "w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] outline-none transition-colors duration-150 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 disabled:opacity-50";

function FieldShell({
  label,
  error,
  hint,
  htmlFor,
  children,
}: FieldWrapperProps & { htmlFor?: string; children: ReactNode }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text)]">{label}</span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-[var(--color-danger)]">{error}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    return (
      <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={clsx(fieldBase, error && "border-[var(--color-danger)]", className)}
          {...props}
        />
      </FieldShell>
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps
>(({ label, error, hint, className, id, ...props }, ref) => {
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        className={clsx(fieldBase, "resize-y", error && "border-[var(--color-danger)]", className)}
        {...props}
      />
    </FieldShell>
  );
});
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps
>(({ label, error, hint, className, id, children, ...props }, ref) => {
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      {/* Brauzerning standart o'qini yashirib, o'z ikonkamizni qo'yamiz */}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          className={clsx(
            fieldBase,
            "cursor-pointer appearance-none pr-9",
            error && "border-[var(--color-danger)]",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
      </div>
    </FieldShell>
  );
});
Select.displayName = "Select";

/**
 * Qidiruv maydoni: chapda lupa, matn kiritilganda o'ngda tozalash tugmasi.
 * iOS'dagi qidiruv satriga o'xshab to'liq dumaloq burchaklar bilan.
 */
export function SearchInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={clsx("relative", className)}>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={clsx(
          fieldBase,
          "rounded-full pl-10",
          value ? "pr-10" : "pr-3.5",
          // Chrome'ning o'z "x" tugmasi bizning tugmamiz bilan takrorlanmasin
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Qidiruvni tozalash"
          onClick={() => onValueChange("")}
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
