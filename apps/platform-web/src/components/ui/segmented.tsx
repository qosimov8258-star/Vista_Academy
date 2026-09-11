"use client";

import { useLayoutEffect, useRef, useState } from "react";
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

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Bandlar (masalan "To'xtatilgan") uzunligiga qarab teng bo'lmagan
  // kenglikda chizilishi mumkin — shuning uchun indikator "1/uzunlik"
  // formulasi bilan emas, tanlangan tugmaning haqiqiy DOM o'lchamidan
  // olinadi, aks holda uzun so'zlar indikatordan tashqariga chiqib qoladi.
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const activeTab = tabRefs.current[activeIndex];
    if (!activeTab) return;

    const measure = () => setIndicator({ left: activeTab.offsetLeft, width: activeTab.offsetWidth });
    measure();

    const container = containerRef.current;
    if (!container) return;
    // Ekran o'lchami yoki konteyner eni o'zgarsa (masalan mobil <-> desktop)
    // indikator qayta o'lchab olinadi
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeIndex, options.length]);

  return (
    <div
      ref={containerRef}
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
        className="absolute inset-y-1 rounded-full bg-[var(--color-primary)] shadow-[var(--shadow-card)] transition-[left,width] duration-300 ease-[var(--ease-ios)] motion-reduce:transition-none"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
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
