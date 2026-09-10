"use client";

import clsx from "clsx";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * iOS segmented control: cho'kkan kulrang chiziq ichida sirg'aluvchi oq
 * indikator. Ochiladigan ro'yxatdan (select) afzalligi — barcha variantlar
 * ko'rinib turadi va tanlash bir bosishda bo'ladi.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        "relative inline-flex rounded-full bg-[var(--color-surface-sunken)] p-1",
        "border border-[var(--color-border)]",
        className,
      )}
    >
      {/* Sirg'aluvchi indikator — tanlangan bandning ostiga suriladi */}
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-full bg-[var(--color-primary)] shadow-[var(--shadow-card)] transition-[left] duration-300 ease-[var(--ease-ios)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          left: `calc(0.25rem + (100% - 0.5rem) / ${options.length} * ${activeIndex})`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              "relative z-10 flex-1 cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-200",
              active
                ? "text-[var(--color-primary-contrast)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
