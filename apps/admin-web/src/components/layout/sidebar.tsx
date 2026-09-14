"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import clsx from "clsx";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { useSidebarSections } from "@/lib/use-sidebar-sections";
import { canManageUsers, canViewUseful, isTeacher } from "@/lib/permissions";
import { formatPositionLabel } from "@/lib/employee-position";
import { Avatar } from "@/components/ui/avatar";
import type { IconProps } from "@/components/ui/icons";
import {
  ArrowLeftIcon,
  BellIcon,
  BookIcon,
  BriefcaseIcon,
  BuildingIcon,
  BulbIcon,
  CalendarIcon,
  ChartIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ChildIcon,
  GroupIcon,
  HomeIcon,
  KeyIcon,
  MealIcon,
  MoneyIcon,
  NoteIcon,
  PhoneIcon,
  QuestionIcon,
  SettingsIcon,
  LogoutIcon,
  SidebarIcon,
  StarIcon,
  TeacherIcon,
} from "@/components/ui/icons";

// `IconProps` — ikonkalar to'plamining o'z tipi: `filled` bayrog'i ham bor,
// faol bo'lim to'ldirilgan ikonka bilan belgilanadi.
type NavIcon = ComponentType<IconProps>;

interface NavLeaf {
  href: string;
  label: string;
  icon: NavIcon;
  show: boolean;
  exact?: boolean;
  /** O'ng chetdagi raqamli belgi (masalan yangi arizalar soni). */
  badge?: number;
  badgeTone?: "warning" | "success" | "danger";
}

/** Ochilib-yopiladigan bo'lim: ichidagi havolalar daraxt chizig'i bilan ulanadi. */
interface NavSection {
  id: string;
  label: string;
  icon: NavIcon;
  items: NavLeaf[];
}

type NavEntry = NavLeaf | NavSection;

function isSection(entry: NavEntry): entry is NavSection {
  return "items" in entry;
}

const BADGE_TONE: Record<NonNullable<NavLeaf["badgeTone"]>, string> = {
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
};

function Badge({ value, tone = "warning" }: { value: number; tone?: NavLeaf["badgeTone"] }) {
  return (
    <span
      className={clsx(
        "ml-auto shrink-0 rounded-[9px] px-2 py-0.5 text-[11px] font-bold leading-5 tabular-nums",
        BADGE_TONE[tone ?? "warning"],
      )}
    >
      {value}
    </span>
  );
}

