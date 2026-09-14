"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/**
 * "Foydali" bo'limining uchta sahifasi (she'rlar/maqollar/ertaklar) orasida
 * almashish uchun tab qatori. Yon paneldagi uchta havola bilan bir xil
 * manzillarga olib boradi — bu shunchaki sahifa ichidagi tezkor almashtirgich.
 */
export function UsefulTabs({ base }: { base: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `${base}/useful/poems`, label: "She'rlar" },
    { href: `${base}/useful/proverbs`, label: "Maqollar" },
    { href: `${base}/useful/tales`, label: "Ertaklar" },
  ];

  return (
    <div role="tablist" className="flex w-fit gap-1 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] p-1">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={clsx(
              "rounded-[var(--radius-md)] px-4 py-2 text-[14px] font-medium transition-colors",
              active
                ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xs)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
