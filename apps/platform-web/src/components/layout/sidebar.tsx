"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { api, assetUrl } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import type { DashboardSummary } from "@/lib/types";
import { initials, roleLabel } from "@/lib/format";
import {
  BuildingIcon,
  CardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DashboardIcon,
  GlobeIcon,
  LogoutIcon,
  RefreshIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";
import { CommandPalette } from "./command-palette";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
  /** Raqamli belgi: "count" — oddiy son, "alert" — e'tibor talab qiladi (qizil). */
  badge?: (summary: DashboardSummary) => { value: number; tone: "count" | "alert" } | null;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Asosiy",
    items: [{ href: "/", label: "Dashboard", icon: DashboardIcon, exact: true }],
  },
  {
    label: "Boshqaruv",
    items: [
      {
        href: "/bogchalar",
        label: "Bog'chalar",
        icon: BuildingIcon,
        badge: (s) => (s.totalOrganizations ? { value: s.totalOrganizations, tone: "count" } : null),
      },
      {
        href: "/subscriptions",
        label: "Obunalar",
        icon: RefreshIcon,
        badge: (s) => {
          const attention = s.graceSubscriptions + s.suspendedSubscriptions;
          return attention ? { value: attention, tone: "alert" } : null;
        },
      },
      { href: "/plans", label: "Tarif rejalar", icon: CardIcon },
    ],
  },
  {
    label: "Kontent",
    items: [{ href: "/lending-sahifa", label: "Lending sahifa", icon: GlobeIcon }],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
const COLLAPSE_KEY = "zeeron.sidebar.collapsed";

const isActive = (pathname: string, item: { href: string; exact?: boolean }) =>
  item.exact ? pathname === item.href : pathname.startsWith(item.href);

/** Brend yozuvi — logotip rasmi o'rniga matn: har o'lchamda tiniq. */
export function ZeeronWordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-bold tracking-[-0.045em] text-[var(--color-text)]", className)}>Zeeron</span>
  );
}

