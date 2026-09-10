"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";

export interface SelectMenuOption {
  value: string;
  label: string;
}

interface SelectMenuProps {
  label?: string;
  options: SelectMenuOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

/**
 * Brauzerning native `<select>` ochilganda operatsion tizim uslubida (qora fon,
 * ko'k belgilash) chiqadi — ilova dizayniga mos kelmaydi. Shu o'rniga o'zimizning
 * uslubdagi ro'yxatni chizamiz.
 */
export function SelectMenu({ label, options, value, onChange, error, hint }: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={rootRef}>
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "flex w-full cursor-pointer items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm text-[var(--color-text)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--color-primary)]/20",
          error ? "border-[var(--color-danger)]" : "border-[var(--color-border)] focus:border-[var(--color-primary)]",
        )}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDownIcon className={clsx("h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={clsx(
                "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-hover)]",
                option.value === value && "font-medium text-[var(--color-primary)]",
              )}
            >
              {option.label}
              {option.value === value && <CheckIcon className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
      {hint && !error && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
