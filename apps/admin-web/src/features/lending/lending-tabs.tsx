"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppPathname } from "@/lib/tenant-host-context";
import clsx from "clsx";
import { useSegmentThumb } from "@/components/ios/segment-thumb";
import { useTr } from "@/i18n/tr";

/**
 * "Lending sahifa" bo'limining uchta sahifasi (o'qituvchilar/menu/guruhlar)
 * orasida almashish uchun tab qatori. Yon paneldagi uchta havola bilan bir
 * xil manzillarga olib boradi — bu shunchaki sahifa ichidagi tezkor almashtirgich.
 */
export function LendingTabs({ base }: { base: string }) {
  const tr = useTr();
  const pathname = useAppPathname();
  const tabs = [
    { href: `${base}/lending/teachers`, label: tr("O'qituvchilar") },
    { href: `${base}/lending/menu`, label: "Menu" },
    { href: `${base}/lending/groups`, label: "Guruhlar" },
  ];

  const currentIndex = tabs.findIndex((tab) => pathname.startsWith(tab.href));
  // Bosilgan tab darhol tanlanadi (sahifa yuklanguncha tabletka surila boshlaydi)
  const [pending, setPending] = useState<{ from: string; to: number } | null>(null);
  const shown = pending && pending.from === pathname ? pending.to : currentIndex;
  const { containerRef, thumbStyle } = useSegmentThumb(shown);

  return (
    <div ref={containerRef} role="tablist" className="relative flex w-fit gap-1 rounded-full bg-[var(--color-surface-sunken)] p-1">
      <span aria-hidden="true" className="pointer-events-none bottom-1 top-1 rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-xs)]" style={thumbStyle} />
      {tabs.map((tab, i) => {
        const active = i === shown;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            data-seg=""
            aria-selected={i === currentIndex}
            onClick={(e) => {
              if (i === shown || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              setPending({ from: pathname, to: i });
            }}
            className={clsx(
              "relative z-[1] rounded-full px-4 py-2 text-[14px] font-medium transition-colors duration-200",
              active ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {tr(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