/**
 * Yon panel — kulrang tuvalda suzib turuvchi oq karta:
 * - yig'iladi (faqat ikonkalar + tooltip), holat brauzerda eslab qolinadi;
 * - faol bo'lim ostida qora "pill" bo'limdan bo'limga siljiydi;
 * - bo'limlar guruhlangan, raqamli belgilar bilan;
 * - tepada ⌘K tezkor qidiruv, pastda profil kartasi (Profil / Chiqish).
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Server render'da localStorage yo'q — holat mount'dan keyin tiklanadi
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // bloklangan saqlash — ochiq holat qoladi
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        // e'tiborsiz
      }
      return !value;
    });
  };

  // ⌘K / Ctrl+K — istalgan sahifadan tezkor qidiruv
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Dashboard bilan bir xil kalit — kesh umumiy, qo'shimcha so'rov yo'q
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get<DashboardSummary>("/platform/dashboard/summary"),
    staleTime: 60_000,
  });
  const summary = summaryQuery.data;

  // Faol bo'lim ostidagi siljuvchi "pill"
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const measure = useCallback(() => {
    const activeItem = ALL_ITEMS.find((item) => isActive(pathname, item));
    const el = activeItem ? itemRefs.current.get(activeItem.href) : undefined;
    setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [pathname]);
  useLayoutEffect(() => {
    measure();
  }, [measure, collapsed, summary]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api.post("/platform/auth/logout");
    } finally {
      // Keshni tozalamasak, keyingi kirgan foydalanuvchi bir zum oldingisining ma'lumotini ko'radi
      queryClient.clear();
      router.push("/login");
      router.refresh();
    }
  };

  const displayName = user?.fullName || user?.login || "";
  const avatarSrc = assetUrl(user?.avatarUrl);
  const attention = summary ? summary.graceSubscriptions + summary.suspendedSubscriptions : 0;

  return (
    <aside
      className={clsx(
        "hidden shrink-0 p-3 pr-0 transition-[width] duration-300 ease-[var(--ease-ios)] md:flex",
        collapsed ? "w-[92px]" : "w-[262px]",
      )}
    >
      <div className="flex min-h-0 w-full flex-col rounded-[28px] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        {/* Brend va yig'ish tugmasi */}
        <div className={clsx("flex items-center pb-4 pt-5", collapsed ? "flex-col gap-3 px-3" : "justify-between pl-6 pr-3")}>
          <Link href="/" aria-label="Zeeron — Dashboard" className="flex items-baseline gap-2 rounded-[10px]">
            {collapsed ? (
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--color-ink)] text-[20px] font-bold tracking-[-0.04em] text-white">
                Z
              </span>
            ) : (
              <>
                <ZeeronWordmark className="text-[26px] leading-none" />
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-subtle)]">Platforma</span>
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Yon panelni ochish" : "Yon panelni yig'ish"}
            title={collapsed ? "Ochish" : "Yig'ish"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          >
            {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
          </button>
        </div>

        {/* Tezkor qidiruv */}
        <div className={clsx("pb-3", collapsed ? "px-3" : "px-4")}>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Tezkor qidiruv (⌘K)"
            className={clsx(
              "group relative flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-[14px] bg-[var(--color-surface-sunken)] text-[14px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)]",
              collapsed ? "justify-center" : "px-3.5",
            )}
          >
            <SearchIcon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Qidirish</span>
                <kbd className="rounded-md bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] font-medium shadow-[var(--shadow-card)]">⌘K</kbd>
              </>
            )}
            {collapsed && <Tooltip label="Qidirish ⌘K" />}
          </button>
        </div>

        <nav ref={navRef} aria-label="Asosiy navigatsiya" className={clsx("relative flex-1 pb-3", collapsed ? "overflow-visible px-3" : "overflow-y-auto px-4")}>
          {/* Siljuvchi faol "pill" */}
          <span
            aria-hidden
            className={clsx(
              "pointer-events-none absolute z-0 rounded-[14px] bg-[var(--color-ink)] shadow-[var(--shadow-raised)] transition-[transform,height,opacity] duration-300 ease-[var(--ease-ios)]",
              collapsed ? "inset-x-3" : "inset-x-4",
            )}
            style={{ transform: `translateY(${pill?.top ?? 0}px)`, height: pill?.height ?? 0, opacity: pill ? 1 : 0 }}
          />
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div key={section.label} className={clsx(sectionIndex > 0 && "mt-4")}>
              {collapsed ? (
                sectionIndex > 0 && <div className="mx-auto mb-3 h-px w-8 bg-[var(--color-separator)]" />
              ) : (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">{section.label}</p>
              )}
              {section.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                const badge = summary && item.badge ? item.badge(summary) : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.href, el);
                      else itemRefs.current.delete(item.href);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group relative z-10 mb-1 flex h-11 items-center gap-3 rounded-[14px] text-[14.5px] transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
                      collapsed ? "justify-center" : "px-3",
                      active
                        ? "font-semibold text-white"
                        : "font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
                    )}
                  >
                    <span className="relative shrink-0">
                      <Icon className="h-[19px] w-[19px]" />
                      {collapsed && badge && (
                        <span
                          className={clsx(
                            "absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full ring-2",
                            active ? "ring-[var(--color-ink)]" : "ring-[var(--color-surface)]",
                            badge.tone === "alert" ? "bg-[var(--color-danger)]" : "bg-[var(--color-accent-muted)]",
                          )}
                        />
                      )}
                    </span>
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {!collapsed && badge && (
                      <span
                        className={clsx(
                          "min-w-[24px] rounded-full px-2 py-0.5 text-center text-[11.5px] font-semibold tabular-nums",
                          badge.tone === "alert"
                            ? "bg-[var(--color-danger)] text-white"
                            : active
                              ? "bg-white/15 text-white"
                              : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
                        )}
                      >
                        {badge.value}
                      </span>
                    )}
                    {collapsed && <Tooltip label={item.label + (badge ? ` · ${badge.value}` : "")} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* E'tibor talab qiladigan obunalar — faqat bo'lsa va ochiq holatda */}
        {!collapsed && attention > 0 && (
          <div className="mx-4 mb-3 overflow-hidden rounded-[20px] bg-[var(--color-ink)] px-4 py-4 text-[var(--color-ink-text)]">
            <p className="text-[14.5px] font-semibold">{attention} ta obuna e&apos;tibor kutmoqda</p>
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--color-ink-muted)]">To&apos;xtatilgan yoki imtiyozli davrda</p>
            <Link
              href="/subscriptions"
              className="mt-3 inline-flex rounded-full bg-[var(--color-ink-raised)] px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#3a3a3f]"
            >
              Ko&apos;rib chiqish
            </Link>
          </div>
        )}

        {/* Profil kartasi */}
        <div className={clsx("relative border-t border-[var(--color-separator)] p-3")}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Profil menyusi"
            className={clsx(
              "flex w-full cursor-pointer items-center gap-3 rounded-[16px] p-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]",
              collapsed && "justify-center",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)] text-[13px] font-semibold text-[var(--color-text)]">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(displayName || "?")
              )}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-[var(--color-text)]">{displayName}</span>
                <span className="block truncate text-[12px] text-[var(--color-text-muted)]">{user ? roleLabel(user.role) : ""}</span>
              </span>
            )}
          </button>
          {menuOpen && (
            <ProfileMenu
              collapsed={collapsed}
              onClose={() => setMenuOpen(false)}
              onLogout={logout}
              loggingOut={loggingOut}
            />
          )}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        links={[...ALL_ITEMS, { href: "/profile", label: "Profil", icon: UserIcon }]}
      />
    </aside>
  );
}

/** Yig'ilgan holatda ikonka yonida chiqadigan nom. */
function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[10px] bg-[var(--color-ink)] px-2.5 py-1.5 text-[12.5px] font-medium text-white opacity-0 shadow-[var(--shadow-raised)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

function ProfileMenu({
  collapsed,
  onClose,
  onLogout,
  loggingOut,
}: {
  collapsed: boolean;
  onClose: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className={clsx(
        "absolute bottom-[calc(100%-4px)] z-40 w-[220px] overflow-hidden rounded-[18px] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-raised)] ring-1 ring-[var(--color-border)]",
        collapsed ? "left-3" : "inset-x-3 w-auto",
      )}
    >
      <Link
        href="/profile"
        role="menuitem"
        onClick={onClose}
        className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[14px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      >
        <UserIcon className="h-[18px] w-[18px] text-[var(--color-text-muted)]" />
        Profil
      </Link>
      <button
        type="button"
        role="menuitem"
        onClick={onLogout}
        disabled={loggingOut}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[14px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:cursor-wait disabled:opacity-60"
      >
        <LogoutIcon className="h-[18px] w-[18px]" />
        Chiqish
      </button>
    </div>
  );
}

/**
 * Telefon/planshet uchun pastdagi navigatsiya — yon panel yashiringan
 * ekranlarda bo'limlar baribir bir bosishda ochilishi kerak.
 */
export function MobileNav() {
  const pathname = usePathname();
  const items: NavItem[] = [...ALL_ITEMS, { href: "/profile", label: "Profil", icon: UserIcon }];

  return (
    <nav className="sticky bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-[var(--color-text)]" : "text-[var(--color-text-subtle)]",
            )}
          >
            <Icon className="h-[20px] w-[20px]" />
            <span className="w-full truncate px-1 text-center">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
