"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import type { TenantAuthenticatedUser } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/permissions";
import { Avatar, initials } from "@/components/ui/avatar";
import { ArrowLeftIcon, CloseIcon, LogoutIcon } from "@/components/ui/icons";
import { isSection, type NavEntry, type NavIcon, type NavLeaf, type NavSection } from "./nav-types";
import styles from "./director-rail.module.css";

// Geometriya (px, yon panelning chap chetidan). Bo'rtma va qalqib chiquvchi
// oynalar shu qiymatlardan hisoblanadi — CSS'dagi --rail-width bilan bir xil.
const RAIL_LEFT = 16;
const RAIL_WIDTH = 76;
const RAIL_RIGHT = RAIL_LEFT + RAIL_WIDTH;
const BUMP_W = 24;
const BUMP_H = 120;
const ORB_SIZE = 52;
/** Faol doira markazi ustun chetidan shuncha ichkarida — yarmidan ko'pi ustunda */
const ORB_INSET = 10;

/** Ustun chetidan silliq bo'rtib chiqadigan shakl: chetlarida botiq, uchida qavariq */
const BUMP_PATH = `M0 0 C0 30 ${BUMP_W} 28 ${BUMP_W} ${BUMP_H / 2} C${BUMP_W} ${BUMP_H - 28} 0 ${BUMP_H - 30} 0 ${BUMP_H} Z`;

type Tip = { label: string; top: number; left: number };
type Flyout = { section: NavSection; top: number; left: number };

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4.5 7h15M4.5 12h15M4.5 17h9" />
    </svg>
  );
}

export interface DirectorRailProps {
  slug: string;
  entries: NavEntry[];
  settingsItem: NavLeaf;
  isActive: (item: NavLeaf) => boolean;
  user: TenantAuthenticatedUser | null;
  /** Direktor filial ichiga kirgan bo'lsa — o'sha filial nomi */
  branchName: string | null;
  inBranchContext: boolean;
  onLogout: () => void;
  loggingOut: boolean;
}

/**
 * Bog'cha direktori (Super Admin) uchun yon panel: ingichka to'q ustun,
 * faqat ikonkalar. Nomi ikonka ustiga borilganda chiqadi, ichida havolalari
 * bor bo'limlar yon tomonga kichik menyu bo'lib ochiladi, tepadagi "uch
 * chiziq" esa barcha bo'limlarni nomi bilan ko'rsatadigan panelni ochadi.
 */
