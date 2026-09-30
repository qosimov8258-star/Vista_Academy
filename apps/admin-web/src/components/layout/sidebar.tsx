"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAppPathname } from "@/lib/tenant-host-context";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { EmployeeNotification } from "@/lib/types";
import { clearTenantTokens, getTenantRefreshToken } from "@/lib/tenant-session";
import clsx from "clsx";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { useSidebarSections } from "@/lib/use-sidebar-sections";
import { ROLE_LABEL, canManageUsers, canViewUseful, isChef, isTeacher, ownsLanding, receivesEmployeeNotifications } from "@/lib/permissions";
import { formatPositionLabel, isAssistantPosition, isCallOperatorUser, isCashierPosition, isSubjectTeacherPosition } from "@/lib/employee-position";
import { Avatar, initials } from "@/components/ui/avatar";
import { isSection, type NavEntry, type NavLeaf, type NavSection } from "./nav-types";
import { DirectorRail } from "./director-rail";
import { DirectorBottomBar } from "./director-bottom-bar";
import {
  AuditIcon,
  CloseIcon,
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
  ClockIcon,
  CoinIcon,
  FaceIdIcon,
  GlobeIcon,
  GroupIcon,
  HomeIcon,
  KeyIcon,
  MealIcon,
  MoneyIcon,
  NoteIcon,
  PhoneIcon,
  QuestionIcon,
  SettingsIcon,
  ShopIcon,
  LogoutIcon,
  SidebarIcon,
  StarIcon,
  TeacherIcon,
} from "@/components/ui/icons";

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

const RAIL_HINT_KEY = "bogcha:director-rail";

