"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import styles from "../parent.module.css";
import { CABINET_TABS, TAB_BAR_SLOTS, tabIndexOf } from "./tabs";

/**
 * Pastdagi suzuvchi menyu. Telefonda bosh barmoq yetadigan joyda turadi,
 * shuning uchun kabinetning asosiy navigatsiyasi aynan shu.
 *
 * Rangi kabinetning qolgan qismi bilan bir xil — oq yuza va iliq sariq
 * urg'u. Faol bo'lim rang bilan emas, ortidagi yumshoq tamg'a va
 * to'ldirilgan ikonka bilan ajratiladi; tamg'a bo'limdan bo'limga sakramay,
 * surilib boradi.
 *
 * Bo'limlar ko'p bo'lsa (TAB_BAR_SLOTS dan ortiq), oxirgi joyni "Yana"
 * egallaydi: sig'maganlari uning oynasida chiqadi. Tamg'a o'rni faol
 * tugmaning haqiqiy o'lchamidan olinadi — bo'lim qo'shilsa ham adashmaydi.
 */
export function ParentTabBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/ota-ona/${slug}`;

  const overflowing = CABINET_TABS.length > TAB_BAR_SLOTS;
  const visibleCount = overflowing ? TAB_BAR_SLOTS - 1 : CABINET_TABS.length;
  const visible = CABINET_TABS.slice(0, visibleCount);
  const more = CABINET_TABS.slice(visibleCount);
  const moreSlot = visibleCount; // "Yana" tugmasining o'rni

  // Bo'lim indeksini menyudagi joyga aylantiradi: sig'maganlari — "Yana"
  const slotOf = (tabIndex: number) => (tabIndex < 0 ? -1 : tabIndex < visibleCount ? tabIndex : moreSlot);

  const routeIndex = tabIndexOf(pathname, base);
  // Bosilgan bo'lim darhol faol ko'rinadi — sahifa yuklanishini kutmaydi.
  // Manzil o'zgargach (yoki boshqa yo'l bilan kelinganda) haqiqiy holatga qaytadi.
  const [tapped, setTapped] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    setTapped(null);
    setMoreOpen(false);
  }, [pathname]);
  const activeSlot = moreOpen ? moreSlot : slotOf(tapped ?? routeIndex);

  const barRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    const item = activeSlot >= 0 ? itemRefs.current[activeSlot] : null;
    if (!item) {
      setPill(null);
      return;
    }
    setPill({ x: item.offsetLeft, y: item.offsetTop, w: item.offsetWidth, h: item.offsetHeight });
  }, [activeSlot]);

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

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const itemClass = (active: boolean) =>
    clsx(
      // `basis-0 min-w-0` — bo'limlar uzun nomiga qarab emas, teng
      // bo'linadi; uzun nom o'z katagiga sig'adi.
      "relative z-10 flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-full py-2 transition-colors duration-200",
      active ? "text-[var(--p-sun-ink)]" : "text-[var(--p-muted)] active:bg-[var(--p-sunken)]",
    );
  const labelClass = "w-full truncate text-center text-[clamp(10px,3vw,11.5px)] font-semibold leading-none";
  const iconClass = (active: boolean) => clsx("h-[22px] w-[22px] shrink-0", active && styles.tabIconActive);

  return (
    <nav
      aria-label="Asosiy menyu"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 min-[380px]:px-4"
      // iPhone'dagi pastki chiziq tugmalarni yopib qolmasin
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {moreOpen && (
        <MoreSheet
          items={more.map((tab, i) => ({ ...tab, index: visibleCount + i }))}
          base={base}
          activeIndex={routeIndex}
          onPick={(index) => {
            setTapped(index);
            setMoreOpen(false);
          }}
          onClose={() => setMoreOpen(false)}
        />
      )}

      <div
        ref={barRef}
        className="relative flex w-full max-w-[420px] items-stretch gap-1 rounded-full border border-[var(--p-line)] bg-[var(--p-card)] p-2 shadow-[var(--p-shadow)]"
      >
        {/* Suriluvchi tamg'a. Bo'lim tanilmasa ko'rsatilmaydi. */}
        {pill && (
          <span
            aria-hidden="true"
            className={styles.tabPill}
            style={{ transform: `translate3d(${pill.x}px, ${pill.y}px, 0)`, width: pill.w, height: pill.h }}
          />
        )}

        {visible.map((tab, i) => {
          const active = i === activeSlot;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={`${base}${tab.href}`}
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
              aria-current={i === routeIndex ? "page" : undefined}
              onClick={() => {
                setMoreOpen(false);
                setTapped(i);
              }}
              className={itemClass(active)}
            >
              {/* key: bo'lim faollashganda animatsiya boshidan ishlasin */}
              <Icon filled={active} key={active ? "on" : "off"} className={iconClass(active)} />
              <span className={labelClass}>{tab.label}</span>
            </Link>
          );
        })}

        {overflowing && (
          <button
            type="button"
            ref={(node) => {
              itemRefs.current[moreSlot] = node;
            }}
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={itemClass(moreSlot === activeSlot)}
          >
            <MoreIcon filled={moreSlot === activeSlot} key={moreSlot === activeSlot ? "on" : "off"} className={iconClass(moreSlot === activeSlot)} />
            <span className={labelClass}>Yana</span>
          </button>
        )}
      </div>
    </nav>
  );
}

/** "Yana" oynasi — menyuga sig'magan bo'limlar, izohi bilan */
function MoreSheet({
  items,
  base,
  activeIndex,
  onPick,
  onClose,
}: {
  items: Array<(typeof CABINET_TABS)[number] & { index: number }>;
  base: string;
  activeIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[-1]" role="dialog" aria-modal="true" aria-label="Boshqa bo'limlar">
      <div className={clsx("absolute inset-0 bg-black/35", styles.enterSoft)} onClick={onClose} aria-hidden />
      <div
        className={clsx(
          "absolute inset-x-3 mx-auto max-w-[420px] rounded-[28px] border border-[var(--p-line)] bg-[var(--p-card)] p-3 shadow-[var(--p-shadow)] min-[380px]:inset-x-4",
          styles.moreSheet,
        )}
        // Menyu ustida, undan biroz yuqorida suzib turadi
        style={{ bottom: "calc(max(12px, env(safe-area-inset-bottom)) + 88px)" }}
      >
        <p className="px-2 pb-2 pt-1 text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--p-muted)]">Boshqa bo&apos;limlar</p>
        <ul className="space-y-1">
          {items.map((tab) => {
            const active = tab.index === activeIndex;
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={`${base}${tab.href}`}
                  onClick={() => onPick(tab.index)}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-3.5 rounded-[20px] px-2.5 py-2.5 transition-colors",
                    active ? "bg-[var(--p-sun)]/16" : "active:bg-[var(--p-sunken)]",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      active ? "bg-[var(--p-sun)]/25 text-[var(--p-sun-ink)]" : "bg-[var(--p-sunken)] text-[var(--p-ink)]",
                    )}
                  >
                    <Icon filled={active} className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block text-[15.5px] font-bold", active ? "text-[var(--p-sun-ink)]" : "text-[var(--p-ink)]")}>
                      {tab.label}
                    </span>
                    <span className="block truncate text-[13px] text-[var(--p-muted)]">{tab.hint}</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-[var(--p-muted)]" aria-hidden>
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** "Yana" belgisi — to'rt katakcha; faol bo'lsa to'ldiriladi */
function MoreIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </svg>
  );
}