export function DirectorRail({
  slug,
  entries,
  settingsItem,
  isActive,
  user,
  branchName,
  inBranchContext,
  onLogout,
  loggingOut,
}: DirectorRailProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const flyoutRef = useRef<HTMLDivElement>(null);

  const [indicator, setIndicator] = useState<{ y: number; visible: boolean } | null>(null);
  // Birinchi joylashuv sakrab emas, darhol — keyingilari suzib o'tadi
  const [animate, setAnimate] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const orgName = user?.organizationName ?? "";

  // Qaysi bo'lim faol: oddiy havola — o'zi, bo'lim — ichidagi havolalardan biri
  let activeKey: string | null = null;
  let ActiveIcon: NavIcon | null = null;
  for (const entry of entries) {
    if (isSection(entry) ? entry.items.some(isActive) : isActive(entry)) {
      activeKey = isSection(entry) ? `s:${entry.id}` : `l:${entry.href}`;
      ActiveIcon = entry.icon;
      break;
    }
  }
  if (!activeKey && isActive(settingsItem)) {
    activeKey = `l:${settingsItem.href}`;
    ActiveIcon = settingsItem.icon;
  }

  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(key, el);
    else itemRefs.current.delete(key);
  };

  const measure = useCallback(() => {
    const aside = asideRef.current;
    const el = activeKey ? itemRefs.current.get(activeKey) : null;
    if (!aside || !el) {
      setIndicator(null);
      return;
    }
    const a = aside.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const center = r.top + r.height / 2;
    // Aylantirilgan ro'yxatda bo'lim ko'rinmay qolsa — bo'rtma ham yashirinadi
    let visible = true;
    const scroller = scrollRef.current;
    if (scroller && scroller.contains(el)) {
      const s = scroller.getBoundingClientRect();
      visible = center > s.top + 14 && center < s.bottom - 14;
    }
    setIndicator({ y: center - a.top, visible });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
  }, [measure, entries.length]);

  // Faol bo'lim aylantirilgan ro'yxatda pastda qolib ketgan bo'lsa — unga aylanadi
  useEffect(() => {
    const el = activeKey ? itemRefs.current.get(activeKey) : null;
    const scroller = scrollRef.current;
    if (el && scroller?.contains(el)) el.scrollIntoView({ block: "nearest" });
  }, [activeKey]);

  useEffect(() => {
    if (!indicator || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [indicator, animate]);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Sahifa almashganda ochiq oynalar yopiladi
  useEffect(() => {
    setFlyout(null);
    setPanelOpen(false);
    setTip(null);
  }, [pathname]);

  useEffect(() => {
    if (!flyout && !panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFlyout(null);
        setPanelOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (flyout && !flyoutRef.current?.contains(target) && !itemRefs.current.get(`s:${flyout.section.id}`)?.contains(target)) {
        setFlyout(null);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [flyout, panelOpen]);

  const railRight = () => (asideRef.current?.getBoundingClientRect().left ?? 0) + RAIL_RIGHT;

  const showTip = (label: string, key: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    if (flyout) return;
    const r = e.currentTarget.getBoundingClientRect();
    const active = key === activeKey;
    setTip({ label, top: r.top + r.height / 2, left: railRight() + (active ? BUMP_W + 12 : 12) });
  };
  const hideTip = () => setTip(null);

  const toggleFlyout = (section: NavSection) => (e: React.MouseEvent<HTMLElement>) => {
    setTip(null);
    if (flyout?.section.id === section.id) {
      setFlyout(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const active = `s:${section.id}` === activeKey;
    const estimated = 70 + section.items.length * 46;
    const top = Math.max(16, Math.min(r.top - 14, window.innerHeight - 16 - estimated));
    setFlyout({ section, top, left: railRight() + (active ? BUMP_W + 14 : 14) });
  };

  const itemBase = "relative flex shrink-0 cursor-pointer items-center justify-center rounded-full outline-none";

  const renderLeaf = (item: NavLeaf, key = `l:${item.href}`) => {
    const active = key === activeKey;
    const Icon = item.icon;
    return (
      <Link
        key={key}
        ref={register(key)}
        href={item.href}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        onMouseEnter={showTip(item.label, key)}
        onMouseLeave={hideTip}
        onFocus={showTip(item.label, key)}
        onBlur={hideTip}
        onClick={hideTip}
        className={clsx(itemBase, styles.item, active && styles.itemActive)}
      >
        <Icon className="h-[22px] w-[22px]" />
        {item.badge != null && item.badge > 0 && (
          <span className={clsx(styles.dot, "absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-400")} aria-hidden="true" />
        )}
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const key = `s:${section.id}`;
    const active = key === activeKey;
    const open = flyout?.section.id === section.id;
    const Icon = section.icon;
    const hasBadge = section.items.some((i) => (i.badge ?? 0) > 0);
    return (
      <button
        key={key}
        ref={register(key)}
        type="button"
        aria-label={section.label}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseEnter={showTip(section.label, key)}
        onMouseLeave={hideTip}
        onFocus={showTip(section.label, key)}
        onBlur={hideTip}
        onClick={toggleFlyout(section)}
        className={clsx(itemBase, styles.item, active && styles.itemActive)}
      >
        <Icon className="h-[22px] w-[22px]" />
        {hasBadge && <span className={clsx(styles.dot, "absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-400")} aria-hidden="true" />}
      </button>
    );
  };

  const settingsKey = `l:${settingsItem.href}`;

  return (
    <aside
      ref={asideRef}
      className={clsx(styles.aside, "relative z-20 hidden shrink-0 flex-col gap-3 py-4 md:flex")}
      style={{ width: RAIL_RIGHT + 20, paddingLeft: RAIL_LEFT }}
      aria-label="Asosiy menyu"
    >
      {/* Bog'cha belgisi — nomidan olinadi, tizimda bir necha bog'cha bor */}
      <Link
        href={`/${slug}`}
        title={orgName}
        aria-label={orgName || "Bosh sahifa"}
        className={clsx(styles.brand, "flex shrink-0 items-center justify-center rounded-full")}
      >
        {user ? (
          <span className={clsx(styles.brandText, "text-[24px] font-extrabold tracking-tight")}>{initials(orgName)}</span>
        ) : (
          <span className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
        )}
      </Link>

      <div className={clsx(styles.rail, "flex min-h-0 flex-1 flex-col items-center py-3")}>
        <button
          type="button"
          onClick={() => {
            setFlyout(null);
            setPanelOpen(true);
          }}
          aria-label={t("expand")}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onMouseEnter={showTip(t("expand"), "menu")}
          onMouseLeave={hideTip}
          className={clsx(itemBase, styles.item)}
        >
          <MenuIcon className="h-[22px] w-[22px]" />
        </button>

        {inBranchContext && (
          <Link
            href={`/${slug}/branches`}
            aria-label={branchName ? `${branchName} — filiallarga qaytish` : "Filiallarga qaytish"}
            onMouseEnter={showTip(branchName ? `← ${branchName}` : "Filiallar", "back")}
            onMouseLeave={hideTip}
            onFocus={showTip(branchName ? `← ${branchName}` : "Filiallar", "back")}
            onBlur={hideTip}
            className={clsx(itemBase, styles.item, "mt-1")}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
        )}

        <div className={clsx(styles.divider, "my-2 shrink-0")} aria-hidden="true" />

        <nav
          ref={scrollRef}
          onScroll={() => {
            measure();
            setTip(null);
            setFlyout(null);
          }}
          className={clsx(styles.scroll, "flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto py-1.5")}
          aria-label="Bo'limlar"
        >
          {entries.map((entry) => (isSection(entry) ? renderSection(entry) : renderLeaf(entry)))}
        </nav>

        <div className={clsx(styles.divider, "my-2 shrink-0")} aria-hidden="true" />

        <div className="flex shrink-0 flex-col items-center gap-2">
          {renderLeaf(settingsItem, settingsKey)}
          <div
            className="my-1 rounded-full p-[3px] ring-1 ring-white/15"
            title={user ? `${user.fullName} · ${ROLE_LABEL[user.role]}` : undefined}
          >
            <Avatar user={user} size={36} />
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-label={t("logoutAria")}
            onMouseEnter={showTip(t("logout"), "logout")}
            onMouseLeave={hideTip}
            onFocus={showTip(t("logout"), "logout")}
            onBlur={hideTip}
            className={clsx(itemBase, styles.item, styles.logout, "disabled:cursor-not-allowed disabled:opacity-50")}
          >
            {loggingOut ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <LogoutIcon className="h-[21px] w-[21px]" />
            )}
          </button>
        </div>
      </div>

      {/* Faol bo'lim: ustundan bo'rtib chiqqan joy va uning ichidagi zumrad doira */}
      {indicator && ActiveIcon && (
        <div
          className={styles.indicator}
          aria-hidden="true"
          style={{
            left: RAIL_RIGHT - 1,
            transform: `translateY(${indicator.y - BUMP_H / 2}px)`,
            opacity: indicator.visible ? 1 : 0,
            transition: animate ? undefined : "none",
          }}
        >
          <svg width={BUMP_W} height={BUMP_H} viewBox={`0 0 ${BUMP_W} ${BUMP_H}`} className={styles.bump}>
            <path d={BUMP_PATH} />
          </svg>
          <span className={styles.orb} style={{ left: 1 - ORB_INSET - ORB_SIZE / 2 }}>
            <ActiveIcon key={activeKey} filled className={clsx(styles.orbIcon, "h-[22px] w-[22px]")} />
          </span>
        </div>
      )}

      {typeof document !== "undefined" &&
        tip &&
        !panelOpen &&
        createPortal(
          <div
            role="tooltip"
            className={clsx(
              styles.tooltip,
              "pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-[10px] bg-[#0d241b] px-3 py-1.5 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(5,40,28,0.5)]",
            )}
            style={{ top: tip.top, left: tip.left }}
          >
            {tip.label}
          </div>,
          document.body,
        )}

      {typeof document !== "undefined" &&
        flyout &&
        createPortal(
          <div
            ref={flyoutRef}
            role="menu"
            aria-label={flyout.section.label}
            className={clsx(
              styles.flyout,
              "fixed z-[70] w-[248px] rounded-[22px] border border-black/[0.04] bg-white p-2 shadow-[0_24px_48px_-16px_rgba(5,40,28,0.28),0_2px_6px_rgba(5,40,28,0.06)]",
            )}
            style={{ top: flyout.top, left: flyout.left }}
          >
            <p className="px-3 pb-1.5 pt-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {flyout.section.label}
            </p>
            {flyout.section.items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "group flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] transition-colors",
                    active
                      ? "bg-emerald-50 font-semibold text-emerald-900"
                      : "font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors",
                      active ? "bg-emerald-500/15 text-emerald-700" : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] group-hover:bg-white",
                    )}
                  >
                    <Icon filled={active} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>,
          document.body,
        )}

      {typeof document !== "undefined" &&
        panelOpen &&
        createPortal(
          <FullMenu
            slug={slug}
            entries={entries}
            settingsItem={settingsItem}
            isActive={isActive}
            user={user}
            branchName={inBranchContext ? branchName : null}
            left={railRight() + 14}
            onClose={() => setPanelOpen(false)}
            onLogout={onLogout}
            loggingOut={loggingOut}
            logoutLabel={t("logout")}
          />,
          document.body,
        )}
    </aside>
  );
}

/** "Uch chiziq" ochadigan panel — barcha bo'limlar nomi bilan, guruhlab */
function FullMenu({
  slug,
  entries,
  settingsItem,
  isActive,
  user,
  branchName,
  left,
  onClose,
  onLogout,
  loggingOut,
  logoutLabel,
}: {
  slug: string;
  entries: NavEntry[];
  settingsItem: NavLeaf;
  isActive: (item: NavLeaf) => boolean;
  user: TenantAuthenticatedUser | null;
  branchName: string | null;
  left: number;
  onClose: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  logoutLabel: string;
}) {
  const orgName = user?.organizationName ?? "";

  const row = (item: NavLeaf) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "group flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] transition-colors",
          active ? "bg-emerald-50 font-semibold text-emerald-900" : "font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]",
        )}
      >
        <Icon filled={active} className={clsx("h-5 w-5 shrink-0", active ? "text-emerald-600" : "text-[var(--color-text-muted)]")} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">{item.badge}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label="Barcha bo'limlar">
      <div className={clsx(styles.scrim, "absolute inset-0 bg-[#0d241b]/20 backdrop-blur-[2px]")} onClick={onClose} aria-hidden="true" />
      <div
        className={clsx(
          styles.panel,
          "absolute bottom-4 top-4 flex w-[320px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_32px_64px_-20px_rgba(5,40,28,0.4)]",
        )}
        style={{ left }}
      >
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#0d241b] text-[16px] font-extrabold text-emerald-300">
            {orgName ? initials(orgName) : ""}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold tracking-[-0.01em] text-[var(--color-text)]">{orgName}</p>
            <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
              {user ? `${user.fullName} · ${ROLE_LABEL[user.role]}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {branchName && (
          <Link
            href={`/${slug}/branches`}
            onClick={onClose}
            className="group mx-4 mb-2 flex items-center gap-2.5 rounded-[16px] bg-emerald-50 px-3.5 py-2.5 transition-colors hover:bg-emerald-100/70"
          >
            <ArrowLeftIcon className="h-4 w-4 shrink-0 text-emerald-700 transition-transform group-hover:-translate-x-0.5" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-semibold text-emerald-700/80">Filiallarga qaytish</span>
              <span className="block truncate text-[14px] font-bold text-emerald-900">{branchName}</span>
            </span>
          </Link>
        )}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Bo'limlar">
          {entries.map((entry) =>
            isSection(entry) ? (
              <div key={entry.id} className="pt-3">
                <p className="px-3 pb-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                  {entry.label}
                </p>
                {entry.items.map(row)}
              </div>
            ) : (
              row(entry)
            ),
          )}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-[var(--color-separator)] px-3 py-3">
          {row(settingsItem)}
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 text-[14.5px] font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-bg)] disabled:opacity-60"
          >
            <LogoutIcon className="h-5 w-5 shrink-0" />
            {logoutLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
