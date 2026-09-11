"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import styles from "../parent.module.css";
import { CABINET_TABS, tabIndexOf } from "./tabs";

/**
 * Pastdagi suzuvchi menyu. Telefonda bosh barmoq yetadigan joyda turadi,
 * shuning uchun kabinetning asosiy navigatsiyasi aynan shu.
 *
 * Rangi kabinetning qolgan qismi bilan bir xil — oq yuza va iliq sariq
 * urg'u. Faol bo'lim rang bilan emas, ortidagi yumshoq tamg'a va
 * to'ldirilgan ikonka bilan ajratiladi; tamg'a bo'limdan bo'limga sakramay,
 * surilib boradi.
 */
export function ParentTabBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/ota-ona/${slug}`;
  const activeIndex = tabIndexOf(pathname, base);

  return (
    <nav
      aria-label="Asosiy menyu"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      // iPhone'dagi pastki chiziq tugmalarni yopib qolmasin
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <div className="relative flex w-full max-w-[420px] items-stretch gap-1 rounded-full border border-[var(--p-line)] bg-[var(--p-card)] p-2 shadow-[var(--p-shadow)]">
        {/* Suriluvchi tamg'a. Bo'lim tanilmasa ko'rsatilmaydi. */}
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className={styles.tabPill}
            style={{ transform: `translate3d(calc(${activeIndex * 100}% + ${activeIndex * 4}px), 0, 0)` }}
          />
        )}

        {CABINET_TABS.map((tab, i) => {
          const href = `${base}${tab.href}`;
          const active = i === activeIndex;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative z-10 flex flex-1 flex-col items-center justify-center gap-1 rounded-full py-2 transition-colors duration-200",
                active ? "text-[var(--p-sun-ink)]" : "text-[var(--p-muted)] active:bg-[var(--p-sunken)]",
              )}
            >
              <Icon
                filled={active}
                // key: bo'lim faollashganda animatsiya boshidan ishlasin
                key={active ? "on" : "off"}
                className={clsx("h-[22px] w-[22px]", active && styles.tabIconActive)}
              />
              <span className="text-[11.5px] font-semibold leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
