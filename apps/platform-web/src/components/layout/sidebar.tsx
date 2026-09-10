"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useRef, useState, type ComponentType, type SVGProps, type SyntheticEvent } from "react";
import { useAuth } from "@/lib/use-auth";
import { roleLabel } from "@/lib/format";
import { BuildingIcon, CardIcon, DashboardIcon, RefreshIcon, UserIcon } from "@/components/ui/icons";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/bogchalar", label: "Bog'chalar", icon: BuildingIcon },
  { href: "/plans", label: "Tarif rejalar", icon: CardIcon },
  { href: "/subscriptions", label: "Obunalar", icon: RefreshIcon },
  { href: "/profile", label: "Profil", icon: UserIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navRef = useRef<HTMLElement>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; height: number } | null>(null);

  const trackHover = (event: SyntheticEvent<HTMLAnchorElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const itemRect = event.currentTarget.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setHoverRect({
      top: itemRect.top - navRect.top + nav.scrollTop,
      height: itemRect.height,
    });
  };

  const clearHover = () => setHoverRect(null);

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex">
      <Link
        href="/"
        className="mx-2.5 mt-3 flex items-center gap-2.5 rounded-[10px] px-2 py-2.5 transition-colors duration-150 hover:bg-[var(--color-surface-hover)]"
      >
        <img
          src="/logo.png"
          alt="Nyxo"
          className="h-9 w-9 shrink-0 rounded-[12px] object-cover"
        />
        <div className="min-w-0">
          <img src="/nyxo_logo.png" alt="Nyxo" className="h-7 w-auto object-contain" />
          <p className="truncate text-[12px] leading-tight text-[var(--color-text-muted)]">
            {user ? `${roleLabel(user.role)} paneli` : "Bog'chalar tarmog'i"}
          </p>
        </div>
      </Link>

      <nav
        ref={navRef}
        onMouseLeave={clearHover}
        className="relative flex-1 overflow-y-auto scrollbar-thin px-2.5 pb-4"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2.5 z-0 rounded-[10px] bg-[var(--color-surface-hover)] transition-[transform,height,opacity] duration-200 ease-out"
          style={{
            transform: `translateY(${hoverRect?.top ?? 0}px)`,
            height: hoverRect?.height ?? 0,
            opacity: hoverRect ? 1 : 0,
          }}
        />
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onMouseEnter={trackHover}
              onFocus={trackHover}
              onBlur={clearHover}
              className={clsx(
                "relative z-10 mb-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
                active
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              <Icon
                className={clsx(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-[var(--color-primary)]" : "text-[var(--color-text-subtle)]",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * Telefon/planshet uchun pastdagi navigatsiya — yon panel yashiringan
 * ekranlarda bo'limlar baribir bir bosishda ochilishi kerak.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-[var(--color-primary)]" : "text-[var(--color-text-subtle)]",
            )}
          >
            <Icon className="h-[20px] w-[20px]" />
            <span className="truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
