"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronsUpDown } from "@/components/ios/form";
import { CheckIcon, ChevronRightIcon } from "@/components/ios/icons";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { SkeletonRows } from "@/components/ios/states";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

export interface PickerOption {
  id: string;
  label: string;
  hint?: string;
  /** Chapdagi plitka yoki avatar */
  leading?: ReactNode;
  /** Tanlab bo'lmaydi (masalan ishlatilmayotgan xona) */
  disabled?: boolean;
}

/**
 * Tanlagich (native `<select>` o'rniga): bosilsa ichki varaqda ro'yxat
 * ochiladi, tanlangani ✓ bilan, tanlangach o'zi yopiladi.
 * `variant="row"` — forma qatori ichida (o'ngda nom va «›»),
 * `variant="pill"` — filtr kapsulasi.
 */
export function OptionPicker({
  title,
  value,
  onChange,
  options,
  loading = false,
  placeholder,
  emptyOption,
  emptyHint,
  variant = "row",
  id,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  loading?: boolean;
  /** Hech narsa tanlanmaganda ko'rinadigan matn */
  placeholder: string;
  /** Berilsa — ro'yxat boshida bo'sh qiymatli variant ("Barchasi", "Xonasiz") */
  emptyOption?: string;
  /** Ro'yxat bo'sh bo'lsa izoh */
  emptyHint?: string;
  variant?: "row" | "pill";
  id?: string;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);
  const label = selected ? selected.label : placeholder;
  const pick = (next: string) => {
    if (next !== value) onChange(next);
    setOpen(false);
  };

  const row = (key: string, option: { label: string; hint?: string; leading?: ReactNode; disabled?: boolean }, active: boolean, onClick: () => void) => (
    <div key={key} className="group/row relative">
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={option.disabled}
        onClick={onClick}
        className={clsx("flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-40", ROW_PRESS)}
      >
        {option.leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-[var(--color-text)]">{option.label}</span>
          {option.hint && <span className="block truncate text-[13px] text-[#8e8e93]">{option.hint}</span>}
        </span>
        {active && <CheckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
      </button>
      <span className={ROW_SEPARATOR} style={option.leading ? { left: 58 } : undefined} aria-hidden="true" />
    </div>
  );

  return (
    <>
      {variant === "pill" ? (
        <button
          id={id}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={clsx(
            "inline-flex h-9 max-w-[220px] shrink-0 items-center gap-1.5 rounded-full pl-3.5 pr-3 text-[13.5px] font-medium transition-colors",
            value ? "bg-[var(--color-primary)]/12 text-[var(--color-primary)]" : "bg-[#767680]/[0.12] text-[var(--color-text)] hover:bg-[#767680]/[0.18]",
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="flex min-h-[44px] w-full items-center justify-end gap-1.5 text-right transition-opacity active:opacity-50"
        >
          <span className={clsx("min-w-0 truncate text-[15px]", selected ? "text-[var(--color-text)]" : "text-[#8e8e93]")}>{label}</span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c4c4c6]" strokeWidth={2.4} />
        </button>
      )}

      <IosSheet open={open} onClose={() => setOpen(false)} title={title} cancelLabel="Orqaga">
        {loading ? (
          <SkeletonRows rows={4} avatar={false} />
        ) : (
          <SheetSection footer={options.length === 0 && emptyHint ? tr(emptyHint) : undefined}>
            <div role="radiogroup" aria-label={title}>
              {emptyOption && row("__empty__", { label: emptyOption }, value === "", () => pick(""))}
              {options.map((option) => row(option.id, option, option.id === value, () => pick(option.id)))}
            </div>
          </SheetSection>
        )}
      </IosSheet>
    </>
  );
}
