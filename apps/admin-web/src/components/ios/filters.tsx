"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { CheckIcon, CloseIcon, SearchIcon } from "@/components/ui/icons";
import { ChevronsUpDown } from "./form";
import { useTr } from "@/i18n/tr";

/** Qidiruv kapsulasi: lupa, to'ldirilganda ichida kulrang "×" */
export function SearchPill({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const tr = useTr();
  return (
    <label className={clsx("relative flex h-10 min-w-0 items-center", className)}>
      <SearchIcon className="pointer-events-none absolute left-3.5 h-[17px] w-[17px] text-[#8e8e93]" strokeWidth={2.2} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Enter — klaviaturani yopadi (qidiruv yozgan sari ishlaydi)
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        enterKeyHint="search"
        className="h-10 w-full min-w-0 rounded-full bg-[#767680]/[0.12] pl-10 pr-10 text-[15px] text-[var(--color-text)] outline-none transition-colors placeholder:text-[#8e8e93] focus:bg-[#767680]/[0.16] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={tr("Qidiruvni tozalash")}
          className="absolute right-2.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#8e8e93]/70 text-white transition-transform active:scale-90"
        >
          <CloseIcon className="h-3 w-3" strokeWidth={3} />
        </button>
      )}
    </label>
  );
}

/** Filtr chiplari qatori — gorizontal suriladi, aylantirish chizig'isiz */
export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

export function IosChip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={clsx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-medium transition-[transform,background-color] duration-150 active:scale-[0.96]",
        active ? "bg-[var(--color-primary)] text-white" : "bg-[#767680]/[0.12] text-[var(--color-text)] hover:bg-[#767680]/[0.18]",
      )}
    >
      {active && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
      {children}
      {count !== undefined && <span className={clsx("tabular-nums", active ? "text-white/80" : "text-[#8e8e93]")}>{count}</span>}
    </button>
  );
}

/** Filtr tanlagichi: kulrang kapsula + ChevronsUpDown, ustida shaffof native select */
export function IosSelect({
  value,
  onChange,
  label,
  children,
  display,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
  /** Kapsulada ko'rinadigan matn (tanlangan variant nomi) */
  display: ReactNode;
}) {
  return (
    <label
      className={clsx(
        "relative inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 self-start rounded-full pl-3.5 pr-3 text-[13.5px] font-medium transition-colors sm:self-auto",
        value ? "bg-[var(--color-primary)]/12 text-[var(--color-primary)]" : "bg-[#767680]/[0.12] text-[var(--color-text)] hover:bg-[#767680]/[0.18]",
      )}
    >
      <span className="truncate">{display}</span>
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer appearance-none opacity-0">
        {children}
      </select>
    </label>
  );
}