export function Sidebar({ slug }: { slug: string }) {
  const pathname = useAppPathname();
  const router = useRouter();
  const t = useTranslations("sidebar");
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const { user } = useAuth();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [openSections, toggleSection] = useSidebarSections();
  // Mobilda (<768px) tepadagi "uch chiziq" tugmasi ochadigan to'liq menyu (barcha rollar uchun).
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sichqoncha nav elementlari ustidan o'tganda orqa fondagi belgilagich
  // shu yerga qarab silliq siljiydi ("sas" panelidagi kabi hover effekti).
  const navRef = useRef<HTMLElement>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );

  const trackHover = (event: SyntheticEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const itemRect = event.currentTarget.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setHoverRect({
      top: itemRect.top - navRect.top + nav.scrollTop,
      left: itemRect.left - navRect.left + nav.scrollLeft,
      width: itemRect.width,
      height: itemRect.height,
    });
  };

  const clearHover = () => setHoverRect(null);
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";

  // Direktor (Super Admin) uchun yon panel boshqacha — ingichka ikonka ustuni.
  // Foydalanuvchi ma'lumoti yuklanguncha rol noma'lum; oxirgi marta kim
  // kirgani brauzerda eslab qolinadi, shunda direktorga sahifa yangilanganda
  // eski keng panel bir lahza ko'rinib, keyin sakrab o'zgarmaydi.
  const [railHint, setRailHint] = useState(false);
  useEffect(() => {
    try {
      setRailHint(window.localStorage.getItem(RAIL_HINT_KEY) === "1");
    } catch {
      // Shaxsiy rejimda localStorage yopiq — oddiy holatda qolaveradi
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(RAIL_HINT_KEY, user.role === "NETWORK_ADMIN" || user.role === "BRANCH_ADMIN" || isCallOperatorUser(user) ? "1" : "0");
    } catch {
      // yuqoridagi kabi
    }
  }, [user]);
  const isBranchAdmin = user?.role === "BRANCH_ADMIN";
  // Filial admini va call operator ham direktordagi kabi suzuvchi panel oladi —
  // kompyuterda ingichka ikonka ustuni, telefonda pastki panel.
  const useDirectorRail = isNetworkAdmin || isBranchAdmin || isCallOperatorUser(user) || (!user && railHint);
  const useBottomBar = useDirectorRail;
  // "Fan o'qituvchisi" lavozimida tanlangan fan(lar) ko'rsatiladi (masalan
  // "Matematika o'qituvchisi"), boshqa lavozimlarda lavozim nomining o'zi.
  const positionLabel = user?.position ? formatPositionLabel(user.position, user.subjects) : null;
  const showUsersNav = canManageUsers(user?.role);
  const showUseful = canViewUseful(user?.role);
  const teacher = isTeacher(user?.role);
  const isSubjectTeacher = !!user?.position && isSubjectTeacherPosition(user.position);
  const chef = isChef(user?.role);
  const isAssistant = !!user?.position && isAssistantPosition(user.position);
  const isCashier = !!user?.position && isCashierPosition(user.position);
  // Lending sayt bitta tashkilotniki — boshqa bog'chalarda bo'lim ko'rinmaydi
  const showLandingNav = ownsLanding(user?.organizationSlug);
  const isManager = user?.role === "MANAGER";
  const isFinance = user?.role === "FINANCE";
  // Yon paneldagi "Bildirishnomalarim" belgisi uchun — daqiqada bir marta yangilanadi.
  const notificationsQuery = useQuery({
    queryKey: ["employee-notifications", slug],
    queryFn: () => api.get<EmployeeNotification[]>("/app/employee-notifications"),
    enabled: receivesEmployeeNotifications(user?.role),
    refetchInterval: 60_000,
  });
  const unreadNotificationsCount = notificationsQuery.data?.filter((n) => !n.isRead).length ?? 0;
  const params = useParams<{ branchSlug?: string }>();
  const { branch, branches } = useBranchContext(slug);
  // `useBranchContext` (useParams orqali) filial segmentini bitta filialdan
  // ikkinchisiga o'tilganda ishonchli yangilamay qolishi mumkin — xodimlar
  // sahifasida (`employees/page.tsx`) xuddi shu sabab bilan `pathname`dan
  // o'qish ishlatilgan edi. Shu sabab moliyachi filial tanlovi uchun ham
  // filialni to'g'ridan-to'g'ri joriy manzildan o'zimiz aniqlaymiz — aks
  // holda ikkinchi marta boshqa filialga o'tilganda tanlov eskisida qotib
  // qolardi (masalan mobil "Filiallar" panjarasida).
  const pathSegments = pathname.split("/").filter(Boolean);
  const pathBranchSlug = pathSegments[0] === slug ? (pathSegments[1] ?? null) : null;
  const pathBranch = pathBranchSlug ? (branches.find((b) => b.slug === pathBranchSlug) ?? null) : null;
  // Moliyachi (FINANCE) yon paneldagi "Filiallar" bo'limida qaysi filialni
  // tanlagani — shu filialning O'quvchilar/Xodimlar/Eslatmalar havolalari
  // pastda ochiladi. Bitta filial har doim tanlangan holda turishi shart —
  // shuning uchun joriy manzildagi filialga (URL'dan) sinxronlanadi va hech
  // qachon "hech narsa tanlanmagan" holatga tushmaydi (pastda fallback bilan).
  const [financeBranchId, setFinanceBranchId] = useState<string | null>(null);
  useEffect(() => {
    if (pathBranch?.id) setFinanceBranchId(pathBranch.id);
  }, [pathBranch?.id]);
  const financeSelectedBranchId = pathBranch?.id ?? financeBranchId ?? user?.branchId ?? branches[0]?.id ?? null;
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

  // Moliyachi (FINANCE) uchun telefondagi pastki panel: Super Admin ustunidagi
  // bilan bir xil chiroyli suzuvchi navigatsiya, faqat ichidagi bo'limlar
  // boshqacha. Birinchi to'rtta joy doim ko'rinadi, "Filiallar" esa Menyu
  // ichida — bosilganda o'sha filialning Xodimlar sahifasiga o'tadi.
  // Tezkor havolalar (Xodimlar/O'quvchilar/Eslatmalar) ham xuddi shu — doim
  // aniq bitta — tanlangan filialga ishora qiladi, joriy manzildan qat'i nazar.
  // `branches` ro'yxati hali yuklanmagan bo'lishi mumkin (tarmoq so'rovi
  // tugamagan) — shu daqiqada id->slug moslashtirib bo'lmaydi, shuning uchun
  // `pathBranch?.slug`/`user?.branchSlug` bilan zudlik bilan mavjud slug'ga
  // tushiladi; aks holda hamma tezkor havola bir xil `/${slug}` manziliga
  // tushib, Reactga bir xil `key` beradi (konsolda "duplicate key" xatosi).
  const financeSelectedBranchSlug =
    pathBranch?.slug ||
    (financeBranchId && branches.find((b) => b.id === financeBranchId)?.slug) ||
    user?.branchSlug ||
    branches[0]?.slug ||
    null;
  const financeBase = financeSelectedBranchSlug ? `/${slug}/${financeSelectedBranchSlug}` : null;
  // "Filiallar" alohida o'zgaruvchida — pastki panelda ham (to'rttadan keyingi
  // joy sifatida), ham Menyu oynasida (yagona bo'lim sifatida, bosh sahifa va
  // hokazolarni takrorlamasdan) ishlatiladi.
  const financeFiliallarEntry: NavSection = {
    id: "filiallar",
    label: "Filiallar",
    icon: BuildingIcon,
    items: branches.map((b) => ({
      href: `/${slug}/${b.slug}/employees`,
      label: b.name,
      icon: BuildingIcon,
      show: true,
    })),
  };
  // Umumiy `isActive` filialsiz havolalarni kutadi (operatsion rollar uchun
  // to'g'ri), lekin moliyachining Xodimlar/O'quvchilar/Eslatmalar havolalari
  // aynan filial prefiksi bilan ishlaydi — shuning uchun ular xom
  // `pathname`ga solishtiriladi, faqat "Bosh sahifa" kosmetik bookmarkdan
  // qat'i nazar to'g'ri faollashishi uchun `currentPath`da qoladi.
  // "Filiallar" panjarasidagi kataklar bundan mustasno — ular joriy
  // manzilga emas, tanlangan filialga qarab yoritiladi, aks holda Bosh
  // sahifa yoki Sozlamalarga o'tilganda tanlov "unutilib", hech qaysi
  // filial belgilanmagan ko'rinib qolardi. E'tibor bering: "Xodimlar"
  // tezkor havolasining manzili ham tasodifan xuddi shu shakldadir
  // (`/{slug}/{filial}/employees`) — shuning uchun bu yerda matn bo'yicha
  // emas, aynan `financeFiliallarEntry.items`ga tegishli-tegishmasligi
  // bo'yicha ajratiladi, aks holda "Xodimlar" har doim faol bo'lib qolib,
  // pastki panel boshqa bo'limga o'tilganda ham siljimay turardi.
  const financeIsActive = (item: NavLeaf) => {
    if (financeFiliallarEntry.items.includes(item)) {
      const branchTile = branches.find((b) => item.href === `/${slug}/${b.slug}/employees`);
      return branchTile?.id === financeSelectedBranchId;
    }
    return item.exact ? currentPath === item.href : pathname.startsWith(item.href);
  };
  const financeMobileEntries: NavEntry[] = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    { href: financeBase ? `${financeBase}/employees` : `/${slug}`, label: "Xodimlar", icon: TeacherIcon, show: true },
    { href: financeBase ? `${financeBase}/children` : `/${slug}`, label: "O'quvchilar", icon: ChildIcon, show: true },
    { href: financeBase ? `${financeBase}/reminders` : `/${slug}`, label: "Eslatmalar", icon: ClockIcon, show: true },
    financeFiliallarEntry,
  ];

  const rootEntries: NavEntry[] = [
    { href: `/${slug}`, label: t("nav.home"), icon: HomeIcon, show: true, exact: true },
    { href: `/${slug}/branches`, label: t("nav.branches"), icon: BuildingIcon, show: true },
    // Tarmoq bo'ylab ko'rinishlar: barcha filiallarning guruh va bolalari
    // bitta ro'yxatda. Filial darajasidagi `/groups`, `/children` sahifalari
    // bulardan alohida — ular filial xodimlarining kundalik ish joyi.
    { href: `/${slug}/network/groups`, label: t("nav.groups"), icon: GroupIcon, show: true },
    { href: `/${slug}/network/children`, label: t("nav.students"), icon: ChildIcon, show: true },
    { href: `/${slug}/network/finance`, label: t("nav.finance"), icon: MoneyIcon, show: true },
    // Filial bo'yicha to'liq hisobot. Sahifaning o'zida filial tanlanadi,
    // shuning uchun yon panelda bitta havola yetarli.
    { href: `/${slug}/report`, label: t("nav.reports"), icon: ChartIcon, show: true },
    // Super Admin har bir filialga admin va moliyachi tayinlaydi, shuning uchun
    // bu bo'lim uning asosiy ro'yxatida turishi shart. Filial ichiga
    // kirilganda ko'rinmaydi — u yerda filialning kundalik ishi turadi.
    { href: `/${slug}/users`, label: t("nav.employees"), icon: TeacherIcon, show: showUsersNav },
    // Kim, qachon, nima qilgani — butun tarmoq bo'yicha (filial bo'yicha filtr bilan)
    { href: `/${slug}/audit-logs`, label: "Audit", icon: AuditIcon, show: true },
  ];

  // O'qituvchi kabineti: faqat o'z guruhlariga tegishli uchta bo'lim.
  // Qolgan modullar (moliya, xodimlar, CRM, ...) unga ko'rinmaydi ham,
  // ochilmaydi ham — server tomonda ham yopiq.
  const chefEntries: NavEntry[] = [
    { href: `/${slug}`, label: t("nav.home"), icon: HomeIcon, show: true, exact: true },
    {
      href: `/${slug}/my-notifications`,
      label: t("nav.myNotifications"),
      icon: BellIcon,
      show: true,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { href: `/${slug}/nutrition`, label: "Ovqatlanish", icon: MealIcon, show: true },
  ];

  // Tarbiyachi yordamchisi: guruhni, tarbiyachi belgilagan davomatni (faqat ko'rish),
  // bolalarni, dars jadvalini va Foydali bo'limini ko'radi; dori eslatmalari bosh sahifada turadi.
  const assistantEntries: NavEntry[] = [
    ...chefEntries.filter((e) => isSection(e) || !e.href.endsWith("/nutrition")),
    {
      id: "guruhlarim",
      label: t("nav.myGroups"),
      icon: GroupIcon,
      items: [
        { href: `/${slug}/attendance`, label: t("nav.attendance"), icon: ChecklistIcon, show: true },
        { href: `/${slug}/children`, label: t("nav.children"), icon: ChildIcon, show: true },
        { href: `/${slug}/my-lessons/schedule`, label: t("nav.lessonSchedule"), icon: CalendarIcon, show: true },
      ],
    },
    // Tarbiyachining vaqti bo'lmasa yordamchi she'r/maqol/ertak qo'shadi; har birida kim yozgani ko'rinadi.
    {
      id: "foydali",
      label: t("nav.useful"),
      icon: BulbIcon,
      items: [
        { href: `/${slug}/useful/poems`, label: t("nav.poems"), icon: NoteIcon, show: showUseful },
        { href: `/${slug}/useful/proverbs`, label: t("nav.proverbs"), icon: BulbIcon, show: showUseful },
        { href: `/${slug}/useful/tales`, label: t("nav.tales"), icon: BookIcon, show: showUseful },
      ],
    },
  ];

  // Kassir: guruhlar emas, pul bilan ishlaydi. Moliyachi roli bilan kiradi.
  const cashierEntries: NavEntry[] = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: HomeIcon, show: true, exact: true },
    { href: `/${slug}/cash`, label: "Kassa", icon: MoneyIcon, show: true },
    { href: `/${slug}/finance`, label: "Hisob-fakturalar", icon: NoteIcon, show: true },
    { href: `/${slug}/group-payments`, label: "Guruhlar bo'yicha to'lov", icon: GroupIcon, show: true },
    { href: `/${slug}/cash-report`, label: "Oylik hisobot", icon: ChartIcon, show: true },
    {
      id: "oqituvchilar",
      label: "O'qituvchilar",
      icon: TeacherIcon,
      items: [
        { href: `/${slug}/hr`, label: "Ish haqi", icon: BriefcaseIcon, show: true },
        { href: `/${slug}/staff-absences`, label: "Kelmagan kunlar", icon: CalendarIcon, show: true },
      ],
    },
    { href: `/${slug}/my-notifications`, label: "Bildirishnomalarim", icon: BellIcon, show: true },
  ];

  const teacherEntries: NavEntry[] = [
    ...chefEntries.filter((e) => isSection(e) || !e.href.endsWith("/nutrition")),
    {
      id: "guruhlarim",
      label: t("nav.myGroups"),
      icon: GroupIcon,
      items: [
        // Fan o'qituvchisi kunlik emas, o'z darsi bo'yicha davomat qiladi
        { href: isSubjectTeacher ? `/${slug}/lesson-attendance` : `/${slug}/attendance`, label: t("nav.attendance"), icon: ChecklistIcon, show: true },
        { href: `/${slug}/children`, label: t("nav.children"), icon: ChildIcon, show: !isSubjectTeacher },
        // Fan o'qituvchisida dars jadvali alohida "Qo'shimcha darsliklar" o'rniga shu yerda
        { href: `/${slug}/my-lessons/schedule`, label: t("nav.lessonSchedule"), icon: CalendarIcon, show: isSubjectTeacher },
      ],
    },
    {
      id: "darsliklar",
      label: t("nav.extraLessons"),
      icon: BookIcon,
      items: [
        // Filial admini/administratorning `/lessons/...` sahifalari bilan
        // bir xil URL bo'lmasligi uchun o'qituvchining kabineti alohida
        // `/my-lessons/...` manzilida turadi (ikkalasi ham o'sha bir
        // komponentni ko'rsatadi — cheklov rol bo'yicha serverda bo'ladi).
        { href: `/${slug}/my-lessons/schedule`, label: t("nav.lessonSchedules"), icon: CalendarIcon, show: !isSubjectTeacher },
      ],
    },
    // Fan o'qituvchisiga she'r/maqol/ertak kerak emas — bu faqat tarbiyachilar uchun.
    ...(isSubjectTeacher
      ? []
      : [
          {
            id: "foydali",
            label: t("nav.useful"),
            icon: BulbIcon,
            items: [
              { href: `/${slug}/useful/poems`, label: t("nav.poems"), icon: NoteIcon, show: showUseful },
              { href: `/${slug}/useful/proverbs`, label: t("nav.proverbs"), icon: BulbIcon, show: showUseful },
              { href: `/${slug}/useful/tales`, label: t("nav.tales"), icon: BookIcon, show: showUseful },
            ],
          },
        ]),
  ];

  // Call operator: faqat telefon bilan bog'liq ishlar. Telefonda birinchi to'rttasi
  // pastki panelda turadi, qolganlari "Menyu" ichida — shuning uchun eng kerakligi oldinda.
  const callOperatorEntries: NavEntry[] = [
    { href: base, label: t("nav.home"), icon: HomeIcon, show: true, exact: true },
    { href: `${base}/calls`, label: "Qo'ng'iroqlar", icon: PhoneIcon, show: true },
    { href: `${base}/crm`, label: t("nav.crm"), icon: PhoneIcon, show: true },
    { href: `${base}/debtors`, label: "Qarzdorlar", icon: MoneyIcon, show: true },
    { href: `${base}/notifications`, label: t("nav.notifications"), icon: BellIcon, show: true },
  ];

  const operationalEntries: NavEntry[] = [
    { href: base, label: t("nav.home"), icon: HomeIcon, show: true, exact: true },
    // Administratorning kundalik ishi: qo'ng'iroqlar, olib ketish, bugungi holat.
    // Bu sahifalar faqat o'z filialiga biriktirilgan foydalanuvchi uchun ishlaydi
    // (backendda requireBranchScope NETWORK_ADMIN'ni rad etadi) — shuning uchun
    // NETWORK_ADMIN boshqa filialni ko'rib turganda (inBranchContext) yashiriladi,
    // aks holda havola 404/403 ga olib kelardi.
    {
      id: "bugungi-ishlar",
      label: "Bugungi ishlar",
      icon: PhoneIcon,
      items: [
        { href: `${base}/calls`, label: "Qo'ng'iroqlar", icon: PhoneIcon, show: isManager && !inBranchContext },
        { href: `${base}/pickups`, label: "Olib ketish", icon: ChildIcon, show: !inBranchContext && !isManager },
        { href: `${base}/board`, label: "Bugungi holat", icon: ChartIcon, show: !inBranchContext },
        { href: `${base}/weekly-report`, label: "Haftalik hisobot", icon: NoteIcon, show: !inBranchContext },
      ],
    },
    {
      id: "qabul",
      label: t("nav.admissionAndChildren"),
      icon: ChildIcon,
      items: [
        { href: `${base}/crm`, label: t("nav.crm"), icon: PhoneIcon, show: true },
        { href: `${base}/children`, label: t("nav.children"), icon: ChildIcon, show: true },
        { href: `${base}/groups`, label: t("nav.groups"), icon: GroupIcon, show: true },
      ],
    },
    {
      id: "xodimlar",
      label: t("nav.employees"),
      icon: TeacherIcon,
      // Pastki panelda "Xodimlar" bosilganda ro'yxat emas, bugungi davomat ochiladi
      mainHref: `${base}/staff-attendance`,
      items: [
        { href: `${base}/employees`, label: t("nav.employeeList"), icon: TeacherIcon, show: true },
        // Maosh kassirda; administratorga ko'rinmaydi
        { href: `${base}/hr`, label: t("nav.hr"), icon: BriefcaseIcon, show: !isManager },
        { href: `${base}/staff-attendance`, label: t("nav.staffAttendance"), icon: CalendarIcon, show: true },
      ],
    },
    {
      id: "kundalik",
      label: t("nav.dailyWork"),
      icon: ChecklistIcon,
      items: [
        { href: `${base}/nutrition`, label: t("nav.nutrition"), icon: MealIcon, show: true },
        // O'zi bilan xonalar katalogini ham boshqaradi — alohida nav shart emas
        { href: `${base}/lessons/schedule`, label: t("nav.lessonSchedule"), icon: CalendarIcon, show: true },
      ],
    },
    {
      id: "face-id",
      label: t("nav.faceId"),
      icon: FaceIdIcon,
      items: [
        { href: `${base}/face-id/devices`, label: t("nav.devices"), icon: FaceIdIcon, show: true },
        { href: `${base}/face-id/registrations`, label: t("nav.faceRegistry"), icon: ChildIcon, show: true },
      ],
    },
    {
      id: "coin",
      label: t("nav.coin"),
      icon: CoinIcon,
      items: [
        { href: `${base}/coin/children`, label: t("nav.children"), icon: ChildIcon, show: true },
        { href: `${base}/coin/shop`, label: t("nav.shop"), icon: ShopIcon, show: true },
      ],
    },
    {
      id: "foydali",
      label: t("nav.useful"),
      icon: BulbIcon,
      items: [
        { href: `${base}/useful/poems`, label: t("nav.poems"), icon: NoteIcon, show: showUseful },
        { href: `${base}/useful/proverbs`, label: t("nav.proverbs"), icon: BulbIcon, show: showUseful },
        { href: `${base}/useful/tales`, label: t("nav.tales"), icon: BookIcon, show: showUseful },
      ],
    },
    {
      id: "moliya",
      label: t("nav.financeAndContact"),
      icon: MoneyIcon,
      items: [
        { href: `${base}/finance`, label: t("nav.finance"), icon: MoneyIcon, show: !isManager },
        // Qarzdorlarga qo'ng'iroq qilib eslatish administratorning ishi
        { href: `${base}/debtors`, label: "Qarzdorlar", icon: PhoneIcon, show: true },
        { href: `${base}/notifications`, label: t("nav.notifications"), icon: BellIcon, show: true },
        // Avtomatik to'lov eslatmasi sozlamalari — ota-ona kabinetidagi kartani boshqaradi
        { href: `${base}/reminders`, label: t("nav.reminders"), icon: ClockIcon, show: true },
        // Branch/user management stay a network-wide (root-level) concern, never
        // duplicated inside a single branch's panel.
        { href: `/${slug}/users`, label: t("nav.admins"), icon: KeyIcon, show: showUsersNav && !inBranchContext },
      ],
    },
    {
      id: "lending",
      label: t("nav.landingPage"),
      icon: GlobeIcon,
      items: [
        { href: `${base}/lending/teachers`, label: t("nav.teachers"), icon: TeacherIcon, show: showLandingNav },
        { href: `${base}/lending/menu`, label: t("nav.menu"), icon: MealIcon, show: showLandingNav },
        { href: `${base}/lending/groups`, label: t("nav.groups"), icon: GroupIcon, show: showLandingNav },
      ],
    },
    // Direktor filial ichida — shu filialdagi amallar jurnali
    { href: `${base}/audit-logs`, label: "Audit", icon: AuditIcon, show: inBranchContext },
  ];

  // Moliyachi (FINANCE): kundalik operatsion ishlarga (bolalar, guruhlar,
  // xodimlar, ovqatlanish va h.k.) kirmaydi — faqat "Bosh sahifa" va
  // "Filiallar" ko'rinadi (filial tanlangandan keyingi bo'limlar pastda,
  // alohida `financeBranchSection`da chiqadi — operationalEntries'dagi kabi
  // to'liq admin nav emas).
  const financeEntries: NavEntry[] = [
    { href: base, label: t("nav.home"), icon: HomeIcon, show: true, exact: true },
  ];

  // Sozlamalar har bir rolda bo'ladi: bu foydalanuvchining o'z hisobi,
  // qaysi bo'limlarga kirishidan qat'i nazar.
  const settingsItem: NavLeaf = {
    href: `/${slug}/settings`,
    label: t("nav.settings"),
    icon: SettingsIcon,
    show: true,
  };

  const entries = (chef ? chefEntries : isCashier ? cashierEntries : teacher ? (isAssistant ? assistantEntries : teacherEntries) : isNetworkAdmin && !inBranchContext ? rootEntries : isFinance ? financeEntries : isCallOperatorUser(user) ? callOperatorEntries : operationalEntries)
    .map((entry) =>
      isSection(entry) ? { ...entry, items: entry.items.filter((item) => item.show) } : entry,
    )
    .filter((entry) => (isSection(entry) ? entry.items.length > 0 : entry.show));

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const open = () => setDrawerOpen(true);
    window.addEventListener("open-mobile-menu", open);
    return () => window.removeEventListener("open-mobile-menu", open);
  }, []);

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
      await api.post("/app/auth/logout", { refreshToken: getTenantRefreshToken() });
    } finally {
      // So'rovlar keshi tozalanmasa, xuddi shu brauzerda boshqa foydalanuvchi
      // kirganda oldingi filialning raqamlari bir zum ko'rinib qoladi —
      // kesh kaliti foydalanuvchiga emas, tashkilot slug'iga bog'langan.
      clearTenantTokens();
      queryClient.clear();
      router.push(`/${slug}/login`);
      router.refresh();
    }
  };

  // Moliyachi (FINANCE) paneli Super Admin ustuni bilan bir xil to'q
  // temada ko'rinadi (faqat rang/shakl — menyu bandlari o'zgarmaydi):
  // shu tashkilotning tizim rangidagi (--accent-rail/-orb-*) floating karta.
  const dark = isFinance;
  const rowBase =
    "group relative z-10 flex items-center rounded-[16px] text-[15px] transition-colors duration-150 motion-reduce:transition-none";
  const activeRow = dark
    ? "bg-gradient-to-br from-[var(--accent-orb-from)] to-[var(--accent-orb-to)] text-[var(--accent-orb-ink)] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_20px_-8px_rgba(0,0,0,0.4)]"
    : "bg-white text-[var(--color-text)] font-semibold shadow-[var(--shadow-card)]";
  const idleRow = dark
    ? "font-medium text-white/65 hover:text-white"
    : "font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]";

  return (
    <>
    {useDirectorRail ? (
      <DirectorRail
        slug={slug}
        entries={user ? entries : []}
        settingsItem={settingsItem}
        isActive={isActive}
        user={user}
        branchName={branch?.name ?? null}
        inBranchContext={inBranchContext}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    ) : (
    <>
    <aside
      className={clsx(
        "hidden shrink-0 flex-col md:flex",
        // Moliyachi panelida "Yulduzlar" nomi Super Admin ustunidagi kabi
        // menyu kartasidan tashqarida, sahifa foni ustida alohida turadi —
        // ikkovi orasida bo'shliq bilan (DirectorRail'dagi brend belgisi kabi).
        dark ? "gap-3 m-3" : "bg-[var(--color-sidebar)]",
        // Kenglik o'zgarishi silliq bo'lsin, lekin harakat sozlamasi
        // o'chirilgan bo'lsa darhol almashsin
        "transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none",
        collapsed ? "w-[76px]" : "w-[268px]",
      )}
    >
      <div
        className={clsx(
          "flex shrink-0",
          collapsed && dark
            ? "flex-col items-center gap-2 py-3"
            : collapsed
              ? "h-16 items-center justify-center px-2"
              : "h-16 items-center gap-2.5 pl-4 pr-2.5",
        )}
      >
        {/* Tizimda bir necha bog'cha bor — belgi va nom kirgan foydalanuvchining
            tashkilotidan olinadi, hech narsa qattiq yozilmaydi. Moliyachi
            panelida (dark) bu belgi Super Admin ustunidagidek yig'ilgan
            holatda ham ko'rinib turadi. */}
        {(!collapsed || dark) &&
          (user ? (
            <span
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center text-[14px] font-extrabold",
                dark
                  ? "rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_-12px_rgba(0,0,0,0.55)]"
                  : "rounded-[11px] bg-gradient-to-br from-[#14b8a6] to-[var(--color-primary)] text-white shadow-[var(--shadow-primary)]",
              )}
              style={
                dark
                  ? {
                      background:
                        "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--accent-light) 22%, transparent), transparent 60%), var(--accent-rail)",
                    }
                  : undefined
              }
              title={collapsed ? user.organizationName : undefined}
              aria-hidden="true"
            >
              {dark ? (
                <span className="bg-gradient-to-br from-[var(--accent-pale)] via-[var(--accent-light)] to-[var(--accent-bright)] bg-clip-text text-transparent">
                  {initials(user.organizationName)}
                </span>
              ) : (
                initials(user.organizationName)
              )}
            </span>
          ) : (
            <span className="h-9 w-9 shrink-0 animate-pulse rounded-[11px] bg-black/[0.06]" aria-hidden="true" />
          ))}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            {user ? (
              <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-[var(--color-text)]">
                {user.organizationName}
              </p>
            ) : (
              <span className="block h-3.5 w-24 animate-pulse rounded-full bg-black/[0.06]" aria-hidden="true" />
            )}
            {(positionLabel ?? user?.branchName) && (
              <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--color-text-muted)]">
                {positionLabel ?? user?.branchName}
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("expand") : t("collapse")}
          title={collapsed ? t("expand") : t("collapse")}
          aria-expanded={!collapsed}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[11px] text-[var(--color-text-muted)] outline-none transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
        >
          <SidebarIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div
        className={clsx(
          "flex min-h-0 flex-1 flex-col",
          dark && "overflow-hidden rounded-[32px] bg-[var(--accent-rail)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-18px_rgba(0,0,0,0.55)]",
        )}
      >
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

      <nav
        ref={navRef}
        onMouseLeave={clearHover}
        className={clsx("relative flex-1 overflow-y-auto scrollbar-thin pb-4", dark && "pt-3", collapsed ? "px-3" : "px-3")}
      >
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute z-0 transition-[transform,width,height,opacity] duration-200 ease-out motion-reduce:transition-none",
            dark ? "bg-white/10" : "bg-black/[0.045]",
            collapsed ? "rounded-full" : "rounded-[16px]",
          )}
          style={{
            transform: `translate(${hoverRect?.left ?? 0}px, ${hoverRect?.top ?? 0}px)`,
            width: hoverRect?.width ?? 0,
            height: hoverRect?.height ?? 0,
            opacity: hoverRect ? 1 : 0,
          }}
        />
        {collapsed
          ? collapsedGroups.map((group, groupIndex) => (
              <div key={group[0]?.href ?? groupIndex}>
                {groupIndex > 0 && (
                  <div className={clsx("mx-2 my-2 border-t", dark ? "border-white/10" : "border-[var(--color-sidebar-line)]")} aria-hidden />
                )}
                {group.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      onMouseEnter={trackHover}
                      onFocus={trackHover}
                      onBlur={clearHover}
                      className={clsx(
                        "group relative z-10 mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 motion-reduce:transition-none",
                        active ? activeRow : idleRow,
                      )}
                    >
                      <Icon
                        filled={active}
                        className={clsx("h-5 w-5", active ? (dark ? "text-[var(--accent-orb-ink)]" : "text-[var(--color-primary)]") : "text-current")}
                      />
                    </Link>
                  );
                })}
                {/* Moliyachining "Filiallar" akkordioni yig'ilgan holatda ko'rinmay
                    qolmasin — bosilsa panel yoziladi va bo'lim ochiq holda kutadi. */}
                {groupIndex === 0 && isFinance && branches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleCollapsed();
                      if (!(openSections["filiallar"] ?? false)) toggleSection("filiallar");
                    }}
                    title="Filiallar"
                    aria-label="Filiallar"
                    className={clsx(
                      "group relative z-10 mx-auto mb-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[15px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 motion-reduce:transition-none",
                      idleRow,
                    )}
                  >
                    <BuildingIcon className="h-5 w-5 text-current" />
                  </button>
                )}
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
                    onMouseEnter={trackHover}
                    onFocus={trackHover}
                    onBlur={clearHover}
                    className={clsx(rowBase, "mb-1 h-11 gap-3 px-3", active ? activeRow : idleRow)}
                  >
                    <Icon
                      filled={active}
                      className={clsx("h-5 w-5 shrink-0", active ? (dark ? "text-[var(--accent-orb-ink)]" : "text-[var(--color-primary)]") : "text-current")}
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
                    onMouseEnter={trackHover}
                    onFocus={trackHover}
                    onBlur={clearHover}
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
                              onMouseEnter={trackHover}
                              onFocus={trackHover}
                              onBlur={clearHover}
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

        {isFinance && !collapsed && branches.length > 0 && (
          <div className="mb-1">
            <button
              type="button"
              onClick={() => toggleSection("filiallar")}
              aria-expanded={openSections["filiallar"] ?? false}
              onMouseEnter={trackHover}
              onFocus={trackHover}
              onBlur={clearHover}
              className={clsx(rowBase, "h-11 w-full cursor-pointer gap-3 px-3 text-left", idleRow)}
            >
              <BuildingIcon className="h-5 w-5 shrink-0 text-current" />
              <span className="truncate">Filiallar</span>
              <ChevronRightIcon
                className={clsx(
                  "ml-auto h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                  (openSections["filiallar"] ?? false) ? "-rotate-90" : "rotate-90",
                )}
              />
            </button>

            {(openSections["filiallar"] ?? false) && (
              <div className="relative mt-0.5">
                {branches.map((b, index) => {
                  const selected = financeSelectedBranchId === b.id;
                  const last = index === branches.length - 1;
                  const subLinks = [
                    { href: `/${slug}/${b.slug}/children`, label: "O'quvchilar", icon: ChildIcon },
                    { href: `/${slug}/${b.slug}/employees`, label: "Xodimlar", icon: TeacherIcon },
                    { href: `/${slug}/${b.slug}/reminders`, label: "Eslatmalar", icon: ClockIcon },
                  ];
                  return (
                    <div key={b.id}>
                      <div className="relative">
                        <span
                          aria-hidden
                          className="absolute left-[21px] top-0 h-1/2 w-[15px] rounded-bl-[11px] border-b border-l border-white/10"
                        />
                        {!(last && !selected) && (
                          <span aria-hidden className="absolute left-[21px] top-1/2 h-1/2 w-px bg-white/10" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setFinanceBranchId(b.id);
                            // Filial tanlash shu zahoti o'sha filialning ma'lumotini
                            // ko'rsatishi kerak — mobil "Filiallar" menyusidagi kabi,
                            // faqat ro'yxatni ochib qo'yish yetarli emas.
                            router.push(`/${slug}/${b.slug}/employees`);
                          }}
                          aria-pressed={selected}
                          className={clsx(
                            rowBase,
                            "mb-0.5 ml-9 h-10 w-[calc(100%-2.25rem)] cursor-pointer gap-2 pl-3 pr-3 text-left",
                            selected ? activeRow : idleRow,
                          )}
                        >
                          <span className="truncate">{b.name}</span>
                          <ChevronRightIcon
                            className={clsx(
                              "ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                              selected ? "-rotate-90" : "rotate-90",
                            )}
                          />
                        </button>
                      </div>

                      {selected && (
                        <div className="mb-1 ml-[4.5rem]">
                          {subLinks.map((item) => {
                            const active = currentPath.startsWith(item.href);
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                onMouseEnter={trackHover}
                                onFocus={trackHover}
                                onBlur={clearHover}
                                className={clsx(rowBase, "mb-0.5 h-10 gap-2 pl-3 pr-3", active ? activeRow : idleRow)}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!collapsed && (
          <>
            <div className={clsx("mx-2 my-2 border-t", dark ? "border-white/10" : "border-[var(--color-sidebar-line)]")} aria-hidden />
            <Link
              href={settingsItem.href}
              aria-current={isActive(settingsItem) ? "page" : undefined}
              onMouseEnter={trackHover}
              onFocus={trackHover}
              onBlur={clearHover}
              className={clsx(rowBase, "h-11 gap-3 px-3", isActive(settingsItem) ? activeRow : idleRow)}
            >
              <SettingsIcon
                filled={isActive(settingsItem)}
                className={clsx(
                  "h-5 w-5 shrink-0",
                  isActive(settingsItem) ? (dark ? "text-[var(--accent-orb-ink)]" : "text-[var(--color-primary)]") : "text-current",
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
          "mt-auto border-t pb-3 pt-3",
          dark ? "border-white/10" : "border-[var(--color-sidebar-line)]",
          collapsed ? "px-3" : "px-3",
        )}
      >
        {collapsed && (
          <div className="mb-2 flex justify-center">
            <Avatar user={user} size={32} />
          </div>
        )}
        <div className={clsx("mb-1 flex", collapsed ? "justify-center" : "justify-end")}>
          <LanguageSwitcher collapsed={collapsed} dropUp appearance={dark ? "onDark" : "default"} />
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? t("logout") : undefined}
          aria-label={t("logoutAria")}
          className={clsx(
            "group flex h-11 w-full cursor-pointer items-center rounded-[16px] text-[15px] font-medium",
            "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
            "disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
            dark
              ? "text-white/55 hover:bg-[rgba(248,113,113,0.14)] hover:text-[#fecaca]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]",
            collapsed ? "justify-center" : "gap-3 px-3",
          )}
        >
          {loggingOut ? (
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <LogoutIcon className="h-5 w-5 shrink-0" />
          )}
          {!collapsed && <span className="truncate">{t("logout")}</span>}
        </button>
      </div>
      </div>
    </aside>
    {/* Moliyachida ham telefonda — Super Admin ustunidagi bilan bir xil suzuvchi pastki panel */}
    {isFinance && (
      <DirectorBottomBar
        slug={slug}
        entries={user ? financeMobileEntries : []}
        menuEntries={user ? [financeFiliallarEntry] : []}
        settingsItem={settingsItem}
        isActive={financeIsActive}
        user={user}
        branchName={null}
        inBranchContext={false}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    )}
    </>
    )}

    {/* Telefonda — direktor/filial admini uchun suzib turuvchi pastki panel */}
    {useBottomBar && (
      <DirectorBottomBar
        slug={slug}
        entries={user ? entries : []}
        settingsItem={settingsItem}
        isActive={isActive}
        user={user}
        branchName={branch?.name ?? null}
        inBranchContext={inBranchContext}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    )}

    {/* Mobil to'liq menyu (o'qituvchidan boshqa rollar): Topbar'dagi uch chiziq tugmasi ochadi. */}
    {drawerOpen && (
      <div className="fixed inset-0 z-50 md:hidden">
        <div className="absolute inset-0 bg-black/40" aria-hidden onClick={() => setDrawerOpen(false)} />
        <aside
          className="absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col bg-[var(--color-surface)] shadow-[var(--shadow-modal)]"
          aria-label="Asosiy menyu"
        >
          <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-[var(--color-separator)] px-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[var(--color-text)]">{user?.fullName}</p>
              <p className="truncate text-xs text-[var(--color-text-muted)]">{user ? ROLE_LABEL[user.role] : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Menyuni yopish"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-black/[0.05]"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Menyu">
            {[...entries, settingsItem].map((entry) => {
              const renderLink = (item: NavLeaf, nested: boolean) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-medium transition-colors",
                      nested && "ml-3",
                      active
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "text-[var(--color-text)] hover:bg-black/[0.04]",
                    )}
                  >
                    <Icon filled={active} className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              };
              if (!isSection(entry)) return renderLink(entry, false);
              const SectionIcon = entry.icon;
              return (
                <div key={entry.id} className="pt-2">
                  <p className="flex items-center gap-2 px-3.5 pb-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    <SectionIcon className="h-4 w-4" />
                    {entry.label}
                  </p>
                  {entry.items.map((item) => renderLink(item, true))}
                </div>
              );
            })}
          </nav>
          <div className="shrink-0 border-t border-[var(--color-separator)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-60"
            >
              <LogoutIcon className="h-5 w-5 shrink-0" />
              {t("logout")}
            </button>
          </div>
        </aside>
      </div>
    )}
    </>
  );
}
