"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import clsx from "clsx";
import { BookOpen, LayoutGrid, MessageSquareQuote, Paperclip, ScrollText } from "lucide-react";
import { useAppPathname } from "@/lib/tenant-host-context";
import { useAuth } from "@/lib/use-auth";
import { canViewUseful, isTeacher } from "@/lib/permissions";
import { isSubjectTeacherPosition } from "@/lib/employee-position";
import { CalendarIcon, ChecklistIcon, ChildIcon, HomeIcon, type IconProps } from "@/components/ui/icons";
import { BellIcon, CalendarIcon as RowCalendarIcon, UserIcon } from "@/components/ios/icons";
import { IosSheet } from "@/components/ios/sheet";
import { Group, Row } from "./teacher-ui";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";

type Tab = { href: string; label: string; Icon: ComponentType<IconProps>; exact?: boolean; also?: string[] };
type MoreItem = { href: string; label: string; icon: ComponentType<IconProps> };

// Lucide belgilari `filled`ni bilmaydi — tab-bar uni beradi, svg'ga o'tib ketmasin
const VazifaIcon = ({ filled: _filled, ...props }: IconProps) => <Paperclip {...props} />;
const MoreIcon = ({ filled: _filled, ...props }: IconProps) => <LayoutGrid {...props} />;

/**
 * Tarbiyachi kabinetining telefondagi asosiy navigatsiyasi — pastda suzib
 * turuvchi "shisha" kapsula (iOS kabi). Yon menyu (uch chiziq) o'rnini
 * bosadi: kundalik ish 4 bo'limda, qolganlari (Foydali, jadval,
 * bildirishnomalar, profil) "Yana" varag'ida. Kompyuterda ko'rinmaydi —
 * u yerda yon panel bor.
 */
export function TeacherTabBar({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const pathname = useAppPathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Bo'lim tanlangach (sahifa almashgach) varaq o'zi yopiladi
  useEffect(() => setMoreOpen(false), [pathname]);

  if (!user || !isTeacher(user.role)) return null;

  const subjectTeacher = !!user.position && isSubjectTeacherPosition(user.position);

  // Kirgandan keyin manzil `/{slug}/{filial}` bo'lishi mumkin — bosh sahifa shu ham
  const cosmetic = user.branchSlug ? `/${slug}/${user.branchSlug}` : null;
  const path = cosmetic && pathname.startsWith(cosmetic) ? `/${slug}${pathname.slice(cosmetic.length)}` : pathname;

  // Yordamchida ham xuddi shu bo'limlar — davomat unga faqat ko'rish uchun ochiladi.
  // Fan o'qituvchisida bolalar o'rniga dars jadvali.
  const tabs: Tab[] = [
    { href: `/${slug}`, label: "Bugun", Icon: HomeIcon, exact: true },
    subjectTeacher
      ? { href: `/${slug}/lesson-attendance`, label: "Davomat", Icon: ChecklistIcon }
      : { href: `/${slug}/attendance`, label: "Davomat", Icon: ChecklistIcon },
    subjectTeacher
      ? { href: `/${slug}/my-lessons/schedule`, label: "Jadval", Icon: CalendarIcon }
      : { href: `/${slug}/children`, label: "Bolalar", Icon: ChildIcon },
    // Guruh fayllari — ota-onalarga vazifa, rasm, video, hujjat yuborish
    { href: `/${slug}/materials`, label: "Vazifa jo'natish", Icon: VazifaIcon },
  ];

  // "Yana" varag'idagi, pastki panelga sig'magan bo'limlar (yon menyudagilar bilan bir xil)
  const showUseful = canViewUseful(user.role) && !subjectTeacher;
  const useful: MoreItem[] = showUseful
    ? [
        { href: `/${slug}/useful/poems`, label: "She'rlar", icon: ScrollText },
        { href: `/${slug}/useful/proverbs`, label: "Maqollar", icon: MessageSquareQuote },
        { href: `/${slug}/useful/tales`, label: "Ertaklar", icon: BookOpen },
      ]
    : [];
  const other: MoreItem[] = [
    ...(subjectTeacher ? [] : [{ href: `/${slug}/my-lessons/schedule`, label: "Dars jadvali", icon: RowCalendarIcon }]),
    { href: `/${slug}/my-notifications`, label: "Bildirishnomalar", icon: BellIcon },
    { href: `/${slug}/settings`, label: "Profil va sozlamalar", icon: UserIcon },
  ];
  const moreActive = [...useful, ...other].some((item) => path.startsWith(item.href)) || path.startsWith(`/${slug}/useful`);

  const isActive = (tab: Tab) =>
    tab.exact ? path === tab.href : path.startsWith(tab.href) || (tab.also ?? []).some((p) => path.startsWith(p));

  const tabClass = (active: boolean) =>
    clsx(
      styles.tab,
      "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] py-[7px]",
      active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]/80",
    );
  const tabInner = (Icon: ComponentType<IconProps>, label: string, active: boolean) => (
    <>
      {active && <span className={styles.tabPill} aria-hidden="true" />}
      <Icon filled={active} className={clsx(styles.tabIcon, "relative h-[23px] w-[23px]")} strokeWidth={active ? 2 : 1.7} />
      <span className={clsx("relative truncate text-[10.5px] leading-none", active ? "font-semibold" : "font-medium")}>{tr(label)}</span>
    </>
  );

  return (
    <>
      <nav
        aria-label={tr("Tarbiyachi menyusi")}
        className="fixed inset-x-0 bottom-0 z-40 px-4 md:hidden"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className={clsx(styles.tabBar, "mx-auto flex max-w-[440px] items-stretch rounded-full p-1")}>
          {tabs.map((tab) => {
            const active = !moreOpen && isActive(tab);
            return (
              <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {tabInner(tab.Icon, tab.label, active)}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen} className={tabClass(moreOpen || moreActive)}>
            {tabInner(MoreIcon, "Yana", moreOpen || moreActive)}
          </button>
        </div>
      </nav>

      <IosSheet open={moreOpen} onClose={() => setMoreOpen(false)} cancelLabel="Yopish" title={tr("Yana")}>
        <div className="space-y-5">
          <Group>
            <Row first icon={Paperclip} title={tr("Vazifa jo'natish")} subtitle={tr("Vazifa, rasm, video yoki hujjat")} href={`/${slug}/materials`} />
          </Group>
          {useful.length > 0 && (
            <Group title={tr("Foydali")}>
              {useful.map((item, i) => (
                <Row key={item.href} first={i === 0} icon={item.icon} title={tr(item.label)} href={item.href} />
              ))}
            </Group>
          )}
          <Group>
            {other.map((item, i) => (
              <Row key={item.href} first={i === 0} icon={item.icon} title={tr(item.label)} href={item.href} />
            ))}
          </Group>
        </div>
      </IosSheet>
    </>
  );
}