export function Sidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const { user } = useAuth();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [openSections, toggleSection] = useSidebarSections();
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";
  // "Fan o'qituvchisi" lavozimida tanlangan fan(lar) ko'rsatiladi (masalan
  // "Matematika o'qituvchisi"), boshqa lavozimlarda lavozim nomining o'zi.
  const positionLabel = user?.position ? formatPositionLabel(user.position, user.subjects) : null;
  const showUsersNav = canManageUsers(user?.role);
  const showUseful = canViewUseful(user?.role);
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

  const isActive = (item: NavLeaf) =>
    item.exact ? currentPath === item.href : currentPath.startsWith(item.href);

  const rootEntries: NavEntry[] = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    { href: `/${slug}/branches`, label: "Filiallar", icon: BuildingIcon, show: true },
    // Tarmoq bo'ylab ko'rinishlar: barcha filiallarning guruh va bolalari
    // bitta ro'yxatda. Filial darajasidagi `/groups`, `/children` sahifalari
    // bulardan alohida — ular filial xodimlarining kundalik ish joyi.
    { href: `/${slug}/network/groups`, label: "Guruhlar", icon: GroupIcon, show: true },
    { href: `/${slug}/network/children`, label: "O'quvchilar", icon: ChildIcon, show: true },
    { href: `/${slug}/network/finance`, label: "Moliya", icon: MoneyIcon, show: true },
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
  const teacherEntries: NavEntry[] = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    {
      id: "guruhlarim",
      label: "Mening guruhlarim",
      icon: GroupIcon,
      items: [
        { href: `/${slug}/attendance`, label: "Davomat", icon: ChecklistIcon, show: true },
        { href: `/${slug}/daily-reports`, label: "Kundalik hisobot", icon: NoteIcon, show: true },
        { href: `/${slug}/children`, label: "Bolalar", icon: ChildIcon, show: true },
      ],
    },
    {
      id: "darsliklar",
      label: "Qo'shimcha darsliklar",
      icon: BookIcon,
      items: [
        // Filial admini/administratorning `/lessons/...` sahifalari bilan
        // bir xil URL bo'lmasligi uchun o'qituvchining kabineti alohida
        // `/my-lessons/...` manzilida turadi (ikkalasi ham o'sha bir
        // komponentni ko'rsatadi — cheklov rol bo'yicha serverda bo'ladi).
        { href: `/${slug}/my-lessons/schedule`, label: "Dars jadvallari", icon: CalendarIcon, show: true },
        { href: `/${slug}/my-lessons/topics`, label: "Savol-javob", icon: QuestionIcon, show: true },
        { href: `/${slug}/my-lessons/grades`, label: "Baholari", icon: StarIcon, show: true },
      ],
    },
    {
      id: "foydali",
      label: "Foydali",
      icon: BulbIcon,
      items: [
        { href: `/${slug}/useful/poems`, label: "She'rlar", icon: NoteIcon, show: showUseful },
        { href: `/${slug}/useful/proverbs`, label: "Maqollar", icon: BulbIcon, show: showUseful },
        { href: `/${slug}/useful/tales`, label: "Ertaklar", icon: BookIcon, show: showUseful },
      ],
    },
  ];

  const operationalEntries: NavEntry[] = [
    { href: base, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    {
      id: "qabul",
      label: "Qabul va bolalar",
      icon: ChildIcon,
      items: [
        { href: `${base}/crm`, label: "Arizalar (CRM)", icon: PhoneIcon, show: true },
        { href: `${base}/children`, label: "Bolalar", icon: ChildIcon, show: true },
        { href: `${base}/groups`, label: "Guruhlar", icon: GroupIcon, show: true },
      ],
    },
    {
      id: "xodimlar",
      label: "Xodimlar",
      icon: TeacherIcon,
      items: [
        { href: `${base}/employees`, label: "Xodimlar ro'yxati", icon: TeacherIcon, show: true },
        { href: `${base}/hr`, label: "Ish haqi (HR)", icon: BriefcaseIcon, show: true },
        { href: `${base}/staff-attendance`, label: "Xodimlar davomati", icon: CalendarIcon, show: true },
      ],
    },
    {
      id: "kundalik",
      label: "Kundalik ish",
      icon: ChecklistIcon,
      items: [
        { href: `${base}/attendance`, label: "Davomat", icon: ChecklistIcon, show: true },
        { href: `${base}/daily-reports`, label: "Kundalik hisobot", icon: NoteIcon, show: true },
        { href: `${base}/nutrition`, label: "Ovqatlanish", icon: MealIcon, show: true },
        // O'zi bilan xonalar katalogini ham boshqaradi — alohida nav shart emas
        { href: `${base}/lessons/schedule`, label: "Dars jadvali", icon: CalendarIcon, show: true },
      ],
    },
    {
      id: "foydali",
      label: "Foydali",
      icon: BulbIcon,
      items: [
        { href: `${base}/useful/poems`, label: "She'rlar", icon: NoteIcon, show: showUseful },
        { href: `${base}/useful/proverbs`, label: "Maqollar", icon: BulbIcon, show: showUseful },
        { href: `${base}/useful/tales`, label: "Ertaklar", icon: BookIcon, show: showUseful },
      ],
    },
    {
      id: "moliya",
      label: "Moliya va aloqa",
      icon: MoneyIcon,
      items: [
        { href: `${base}/finance`, label: "Moliya", icon: MoneyIcon, show: true },
        { href: `${base}/notifications`, label: "Bildirishnomalar", icon: BellIcon, show: true },
        // Branch/user management stay a network-wide (root-level) concern, never
        // duplicated inside a single branch's panel.
        { href: `/${slug}/users`, label: "Administratorlar", icon: KeyIcon, show: showUsersNav && !inBranchContext },
      ],
    },
  ];

  // Sozlamalar har bir rolda bo'ladi: bu foydalanuvchining o'z hisobi,
  // qaysi bo'limlarga kirishidan qat'i nazar.
  const settingsItem: NavLeaf = {
    href: `/${slug}/settings`,
    label: "Sozlamalar",
    icon: SettingsIcon,
    show: true,
  };

  const entries = (teacher ? teacherEntries : isNetworkAdmin && !inBranchContext ? rootEntries : operationalEntries)
    .map((entry) =>
      isSection(entry) ? { ...entry, items: entry.items.filter((item) => item.show) } : entry,
    )
    .filter((entry) => (isSection(entry) ? entry.items.length > 0 : entry.show));

  // Yig'ilgan holatda bo'lim sarlavhasi sig'maydi — barcha havolalar
  // tekis ro'yxatga aylanadi, bo'limlar orasi ingichka chiziq bilan ajraladi.
  const collapsedGroups: NavLeaf[][] = [
    ...entries.map((entry) => (isSection(entry) ? entry.items : [entry])),
    [settingsItem],
  ];

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.post("/app/auth/logout");
    } finally {
      // So'rovlar keshi tozalanmasa, xuddi shu brauzerda boshqa foydalanuvchi
      // kirganda oldingi filialning raqamlari bir zum ko'rinib qoladi —
      // kesh kaliti foydalanuvchiga emas, tashkilot slug'iga bog'langan.
      queryClient.clear();
      router.push(`/${slug}/login`);
      router.refresh();
    }
  };

  const rowBase =
    "group relative flex items-center rounded-[16px] text-[15px] transition-colors duration-150 motion-reduce:transition-none";
  const activeRow = "bg-white text-[var(--color-text)] font-semibold shadow-[var(--shadow-card)]";
  const idleRow = "font-medium text-[var(--color-text-muted)] hover:bg-black/[0.045] hover:text-[var(--color-text)]";

  return (
    <aside
      className={clsx(
        "hidden shrink-0 flex-col bg-[var(--color-sidebar)] md:flex",
        // Kenglik o'zgarishi silliq bo'lsin, lekin harakat sozlamasi
        // o'chirilgan bo'lsa darhol almashsin
        "transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none",
        collapsed ? "w-[76px]" : "w-[268px]",
      )}
    >
      <div
        className={clsx(
          "flex h-16 shrink-0 items-center",
          collapsed ? "justify-center px-2" : "gap-2.5 pl-4 pr-2.5",
        )}
      >
        {!collapsed && (
          <>
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ring-1 ring-inset ring-[rgba(16,24,40,0.06)]"
              style={{ background: "linear-gradient(135deg, #4CA6D4, #61AE41)" }}
            >
              V
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading truncate text-sm font-extrabold leading-tight" style={{ color: "#4CA6D4" }}>
                Vista
              </p>
              <p className="truncate text-xs font-bold leading-tight" style={{ color: "#61AE41" }}>
                Academy
              </p>
              {(positionLabel ?? user?.branchName) && (
                <p className="truncate text-[11px] leading-tight text-[var(--color-text-muted)]">
                  {positionLabel ?? user?.branchName}
                </p>
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
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[11px] text-[var(--color-text-muted)] outline-none transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
        >
          <SidebarIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Filial ichidagi Super Admin uchun: qaysi filialda ekani va orqaga yo'l */}
      {inBranchContext && !collapsed && (
        <div className="mx-3 mb-1 rounded-[14px] bg-white/70 px-3 py-2.5">
          <Link
            href={`/${slug}/branches`}
            className="group flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Filiallar
          </Link>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">{branch?.name ?? "..."}</p>
        </div>
      )}
      {inBranchContext && collapsed && (
        <Link
          href={`/${slug}/branches`}
          title={branch?.name ? `${branch.name} — filiallarga qaytish` : "Filiallarga qaytish"}
          className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-[11px] text-[var(--color-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)]"
        >
          <ArrowLeftIcon className="h-[18px] w-[18px]" />
        </Link>
      )}

      <nav className={clsx("flex-1 overflow-y-auto scrollbar-thin pb-4", collapsed ? "px-3" : "px-3")}>
        {collapsed
          ? collapsedGroups.map((group, groupIndex) => (
              <div key={group[0]?.href ?? groupIndex}>
                {groupIndex > 0 && <div className="mx-2 my-2 border-t border-[var(--color-sidebar-line)]" aria-hidden />}
                {group.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group relative mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 motion-reduce:transition-none",
                        active ? activeRow : idleRow,
                      )}
                    >
                      <Icon
                        filled={active}
                        className={clsx("h-5 w-5", active ? "text-[var(--color-primary)]" : "text-current")}
                      />
                    </Link>
                  );
                })}
              </div>
            ))
          : entries.map((entry) => {
              if (!isSection(entry)) {
                const active = isActive(entry);
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(rowBase, "mb-1 h-11 gap-3 px-3", active ? activeRow : idleRow)}
                  >
                    <Icon
                      filled={active}
                      className={clsx("h-5 w-5 shrink-0", active ? "text-[var(--color-primary)]" : "text-current")}
                    />
                    <span className="truncate">{entry.label}</span>
                    {entry.badge != null && <Badge value={entry.badge} tone={entry.badgeTone} />}
                  </Link>
                );
              }

              // Joriy sahifa shu bo'lim ichida bo'lsa — har doim ochiq turadi,
              // aks holda foydalanuvchining o'z tanlovi (sukut bo'yicha yopiq).
              const hasActiveChild = entry.items.some(isActive);
              const open = hasActiveChild || (openSections[entry.id] ?? false);
              const Icon = entry.icon;

              return (
                <div key={entry.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(entry.id)}
                    aria-expanded={open}
                    className={clsx(rowBase, "h-11 w-full cursor-pointer gap-3 px-3 text-left", idleRow)}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-current" />
                    <span className="truncate">{entry.label}</span>
                    <ChevronRightIcon
                      className={clsx(
                        "ml-auto h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                        open ? "-rotate-90" : "rotate-90",
                      )}
                    />
                  </button>

                  {open && (
                    <div className="relative mt-0.5">
                      {entry.items.map((item, itemIndex) => {
                        const active = isActive(item);
                        const last = itemIndex === entry.items.length - 1;
                        return (
                          <div key={item.href} className="relative">
                            {/* Bo'lim ikonkasidan pastga tushib, har bir havolaga
                                buriladigan daraxt chizig'i */}
                            <span
                              aria-hidden
                              className="absolute left-[21px] top-0 h-1/2 w-[15px] rounded-bl-[11px] border-b border-l border-[var(--color-sidebar-line)]"
                            />
                            {!last && (
                              <span
                                aria-hidden
                                className="absolute left-[21px] top-1/2 h-1/2 w-px bg-[var(--color-sidebar-line)]"
                              />
                            )}
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              className={clsx(rowBase, "mb-0.5 ml-9 h-10 gap-2 pl-3 pr-3", active ? activeRow : idleRow)}
                            >
                              <span className="truncate">{item.label}</span>
                              {item.badge != null && <Badge value={item.badge} tone={item.badgeTone} />}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

        {!collapsed && (
          <>
            <div className="mx-2 my-2 border-t border-[var(--color-sidebar-line)]" aria-hidden />
            <Link
              href={settingsItem.href}
              aria-current={isActive(settingsItem) ? "page" : undefined}
              className={clsx(rowBase, "h-11 gap-3 px-3", isActive(settingsItem) ? activeRow : idleRow)}
            >
              <SettingsIcon
                filled={isActive(settingsItem)}
                className={clsx(
                  "h-5 w-5 shrink-0",
                  isActive(settingsItem) ? "text-[var(--color-primary)]" : "text-current",
                )}
              />
              <span className="truncate">{settingsItem.label}</span>
            </Link>
          </>
        )}
      </nav>

      {/* Chiqish har doim eng pastda — u kundalik amal emas, shuning uchun
          bo'limlar ro'yxatidan chetda, alohida qismda turadi. */}
      <div
        className={clsx(
          "mt-auto border-t border-[var(--color-sidebar-line)] pb-3 pt-3",
          collapsed ? "px-3" : "px-3",
        )}
      >
        {collapsed && (
          <div className="mb-2 flex justify-center">
            <Avatar user={user} size={32} />
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? "Chiqish" : undefined}
          aria-label="Tizimdan chiqish"
          className={clsx(
            "group flex h-11 w-full cursor-pointer items-center rounded-[16px] text-[15px] font-medium",
            "text-[var(--color-text-muted)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
            "hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]",
            "disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
            collapsed ? "justify-center" : "gap-3 px-3",
          )}
        >
          {loggingOut ? (
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <LogoutIcon className="h-5 w-5 shrink-0" />
          )}
          {!collapsed && <span className="truncate">Chiqish</span>}
        </button>
      </div>
    </aside>
  );
}
