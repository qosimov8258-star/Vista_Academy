"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
 *
 * Tamg'a o'rni faol bo'limning haqiqiy o'lchamidan olinadi. Ilgari u
 * "hamma bo'lim teng enlikda" degan hisobga tayanardi va bo'lim qo'shilishi
 * bilan noto'g'ri joyga tushib qolgandi.
 */
export function ParentTabBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/ota-ona/${slug}`;
  const activeIndex = tabIndexOf(pathname, base);

  const barRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    const item = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (!item) {
      setPill(null);
      return;
    }
    setPill({ x: item.offsetLeft, y: item.offsetTop, w: item.offsetWidth, h: item.offsetHeight });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
    // Menyu eni o'zgarsa (ekran burilishi, oyna kengaytirilishi, shrift
    // kattalashtirilishi) tamg'a ham o'z o'rnini yangilaydi.
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <nav
      aria-label="Asosiy menyu"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 min-[380px]:px-4"
      // iPhone'dagi pastki chiziq tugmalarni yopib qolmasin
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div
        ref={barRef}
        className="relative flex w-full max-w-[420px] items-stretch gap-0.5 rounded-full border border-[var(--p-line)] bg-[var(--p-card)] p-1.5 shadow-[var(--p-shadow)] min-[380px]:gap-1 min-[380px]:p-2"
      >
        {/* Suriluvchi tamg'a. Bo'lim tanilmasa ko'rsatilmaydi. */}
        {pill && (
          <span
            aria-hidden="true"
            className={styles.tabPill}
            style={{ transform: `translate3d(${pill.x}px, ${pill.y}px, 0)`, width: pill.w, height: pill.h }}
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
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
              aria-current={active ? "page" : undefined}
              className={clsx(
                // `basis-0 min-w-0` — bo'limlar uzun nomiga qarab emas, teng
                // bo'linadi; uzun nom o'z katagiga sig'adi.
                "relative z-10 flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-full py-2 transition-colors duration-200",
                active ? "text-[var(--p-sun-ink)]" : "text-[var(--p-muted)] active:bg-[var(--p-sunken)]",
              )}
            >
              <Icon
                filled={active}
                // key: bo'lim faollashganda animatsiya boshidan ishlasin
                key={active ? "on" : "off"}
                className={clsx("h-5 w-5 shrink-0 min-[380px]:h-[22px] min-[380px]:w-[22px]", active && styles.tabIconActive)}
              />
              {/* Tor ekranda shrift kichrayadi — nom qisqartirilmasin */}
              <span className="w-full truncate text-center text-[clamp(9.5px,2.9vw,11.5px)] font-semibold leading-none">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
