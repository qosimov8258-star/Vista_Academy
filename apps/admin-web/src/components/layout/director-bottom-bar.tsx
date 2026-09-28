"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import type { TenantAuthenticatedUser } from "@/lib/types";
import { isSection, type NavEntry, type NavIcon, type NavLeaf, type NavSection } from "./nav-types";
import { DirectorMenuContent } from "./director-rail";
import styles from "./director-bottom-bar.module.css";

/** Panelda nechta joy: oxirgisi har doim "Menyu" */
const SLOTS = 5;
const BUMP_W = 120;
const BUMP_H = 22;
/** Doira markazi panel tepa chetidan shuncha pastda — yuqoriga bo'rtib turadi */
const ORB_CENTER_FROM_TOP = 8;
const ORB_SIZE = 50;

/** Panel yumaloq tepa burchaklarining radiusi */
const CORNER = 28;

/**
 * Panel tepa chetidan yuqoriga silliq bo'rtma: chetlarida botiq, o'rtasida
 * qavariq. Ostida panel rangidagi to'ldiruvchi bor — faol bo'lim eng chetda
 * bo'lsa, bo'rtma yumaloq burchak ustiga tushadi va to'ldiruvchi burchakni
 * bo'rtma bilan silliq qo'shib yuboradi (aks holda ostida bo'shliq qolardi).
 */
const BUMP_PATH = `M0 ${BUMP_H} C30 ${BUMP_H} 28 0 ${BUMP_W / 2} 0 C${BUMP_W - 28} 0 ${BUMP_W - 30} ${BUMP_H} ${BUMP_W} ${BUMP_H} V${BUMP_H + CORNER} H0 Z`;

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4.5 7h15M4.5 12h15M4.5 17h9" />
    </svg>
  );
}

export interface DirectorBottomBarProps {
  slug: string;
  entries: NavEntry[];
  settingsItem: NavLeaf;
  isActive: (item: NavLeaf) => boolean;
  user: TenantAuthenticatedUser | null;
  branchName: string | null;
  inBranchContext: boolean;
  onLogout: () => void;
  loggingOut: boolean;
}

type Sheet = { kind: "menu" } | { kind: "section"; section: NavSection };

/**
 * Direktorning telefondagi pastki paneli. Birinchi to'rtta bo'lim doim
 * ko'rinadi, beshinchi joy — "Menyu": qolgan bo'limlar, Sozlamalar va
 * Chiqish shu yerda. Ichida havolalari bor guruh bosilsa, uning havolalari
 * pastdan chiquvchi oynada ochiladi.
 */
