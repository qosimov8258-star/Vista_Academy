"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/**
 * "Face ID" bo'limining ikki sahifasi (qurilmalar/yuz ro'yxati) orasida
 * almashish uchun tab qatori. Yon paneldagi havolalar bilan bir xil
 * manzillarga olib boradi — bu shunchaki sahifa ichidagi tezkor almashtirgich.
 */
export function FaceIdTabs({ base }: { base: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `${base}/face-id/devices`, label: "Qurilmalar" },
    { href: `${base}/face-id/registrations`, label: "Yuz ro'yxati" },
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
