"use client";

import Link from "next/link";
import { useAppPathname } from "@/lib/tenant-host-context";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import type { TenantAuthenticatedUser } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/permissions";
import { Avatar, initials } from "@/components/ui/avatar";
import { ArrowLeftIcon, ChevronRightIcon, CloseIcon, LogoutIcon } from "@/components/ui/icons";
import { isSection, type NavEntry, type NavIcon, type NavLeaf, type NavSection } from "./nav-types";
import styles from "./director-rail.module.css";

// Geometriya (px, yon panelning chap chetidan). Bo'rtma va qalqib chiquvchi
// oynalar shu qiymatlardan hisoblanadi — CSS'dagi --rail-collapsed bilan bir xil.
const RAIL_LEFT = 16;
const RAIL_COLLAPSED = 76;
const RAIL_EXPANDED = 256;
const RAIL_RIGHT = RAIL_LEFT + RAIL_COLLAPSED;
const BUMP_W = 24;
const BUMP_H = 120;
const ORB_SIZE = 52;
/** Faol doira markazi ustun chetidan shuncha ichkarida — yarmidan ko'pi ustunda */
const ORB_INSET = 10;

/** Ustun chetidan silliq bo'rtib chiqadigan shakl: chetlarida botiq, uchida qavariq */
const BUMP_PATH = `M0 0 C0 30 ${BUMP_W} 28 ${BUMP_W} ${BUMP_H / 2} C${BUMP_W} ${BUMP_H - 28} 0 ${BUMP_H - 30} 0 ${BUMP_H} Z`;

const OPEN_KEY = "bogcha:director-rail-open";

type Tip = { label: string; top: number; left: number };
type Flyout = { section: NavSection; top: number; left: number };

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4.5 7h15M4.5 12h15M4.5 17h9" />
    </svg>
  );
}

/**
 * Ustun kengaygan yoki yig'ilgan. Tanlov brauzerda saqlanadi. Boshlang'ich
 * qiymat har doim "yig'ilgan" — server HTML'i ham shunday; saqlangan holat
 * birinchi renderdan keyin qo'llanadi (aks holda hidratsiya xatosi).
 */
function useRailOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(OPEN_KEY) === "1");
    } catch {
      // Shaxsiy rejimda localStorage yopiq — yig'ilgan holda qolaveradi
    }
  }, []);
  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        // yuqoridagi kabi
      }
      return next;
    });
  }, []);
  return [open, toggle];
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
 * Bog'cha direktori (Super Admin) uchun yon panel — to'q yashil ustun.
 *
 * Yig'ilgan holatda faqat ikonkalar: nomi ikonka ustiga borilganda chiqadi,
 * ichida havolalari bor guruhlar yon tomonga kichik menyu bo'lib ochiladi.
 * Tepadagi "uch chiziq" ustunning o'zini kengaytiradi: ikonkalar joyida
 * qoladi, yonida nomlar paydo bo'ladi, guruhlar ustun ichida ochiladi.
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
  const pathname = useAppPathname();
  const [open, toggleOpen] = useRailOpen();
  const asideRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const flyoutRef = useRef<HTMLDivElement>(null);

  const [indicator, setIndicator] = useState<{ y: number; visible: boolean } | null>(null);
  // Birinchi joylashuv sakrab emas, darhol — keyingilari suzib o'tadi
  const [animate, setAnimate] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  // Kengaygan ustundagi guruhlar: foydalanuvchi tanlovi; tanlamagan bo'lsa —
  // faol havolasi bor guruh ochiq, qolganlari yopiq
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});

  const orgName = user?.organizationName ?? "";
  const isSectionOpen = (s: NavSection) => sectionOpen[s.id] ?? s.items.some(isActive);

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
  }, [measure, entries.length, open]);

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

  // Sahifa almashganda yoki ustun kengayganda qalqib chiquvchilar yopiladi
  useEffect(() => {
    setFlyout(null);
    setTip(null);
  }, [pathname, open]);

  useEffect(() => {
    if (!flyout) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFlyout(null);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!flyoutRef.current?.contains(target) && !itemRefs.current.get(`s:${flyout.section.id}`)?.contains(target)) {
        setFlyout(null);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [flyout]);

  const railRight = () => (asideRef.current?.getBoundingClientRect().left ?? 0) + RAIL_RIGHT;

  // Nomlar faqat yig'ilgan ustunda qalqib chiqadi — kengayganda ular ko'rinib turibdi
  const showTip = (label: string, key: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    if (open || flyout) return;
    const r = e.currentTarget.getBoundingClientRect();
    const active = key === activeKey;
    setTip({ label, top: r.top + r.height / 2, left: railRight() + (active ? BUMP_W + 12 : 12) });
  };
  const hideTip = () => setTip(null);
  const tipHandlers = (label: string, key: string) => ({
    onMouseEnter: showTip(label, key),
    onMouseLeave: hideTip,
    onFocus: showTip(label, key),
    onBlur: hideTip,
  });

  const onSectionClick = (section: NavSection) => (e: React.MouseEvent<HTMLElement>) => {
    setTip(null);
    if (open) {
      setSectionOpen((m) => ({ ...m, [section.id]: !isSectionOpen(section) }));
      return;
    }
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

  /** Qator holati: yig'ilganda faol ikonka doiraga ko'chadi, kengayganda qator zumrad bo'ladi */
  const rowState = (active: boolean) => (active ? (open ? styles.rowActive : styles.rowHidden) : undefined);

  const renderLeaf = (item: NavLeaf, key = `l:${item.href}`) => {
    const active = key === activeKey;
    const Icon = item.icon;
    return (
      <Link
        key={key}
        ref={register(key)}
        href={item.href}
        aria-label={open ? undefined : item.label}
        aria-current={active ? "page" : undefined}
        {...tipHandlers(item.label, key)}
        onClick={hideTip}
        className={clsx(styles.row, rowState(active))}
      >
        <Icon filled={open && active} className="h-[22px] w-[22px] shrink-0" />
        <span className={styles.label}>{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span
            className={clsx(styles.dot, "absolute h-2 w-2 rounded-full bg-[var(--accent-bright)]")}
            style={{ left: "calc((var(--row-size) - 22px) / 2 + 17px)", top: "calc(50% - 11px)" }}
            aria-hidden="true"
          />
        )}
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const key = `s:${section.id}`;
    const hasActiveChild = section.items.some(isActive);
    const expanded = open && isSectionOpen(section);
    // Kengaygan ustunda guruh ochiq bo'lsa, faol bo'lib uning ichidagi havola ko'rinadi
    const active = key === activeKey && !expanded;
    const Icon = section.icon;
    return (
      <div key={key} className="flex w-full flex-col">
        <button
          ref={register(key)}
          type="button"
          aria-label={open ? undefined : section.label}
          aria-haspopup={open ? undefined : "menu"}
          aria-expanded={open ? expanded : flyout?.section.id === section.id}
          data-flyout={!open && flyout?.section.id === section.id ? "open" : undefined}
          {...tipHandlers(section.label, key)}
          onClick={onSectionClick(section)}
          className={clsx(styles.row, rowState(active), open && hasActiveChild && !active && styles.rowParent)}
        >
          <Icon className="h-[22px] w-[22px] shrink-0" />
          <span className={styles.label}>{section.label}</span>
          {open && <ChevronRightIcon className={clsx(styles.chevron, "h-4 w-4", expanded ? "rotate-90" : "")} />}
          {!open && section.items.some((i) => (i.badge ?? 0) > 0) && (
            <span className={clsx(styles.dot, "absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--accent-bright)]")} aria-hidden="true" />
          )}
        </button>
        {expanded && (
          <div className={styles.children}>
            {section.items.map((item) => {
              const childActive = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={childActive ? "page" : undefined}
                  className={clsx(styles.child, childActive && styles.rowActive)}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="ml-2 rounded-full bg-[var(--accent-bright)]/20 px-2 py-0.5 text-[11px] font-bold tabular-nums">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const settingsKey = `l:${settingsItem.href}`;
  const railWidth = open ? RAIL_EXPANDED : RAIL_COLLAPSED;

  return (
    <aside
      ref={asideRef}
      className={clsx(styles.aside, open && styles.open, "relative z-20 hidden shrink-0 flex-col gap-3 py-4 md:flex")}
      style={{ width: RAIL_LEFT + railWidth + (open ? 16 : 20), paddingLeft: RAIL_LEFT }}
      aria-label="Asosiy menyu"
    >
      {/* Bog'cha belgisi — nomidan olinadi, tizimda bir necha bog'cha bor */}
      <Link
        href={`/${slug}`}
        title={open ? undefined : orgName}
        aria-label={orgName || "Bosh sahifa"}
        className={clsx(styles.brandLink, "flex shrink-0 items-center gap-3")}
        style={{ width: railWidth }}
      >
        <span className={clsx(styles.brand, "flex shrink-0 items-center justify-center rounded-full")}>
          {user ? (
            <span className={clsx(styles.brandText, "text-[24px] font-extrabold tracking-tight")}>{initials(orgName)}</span>
          ) : (
            <span className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
          )}
        </span>
        <span className={clsx(styles.brandName, "min-w-0 flex-1")} aria-hidden={!open}>
          <span className="block truncate text-[17px] font-bold tracking-[-0.01em] text-[var(--color-text)]">{orgName}</span>
          <span className="block truncate text-[12.5px] text-[var(--color-text-muted)]">{user ? ROLE_LABEL[user.role] : ""}</span>
        </span>
      </Link>

      <div className={clsx(styles.rail, "flex min-h-0 flex-1 flex-col py-3")} style={{ width: railWidth }}>
        <div className={clsx(styles.list, "flex shrink-0 flex-col gap-1")}>
          <button
            type="button"
            onClick={toggleOpen}
            aria-label={open ? "Menyuni yig'ish" : "Menyuni kengaytirish"}
            aria-expanded={open}
            {...tipHandlers("Menyuni kengaytirish", "menu")}
            className={styles.row}
          >
            <MenuIcon className="h-[22px] w-[22px] shrink-0" />
            <span className={styles.label}>Menyuni yig&apos;ish</span>
          </button>

          {inBranchContext && (
            <Link
              href={`/${slug}/branches`}
              aria-label={branchName ? `${branchName} — filiallarga qaytish` : "Filiallarga qaytish"}
              {...tipHandlers(branchName ? `← ${branchName}` : "Filiallar", "back")}
              className={styles.row}
            >
              <ArrowLeftIcon className="h-5 w-5 shrink-0" />
              <span className={clsx(styles.label, "leading-tight")}>
                <span className="block text-[11px] font-semibold opacity-70">Filiallarga qaytish</span>
                <span className="block truncate">{branchName ?? "Filiallar"}</span>
              </span>
            </Link>
          )}
        </div>

        <div className={clsx(styles.divider, "my-2 shrink-0")} aria-hidden="true" />

        <nav
          ref={scrollRef}
          onScroll={() => {
            measure();
            setTip(null);
            setFlyout(null);
          }}
          className={clsx(styles.scroll, styles.list, "flex min-h-0 w-full flex-1 flex-col overflow-y-auto py-1.5")}
          aria-label="Bo'limlar"
        >
          {entries.map((entry) => (isSection(entry) ? renderSection(entry) : renderLeaf(entry)))}
        </nav>

        <div className={clsx(styles.divider, "my-2 shrink-0")} aria-hidden="true" />

        <div className={clsx(styles.list, "flex shrink-0 flex-col gap-1.5")}>
          {renderLeaf(settingsItem, settingsKey)}
          <div
            className={clsx(styles.row, styles.userRow)}
            title={!open && user ? `${user.fullName} · ${ROLE_LABEL[user.role]}` : undefined}
          >
            <span className="shrink-0 rounded-full ring-2 ring-white/15">
              <Avatar user={user} size={36} />
            </span>
            <span className={clsx(styles.label, "leading-tight")}>
              <span className="block truncate text-[14px] font-semibold text-white">{user?.fullName ?? ""}</span>
              <span className="block truncate text-[12px] font-medium">{user ? ROLE_LABEL[user.role] : ""}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-label={t("logoutAria")}
            {...tipHandlers(t("logout"), "logout")}
            className={clsx(styles.row, styles.logout, "disabled:cursor-not-allowed disabled:opacity-50")}
          >
            {loggingOut ? (
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <LogoutIcon className="h-[21px] w-[21px] shrink-0" />
            )}
            <span className={styles.label}>{t("logout")}</span>
          </button>
        </div>
      </div>

      {/* Faol bo'lim (yig'ilgan holatda): ustundan bo'rtib chiqqan joy va zumrad doira */}
      {indicator && ActiveIcon && (
        <div
          className={styles.indicator}
          aria-hidden="true"
          style={{
            left: RAIL_RIGHT - 1,
            transform: `translateY(${indicator.y - BUMP_H / 2}px)`,
            opacity: !open && indicator.visible ? 1 : 0,
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
        createPortal(
          <div
            role="tooltip"
            className={clsx(
              styles.tooltip,
              "pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-[10px] bg-[var(--accent-rail)] px-3 py-1.5 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--accent-rail)_50%,transparent)]",
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
              "fixed z-[70] w-[248px] overflow-hidden rounded-[22px] border border-black/[0.04] bg-white shadow-[0_24px_48px_-16px_color-mix(in_srgb,var(--accent-rail)_28%,transparent),0_2px_6px_color-mix(in_srgb,var(--accent-rail)_6%,transparent)]",
            )}
            style={{ top: flyout.top, left: flyout.left }}
          >
            <p className="flex items-center gap-2 bg-[var(--accent-rail)] px-3.5 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--accent-light)]">
              <flyout.section.icon className="h-4 w-4 shrink-0" />
              {flyout.section.label}
            </p>
            <div className="p-2">
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
                      ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-soft-ink)]"
                      : "font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors",
                      active ? "bg-[var(--accent-soft-icon)]/15 text-[var(--accent-soft-icon)]" : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] group-hover:bg-white",
                    )}
                  >
                    <Icon filled={active} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="rounded-full bg-[var(--accent-soft-icon)]/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--accent-soft-icon)]">{item.badge}</span>
                  )}
                </Link>
              );
            })}
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
}

export interface DirectorMenuContentProps {
  slug: string;
  entries: NavEntry[];
  settingsItem: NavLeaf;
  isActive: (item: NavLeaf) => boolean;
  user: TenantAuthenticatedUser | null;
  /** Filial ichida bo'lsa — "Filiallarga qaytish" uchun uning nomi */
  branchName: string | null;
  onClose: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  logoutLabel: string;
}

/**
 * Barcha bo'limlar ro'yxati: tepada bog'cha va foydalanuvchi, keyin
 * guruhlangan havolalar, pastda Sozlamalar va Chiqish. Kompyuterda yon
 * panel, telefonda pastdan chiquvchi oyna ichida — ikkalasida bir xil.
 */
export function DirectorMenuContent({
  slug,
  entries,
  settingsItem,
  isActive,
  user,
  branchName,
  onClose,
  onLogout,
  loggingOut,
  logoutLabel,
}: DirectorMenuContentProps) {
  const orgName = user?.organizationName ?? "";

  // Barcha bo'limlar bir ekranga sig'sin deb — ikonkali kataklar to'ri (ilovalar ekrani kabi)
  const tile = (item: NavLeaf) => {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "relative flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-[20px] px-1.5 py-2.5 text-center transition-all active:scale-[0.96]",
          active
            ? "bg-[linear-gradient(145deg,var(--accent-rail)_0%,var(--accent-rail-2)_100%)] text-white shadow-[0_10px_22px_-12px_color-mix(in_srgb,var(--accent-rail)_80%,transparent)]"
            : "bg-[var(--accent-soft)]/70 text-[var(--color-text)]",
        )}
      >
        <span
          className={clsx(
            "flex h-10 w-10 items-center justify-center rounded-[14px]",
            active ? "bg-white/10 text-[var(--accent-light)]" : "bg-white text-[var(--accent-soft-icon)] shadow-[var(--shadow-xs)]",
          )}
        >
          <Icon filled={active} className="h-[22px] w-[22px]" />
        </span>
        <span className="line-clamp-2 w-full text-[12px] font-semibold leading-tight">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-[var(--accent-bright)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--accent-rail)]">{item.badge}</span>
        )}
      </Link>
    );
  };

  // Ketma-ket oddiy havolalar bitta guruhga, har bo'lim o'z sarlavhasi bilan
  const groups: { title: string | null; items: NavLeaf[] }[] = [];
  for (const entry of entries) {
    if (isSection(entry)) groups.push({ title: entry.label, items: entry.items });
    else if (groups.length > 0 && groups[groups.length - 1].title === null) groups[groups.length - 1].items.push(entry);
    else groups.push({ title: null, items: [entry] });
  }

  return (
    <>
      {/* Tepa qism: to'q yashil kartochka — bog'cha va foydalanuvchi, panel bilan bir xil rangda */}
      <div className="relative shrink-0 overflow-hidden bg-[linear-gradient(150deg,var(--accent-rail)_0%,var(--accent-rail-2)_100%)] px-5 pb-5 pt-5">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[var(--accent-bright)]/15 blur-2xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-[18px] font-extrabold text-[var(--accent-light)] ring-1 ring-white/15">
            {orgName ? initials(orgName) : ""}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold tracking-[-0.01em] text-white">{orgName}</p>
            <p className="truncate text-[12.5px] text-[var(--accent-pale)]/75">
              {user ? `${user.fullName} · ${ROLE_LABEL[user.role]}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors active:bg-white/20"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {branchName && (
        <Link
          href={`/${slug}/branches`}
          onClick={onClose}
          className="group mx-4 mt-3 flex shrink-0 items-center gap-2.5 rounded-[16px] bg-[var(--accent-soft)] px-3.5 py-2.5 transition-colors hover:bg-[var(--accent-soft-icon)]/12"
        >
          <ArrowLeftIcon className="h-4 w-4 shrink-0 text-[var(--accent-soft-icon)] transition-transform group-hover:-translate-x-0.5" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-semibold text-[var(--accent-soft-icon)]/80">Filiallarga qaytish</span>
            <span className="block truncate text-[14px] font-bold text-[var(--accent-soft-ink)]">{branchName}</span>
          </span>
        </Link>
      )}

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-3 pt-4" aria-label="Bo'limlar">
        {groups.map((group, gi) => (
          <div key={group.title ?? `g${gi}`}>
            {group.title && (
              <p className="px-1 pb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{group.title}</p>
            )}
            <div className="grid grid-cols-3 gap-2.5">{group.items.map(tile)}</div>
          </div>
        ))}
      </nav>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-[var(--color-separator)] bg-[var(--color-surface-sunken)]/60 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href={settingsItem.href}
          onClick={onClose}
          className="flex h-12 items-center justify-center gap-2 rounded-[16px] bg-white text-[14px] font-semibold text-[var(--color-text)] shadow-[var(--shadow-card)] active:scale-[0.98]"
        >
          <settingsItem.icon className="h-[18px] w-[18px] text-[var(--accent-soft-icon)]" />
          {settingsItem.label}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[16px] bg-[var(--color-danger-bg)] text-[14px] font-semibold text-[var(--color-danger)] active:scale-[0.98] disabled:opacity-60"
        >
          <LogoutIcon className="h-[18px] w-[18px]" />
          {logoutLabel}
        </button>
      </div>
    </>
  );
}
