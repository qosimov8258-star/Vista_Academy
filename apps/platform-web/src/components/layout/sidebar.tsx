"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ComponentType, type SVGProps, type SyntheticEvent } from "react";
import { api } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";
import {
  BuildingIcon,
  CardIcon,
  DashboardIcon,
  GlobeIcon,
  LogoutIcon,
  RefreshIcon,
  UserIcon,
} from "@/components/ui/icons";

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
  { href: "/lending-sahifa", label: "Lending sahifa", icon: GlobeIcon },
];

const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname.startsWith(item.href);

/** Brend yozuvi — logotip rasmi o'rniga matn: har o'lchamda tiniq. */
export function ZeeronWordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("font-bold tracking-[-0.045em] text-[var(--color-text)]", className)}>Zeeron</span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Dashboard bilan bir xil kalit — kesh umumiy, qo'shimcha so'rov yo'q
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get<DashboardSummary>("/platform/dashboard/summary"),
    staleTime: 60_000,
  });
  const attention = (summaryQuery.data?.graceSubscriptions ?? 0) + (summaryQuery.data?.suspendedSubscriptions ?? 0);

  const navRef = useRef<HTMLElement>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; height: number } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const trackHover = (event: SyntheticEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const itemRect = event.currentTarget.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setHoverRect({ top: itemRect.top - navRect.top + nav.scrollTop, height: itemRect.height });
  };
  const clearHover = () => setHoverRect(null);

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

  const itemClass = (active: boolean) =>
    clsx(
      "relative z-10 mb-1 flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[15px] transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
      active
        ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-text)]"
        : "font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
    );

  return (
    <aside className="hidden w-[244px] shrink-0 flex-col bg-[var(--color-surface)] md:flex">
      <Link
        href="/"
        className="mx-5 mb-6 mt-6 flex items-baseline gap-2 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <ZeeronWordmark className="text-[27px] leading-none" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          Platforma
        </span>
      </Link>

      <nav ref={navRef} onMouseLeave={clearHover} className="relative flex flex-1 flex-col overflow-y-auto px-3 pb-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 z-0 rounded-[12px] bg-[var(--color-surface-hover)] transition-[transform,height,opacity] duration-200 ease-out"
          style={{
            transform: `translateY(${hoverRect?.top ?? 0}px)`,
            height: hoverRect?.height ?? 0,
            opacity: hoverRect ? 1 : 0,
          }}
        />
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onMouseEnter={trackHover}
              onFocus={trackHover}
              onBlur={clearHover}
              className={itemClass(active)}
            >
              <Icon className="h-[19px] w-[19px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="flex-1" />

        {/* E'tibor talab qiladigan obunalar — faqat bo'lsa */}
        {attention > 0 && (
          <div className="relative z-10 mx-1 mb-5 overflow-hidden rounded-[20px] bg-[var(--color-ink)] px-4 py-4 text-center text-[var(--color-ink-text)]">
            <p className="text-[15px] font-semibold">{attention} ta obuna</p>
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--color-ink-muted)]">
              to&apos;xtatilgan yoki imtiyozli davrda — bog&apos;chalar paneli yopilishi mumkin
            </p>
            <Link
              href="/subscriptions"
              className="mt-3 inline-flex rounded-full bg-[var(--color-ink-raised)] px-5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#3a3a3f]"
            >
              Ko&apos;rib chiqish
            </Link>
          </div>
        )}

        <Link
          href="/profile"
          aria-current={pathname.startsWith("/profile") ? "page" : undefined}
          onMouseEnter={trackHover}
          onFocus={trackHover}
          onBlur={clearHover}
          className={itemClass(pathname.startsWith("/profile"))}
        >
          <UserIcon className="h-[19px] w-[19px] shrink-0" />
          <span className="truncate">Profil</span>
        </Link>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          onMouseEnter={trackHover}
          onFocus={trackHover}
          onBlur={clearHover}
          className={clsx(itemClass(false), "disabled:cursor-wait disabled:opacity-60")}
        >
          <LogoutIcon className="h-[19px] w-[19px] shrink-0" />
          <span className="truncate">Chiqish</span>
        </button>
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
  const items: NavItem[] = [...NAV_ITEMS, { href: "/profile", label: "Profil", icon: UserIcon }];

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
