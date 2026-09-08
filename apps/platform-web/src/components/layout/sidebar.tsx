"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { ComponentType, SVGProps } from "react";
import { BuildingIcon, CardIcon, DashboardIcon, RefreshIcon } from "@/components/ui/icons";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/organizations", label: "Tashkilotlar", icon: BuildingIcon, group: "Mijozlar" },
  { href: "/plans", label: "Tarif rejalar", icon: CardIcon, group: "Sotuv" },
  { href: "/subscriptions", label: "Obunalar", icon: RefreshIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--color-primary)] text-[15px] font-bold text-white">
          B
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight text-[var(--color-text)]">Platform Admin</p>
          <p className="truncate text-[12px] leading-tight text-[var(--color-text-muted)]">
            Bog&apos;chalar tarmog&apos;i
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2.5 pb-4">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {item.group && (
                <p className="mt-5 mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  {item.group}
                </p>
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "mb-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors duration-150",
                  active
                    ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
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
            </div>
          );
        })}
      </nav>

      <p className="px-4 py-3 text-[11px] text-[var(--color-text-subtle)]">Super Admin paneli</p>
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
