"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import clsx from "clsx";
import type { ComponentType, SVGProps } from "react";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { ROLE_LABEL, canManageUsers, isTeacher } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import {
  ArrowLeftIcon,
  BellIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  ChecklistIcon,
  ChildIcon,
  GroupIcon,
  HomeIcon,
  KeyIcon,
  MealIcon,
  MoneyIcon,
  NoteIcon,
  PhoneIcon,
  SettingsIcon,
  SidebarIcon,
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
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";
  const showUsersNav = canManageUsers(user?.role);
  const teacher = isTeacher(user?.role);
  const params = useParams<{ branchSlug?: string }>();
  const { branch } = useBranchContext(slug);
  // A NETWORK_ADMIN who hasn't drilled into a specific branch only manages
  // the network itself (home overview + branch list) — every operational
  // module (children, finance, attendance, ...) only makes sense once a
  // branch is selected, so it's hidden from them until then.
  const inBranchContext = isNetworkAdmin && !!params?.branchSlug;
  const base = inBranchContext ? `/${slug}/${params.branchSlug}` : `/${slug}`;

  // Filialga biriktirilgan foydalanuvchi kirgandan keyin `/{slug}/{filial-slug}`
  // manzilida turadi (bu unga kosmetik bookmark havolasi), yon paneldagi
  // havolalar esa `/{slug}/...` dan boshlanadi. Solishtirishdan oldin filial
  // qismini olib tashlaymiz — aks holda hech bir bo'lim faol ko'rinmaydi.
  const cosmeticPrefix = !isNetworkAdmin && user?.branchSlug ? `/${slug}/${user.branchSlug}` : null;
  const currentPath =
    cosmeticPrefix && pathname.startsWith(cosmeticPrefix)
      ? `/${slug}${pathname.slice(cosmeticPrefix.length)}` || `/${slug}`
      : pathname;

  const rootNavItems: NavItem[] = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    { href: `/${slug}/branches`, label: "Filiallar", icon: BuildingIcon, show: true },
    // Filial bo'yicha to'liq hisobot. Sahifaning o'zida filial tanlanadi,
    // shuning uchun yon panelda bitta havola yetarli.
    { href: `/${slug}/report`, label: "Ma'lumotlar", icon: ChartIcon, show: true },
    // Super Admin har bir filialga admin va moliyachi tayinlaydi, shuning uchun
    // bu bo'lim uning asosiy ro'yxatida turishi shart. Filial ichiga
    // kirilganda ko'rinmaydi — u yerda filialning kundalik ishi turadi.
    { href: `/${slug}/users`, label: "Xodimlar", icon: TeacherIcon, show: showUsersNav },
  ];

  // O'qituvchi kabineti: faqat o'z guruhlariga tegishli uchta bo'lim.
  // Qolgan modullar (moliya, xodimlar, CRM, ...) unga ko'rinmaydi ham,
  // ochilmaydi ham — server tomonda ham yopiq.
  const teacherNavItems: NavItem[] = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    { href: `/${slug}/attendance`, label: "Davomat", icon: ChecklistIcon, show: true, group: "Mening guruhlarim" },
    { href: `/${slug}/daily-reports`, label: "Kundalik hisobot", icon: NoteIcon, show: true },
    { href: `/${slug}/children`, label: "Bolalar", icon: ChildIcon, show: true },
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
    { href: `/${slug}/users`, label: "Administratorlar", icon: KeyIcon, show: showUsersNav && !inBranchContext },
  ];

  // Sozlamalar har bir rolda bo'ladi: bu foydalanuvchining o'z hisobi,
  // qaysi bo'limlarga kirishidan qat'i nazar.
  const settingsNavItem: NavItem = {
    href: `/${slug}/settings`,
    label: "Sozlamalar",
    icon: SettingsIcon,
    show: true,
    group: "Hisobim",
  };

  const navItems = (
    teacher ? teacherNavItems : isNetworkAdmin && !inBranchContext ? rootNavItems : operationalNavItems
  )
    .concat(settingsNavItem)
    .filter((item) => item.show);

  return (
    <aside
      className={clsx(
        "hidden shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex",
        // Kenglik o'zgarishi silliq bo'lsin, lekin harakat sozlamasi
        // o'chirilgan bo'lsa darhol almashsin
        "transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div
        className={clsx(
          "flex h-16 shrink-0 items-center border-b border-[var(--color-border)]",
          collapsed ? "justify-center px-2" : "gap-2.5 pl-4 pr-2",
        )}
      >
        {!collapsed && (
          <>
            <Avatar user={user} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-[var(--color-text)]">
                {user ? ROLE_LABEL[user.role] : "Admin"}
              </p>
              {user?.branchName && (
                <p className="truncate text-xs leading-tight text-[var(--color-text-muted)]">{user.branchName}</p>
              )}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Yon panelni ochish" : "Yon panelni yig'ish"}
          title={collapsed ? "Yon panelni ochish" : "Yon panelni yig'ish"}
          aria-expanded={!collapsed}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
        >
          <SidebarIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Filial ichidagi Super Admin uchun: qaysi filialda ekani va orqaga yo'l */}
      {inBranchContext && !collapsed && (
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
      {inBranchContext && collapsed && (
        <Link
          href={`/${slug}/branches`}
          title={branch?.name ? `${branch.name} — filiallarga qaytish` : "Filiallarga qaytish"}
          className="mx-auto mt-3 flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
        >
          <ArrowLeftIcon className="h-[18px] w-[18px]" />
        </Link>
      )}

      <nav className={clsx("flex-1 overflow-y-auto scrollbar-thin py-3", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => {
          const active = item.exact ? currentPath === item.href : currentPath.startsWith(item.href);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {item.group &&
                (collapsed ? (
                  // Yig'ilgan holatda sarlavha sig'maydi — o'rniga ingichka chiziq
                  <div className="mx-2 my-2.5 border-t border-[var(--color-separator)]" aria-hidden />
                ) : (
                  <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]/70">
                    {item.group}
                  </p>
                ))}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={clsx(
                  "group relative mb-0.5 flex items-center rounded-[10px] text-sm font-medium transition-colors",
                  collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2",
                  active
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
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
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Yig'ilganda kim kirganini bilish uchun avatar pastda qoladi */}
      {collapsed && (
        <div className="flex justify-center border-t border-[var(--color-border)] py-3">
          <Avatar user={user} size={32} />
        </div>
      )}
    </aside>
  );
}
