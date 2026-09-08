"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import clsx from "clsx";
import type { ComponentType, SVGProps } from "react";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { ROLE_LABEL, canManageUsers } from "@/lib/permissions";
import {
  ArrowLeftIcon,
  BellIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChecklistIcon,
  ChildIcon,
  GroupIcon,
  HomeIcon,
  KeyIcon,
  MealIcon,
  MoneyIcon,
  NoteIcon,
  PhoneIcon,
  TeacherIcon,
} from "@/components/ui/icons";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  show: boolean;
  exact?: boolean;
  // Yonma-yon turgan bo'limlarni ajratish uchun sarlavha
  group?: string;
}

export function Sidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";
  const showUsersNav = canManageUsers(user?.role);
  const params = useParams<{ branchSlug?: string }>();
  const { branch } = useBranchContext(slug);
  // A NETWORK_ADMIN who hasn't drilled into a specific branch only manages
  // the network itself (home overview + branch list) — every operational
  // module (children, finance, attendance, ...) only makes sense once a
  // branch is selected, so it's hidden from them until then.
  const inBranchContext = isNetworkAdmin && !!params?.branchSlug;
  const base = inBranchContext ? `/${slug}/${params.branchSlug}` : `/${slug}`;

  const rootNavItems: NavItem[] = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    { href: `/${slug}/branches`, label: "Filiallar", icon: BuildingIcon, show: true },
    // Super Admin har bir filialga admin va moliyachi tayinlaydi, shuning uchun
    // foydalanuvchilar bo'limi uning asosiy ro'yxatida turishi shart. Filial
    // ichiga kirilganda bu havola ko'rinmaydi — u yerda filialning kundalik
    // ishi turadi, foydalanuvchi boshqaruvi esa tarmoq darajasidagi ish.
    { href: `/${slug}/users`, label: "Foydalanuvchilar", icon: KeyIcon, show: showUsersNav },
  ];

  const operationalNavItems: NavItem[] = [
    { href: base, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },

    { href: `${base}/crm`, label: "Arizalar (CRM)", icon: PhoneIcon, show: true, group: "Qabul va tarbiyalanuvchilar" },
    { href: `${base}/children`, label: "Bolalar", icon: ChildIcon, show: true },
    { href: `${base}/groups`, label: "Guruhlar", icon: GroupIcon, show: true },

    { href: `${base}/employees`, label: "Xodimlar", icon: TeacherIcon, show: true, group: "Xodimlar" },
    { href: `${base}/hr`, label: "Ish haqi (HR)", icon: BriefcaseIcon, show: true },
    { href: `${base}/staff-attendance`, label: "Xodimlar davomati", icon: CalendarIcon, show: true },

    { href: `${base}/attendance`, label: "Davomat", icon: ChecklistIcon, show: true, group: "Kundalik ish" },
    { href: `${base}/daily-reports`, label: "Kundalik hisobot", icon: NoteIcon, show: true },
    { href: `${base}/nutrition`, label: "Ovqatlanish", icon: MealIcon, show: true },

    { href: `${base}/finance`, label: "Moliya", icon: MoneyIcon, show: true, group: "Moliya va aloqa" },
    { href: `${base}/notifications`, label: "Bildirishnomalar", icon: BellIcon, show: true },
    // Branch/user management stay a network-wide (root-level) concern, never
    // duplicated inside a single branch's panel.
    { href: `/${slug}/users`, label: "Foydalanuvchilar", icon: KeyIcon, show: showUsersNav && !inBranchContext },
  ];

  const navItems = (isNetworkAdmin && !inBranchContext ? rootNavItems : operationalNavItems).filter((item) => item.show);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex">
      <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-bold text-white">
          B
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-[var(--color-text)]">
            {user ? ROLE_LABEL[user.role] : "Admin"}
          </p>
          {user?.branchName && (
            <p className="truncate text-xs leading-tight text-[var(--color-text-muted)]">{user.branchName}</p>
          )}
        </div>
      </div>

      {inBranchContext && (
        <div className="border-b border-[var(--color-border)] px-3 py-3">
          <Link
            href={`/${slug}/branches`}
            className="group flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Filiallar
          </Link>
          <p className="mt-1.5 truncate text-sm font-semibold text-[var(--color-text)]">{branch?.name ?? "..."}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {item.group && (
                <p className="mt-5 mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]/70">
                  {item.group}
                </p>
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:bg-gray-50 hover:text-[var(--color-text)]",
                )}
              >
                {/* Faol bo'limni chetdagi chiziq bilan belgilash */}
                <span
                  className={clsx(
                    "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-primary)] transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon
                  className={clsx(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]/80",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