export function DirectorBottomBar({
  slug,
  entries,
  settingsItem,
  isActive,
  user,
  branchName,
  inBranchContext,
  onLogout,
  loggingOut,
}: DirectorBottomBarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLElement | null>>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [orbX, setOrbX] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);

  const primary = entries.slice(0, SLOTS - 1);
  const menuSlot = primary.length;

  const entryActive = (entry: NavEntry) => (isSection(entry) ? entry.items.some(isActive) : isActive(entry));

  // Faol bo'lim qaysi joyda: to'rttasidan biri yoki "Menyu" ichida
  let activeSlot = -1;
  let ActiveIcon: NavIcon | null = null;
  let activeLabel = "";
  for (let i = 0; i < primary.length; i++) {
    if (entryActive(primary[i])) {
      activeSlot = i;
      ActiveIcon = primary[i].icon;
      activeLabel = primary[i].label;
      break;
    }
  }
  if (activeSlot === -1) {
    const rest = [...entries.slice(SLOTS - 1), settingsItem];
    const hit = rest.find((e) => (isSection(e) ? e.items.some(isActive) : isActive(e)));
    if (hit) {
      activeSlot = menuSlot;
      ActiveIcon = hit.icon;
      activeLabel = isSection(hit) ? (hit.items.find(isActive)?.label ?? hit.label) : hit.label;
    }
  }

  const measure = useCallback(() => {
    const el = activeSlot >= 0 ? slotRefs.current[activeSlot] : null;
    setOrbX(el ? el.offsetLeft + el.offsetWidth / 2 : null);
  }, [activeSlot]);

  useLayoutEffect(() => {
    measure();
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [measure, entries.length]);

  useEffect(() => {
    if (orbX === null || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [orbX, animate]);

  useEffect(() => {
    setSheet(null);
  }, [pathname]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    // Oyna ochiqligida orqadagi sahifa aylanmasin
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const slotClass = "relative flex h-full min-w-0 flex-1 basis-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[26px]";
  const label = (text: string, active: boolean) => (
    <span className={clsx("w-full truncate px-0.5 text-center text-[10.5px] font-semibold leading-none", active && styles.labelActive)}>
      {text}
    </span>
  );

  const menuActive = activeSlot === menuSlot;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 overflow-x-clip md:hidden">
        <nav
          ref={barRef}
          aria-label="Asosiy menyu"
          className={clsx(styles.bar, "relative flex items-stretch px-1.5")}
          style={{ borderRadius: `${CORNER}px ${CORNER}px 0 0`, height: "calc(66px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Faol bo'lim: paneldan yuqoriga bo'rtma va uning ichidagi zumrad doira */}
          {orbX !== null && ActiveIcon && (
            <div
              className={styles.indicator}
              aria-hidden="true"
              style={{
                transform: `translateX(${orbX - BUMP_W / 2}px)`,
                transition: animate ? undefined : "none",
              }}
            >
              <svg width={BUMP_W} height={BUMP_H + CORNER} viewBox={`0 0 ${BUMP_W} ${BUMP_H + CORNER}`} className={styles.bump} style={{ marginTop: -BUMP_H + 1 }}>
                <path d={BUMP_PATH} />
              </svg>
              <span className={styles.orb} style={{ top: ORB_CENTER_FROM_TOP - ORB_SIZE / 2 }}>
                <ActiveIcon key={`${activeSlot}:${activeLabel}`} filled className={clsx(styles.orbIcon, "h-[22px] w-[22px]")} />
              </span>
            </div>
          )}

          {primary.map((entry, i) => {
            const active = i === activeSlot;
            const Icon = entry.icon;
            const content = (
              <>
                <Icon className={clsx(styles.slotIcon, "h-[22px] w-[22px]", active && styles.slotIconHidden)} />
                {label(entry.label, active)}
              </>
            );
            if (isSection(entry)) {
              return (
                <button
                  key={entry.id}
                  ref={(el) => {
                    slotRefs.current[i] = el;
                  }}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={sheet?.kind === "section" && sheet.section.id === entry.id}
                  onClick={() => setSheet({ kind: "section", section: entry })}
                  className={clsx(slotClass, styles.slot, active && "justify-end pb-2.5")}
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={entry.href}
                ref={(el) => {
                  slotRefs.current[i] = el;
                }}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={clsx(slotClass, styles.slot, active && "justify-end pb-2.5")}
              >
                {content}
              </Link>
            );
          })}

          <button
            ref={(el) => {
              slotRefs.current[menuSlot] = el;
            }}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={sheet?.kind === "menu"}
            aria-label="Barcha bo'limlar"
            onClick={() => setSheet({ kind: "menu" })}
            className={clsx(slotClass, styles.slot, menuActive && "justify-end pb-2.5")}
          >
            <MenuIcon className={clsx(styles.slotIcon, "h-[22px] w-[22px]", menuActive && styles.slotIconHidden)} />
            {label(menuActive ? activeLabel : "Menyu", menuActive)}
          </button>
        </nav>
      </div>

      {typeof document !== "undefined" &&
        sheet &&
        createPortal(
          <div className="fixed inset-0 z-[65] md:hidden" role="dialog" aria-modal="true" aria-label={sheet.kind === "menu" ? "Barcha bo'limlar" : sheet.section.label}>
            <div className={clsx(styles.scrim, "absolute inset-0 bg-[var(--accent-rail)]/35 backdrop-blur-[2px]")} onClick={() => setSheet(null)} aria-hidden="true" />
            <div
              className={clsx(
                styles.sheet,
                "absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-24px_48px_-20px_color-mix(in_srgb,var(--accent-rail)_35%,transparent)]",
              )}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-black/15" aria-hidden="true" />
              {sheet.kind === "menu" ? (
                <DirectorMenuContent
                  slug={slug}
                  entries={entries}
                  settingsItem={settingsItem}
                  isActive={isActive}
                  user={user}
                  branchName={inBranchContext ? branchName : null}
                  onClose={() => setSheet(null)}
                  onLogout={onLogout}
                  loggingOut={loggingOut}
                  logoutLabel={t("logout")}
                />
              ) : (
                <SectionList section={sheet.section} isActive={isActive} onClose={() => setSheet(null)} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Guruh ichidagi havolalar — pastdan chiquvchi oynada, katta teginish maydonlari bilan */
function SectionList({ section, isActive, onClose }: { section: NavSection; isActive: (item: NavLeaf) => boolean; onClose: () => void }) {
  const SectionIcon = section.icon;
  return (
    <div className="px-4 pt-4" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-3 px-1 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-rail)] text-[var(--accent-light)]">
          <SectionIcon className="h-[22px] w-[22px]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-[-0.01em] text-[var(--color-text)]">{section.label}</p>
      </div>
      <div className="space-y-1">
        {section.items.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex h-[52px] items-center gap-3 rounded-[16px] px-3 text-[15.5px] transition-colors",
                active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-soft-ink)]" : "font-medium text-[var(--color-text)] active:bg-[var(--color-surface-sunken)]",
              )}
            >
              <span
                className={clsx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]",
                  active ? "bg-[var(--accent-soft-icon)]/15 text-[var(--accent-soft-icon)]" : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
                )}
              >
                <Icon filled={active} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="rounded-full bg-[var(--accent-soft-icon)]/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--accent-soft-icon)]">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
