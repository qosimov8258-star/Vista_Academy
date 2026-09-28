"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EmployeeNotification } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { isChef } from "@/lib/permissions";
import { BellIcon, CameraIcon, HomeIcon, MealIcon, UserIcon, type IconProps } from "@/components/ui/icons";
import { todayTashkent } from "@/features/desk/shared";
import { QuickPhotoSheet } from "./quick-photo-sheet";
import styles from "./chef.module.css";

type Tab = { href: string; label: string; Icon: (p: IconProps) => React.JSX.Element; exact?: boolean; badge?: number };

/**
 * Oshpaz kabinetining telefondagi asosiy navigatsiyasi — pastda, bosh
 * barmoq yetadigan joyda. Oshpazda bor-yo'g'i to'rtta bo'lim bor, shuning
 * uchun yon menyu kerak emas. O'rtadagi katta kamera tugmasi kundagi asosiy
 * ishni — tayyor ovqatni suratga olishni — bir bosishga qisqartiradi.
 * Kompyuterda ko'rinmaydi (u yerda yon panel bor).
 */
export function ChefBottomBar({ slug }: { slug: string }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const chef = isChef(user?.role);

  // Yon panel va yuqori panel bilan bir xil kesh — qo'shimcha so'rov ketmaydi
  const notificationsQuery = useQuery({
    queryKey: ["employee-notifications", slug],
    queryFn: () => api.get<EmployeeNotification[]>("/app/employee-notifications"),
    enabled: chef,
    refetchInterval: 60_000,
  });
  const unread = notificationsQuery.data?.filter((n) => !n.isRead).length ?? 0;

  if (!chef || !user) return null;

  // Kirgandan keyin manzil `/{slug}/{filial}` bo'lishi mumkin — bosh sahifa shu ham
  const cosmetic = user.branchSlug ? `/${slug}/${user.branchSlug}` : null;
  const path = cosmetic && pathname === cosmetic ? `/${slug}` : pathname;
  const isActive = (tab: Tab) => (tab.exact ? path === tab.href : path.startsWith(tab.href));

  const left: Tab[] = [
    { href: `/${slug}`, label: "Bugun", Icon: HomeIcon, exact: true },
    { href: `/${slug}/nutrition`, label: "Menyu", Icon: MealIcon },
  ];
  const right: Tab[] = [
    { href: `/${slug}/my-notifications`, label: "Xabarlar", Icon: BellIcon, badge: unread },
    { href: `/${slug}/settings`, label: "Profil", Icon: UserIcon },
  ];

  const renderTab = (tab: Tab) => {
    const active = isActive(tab);
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors",
          active ? "text-orange-600" : "text-[var(--color-text-muted)] active:bg-black/[0.04]",
        )}
      >
        <span className="relative">
          <tab.Icon filled={active} key={active ? "on" : "off"} className={clsx("h-6 w-6", active && styles.tabPop)} />
          {!!tab.badge && (
            <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10.5px] font-bold leading-none text-white ring-2 ring-white">
              {tab.badge > 9 ? "9+" : tab.badge}
            </span>
          )}
        </span>
        <span className={clsx("text-[11px] leading-none", active ? "font-semibold" : "font-medium")}>{tab.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Oshpaz menyusi"
        className="fixed inset-x-0 bottom-0 z-40 px-3 md:hidden"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-[480px] items-end gap-1 rounded-[26px] border border-black/[0.06] bg-white/90 px-2 pb-2 pt-2 shadow-[0_10px_30px_-10px_rgba(16,24,40,0.25)] backdrop-blur-xl">
          {left.map(renderTab)}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Taomni suratga olish"
              className="-mt-7 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-[0_10px_22px_-6px_rgba(234,88,12,0.65)] ring-[5px] ring-[var(--color-bg)] transition-transform active:scale-95"
            >
              <CameraIcon className="h-7 w-7" />
            </button>
          </div>
          {right.map(renderTab)}
        </div>
      </nav>
      {user.branchId && (
        <QuickPhotoSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          slug={slug}
          branchId={user.branchId}
          date={todayTashkent()}
        />
      )}
    </>
  );
}
