"use client";

import Link from "next/link";
import { useAppPathname } from "@/lib/tenant-host-context";
import clsx from "clsx";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/use-auth";
import { isTeacher } from "@/lib/permissions";
import { isSubjectTeacherPosition } from "@/lib/employee-position";
import { BulbIcon, CalendarIcon, ChecklistIcon, ChildIcon, HomeIcon, UserIcon, type IconProps } from "@/components/ui/icons";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";

type Tab = { href: string; label: string; Icon: ComponentType<IconProps>; exact?: boolean; also?: string[] };

/**
 * Tarbiyachi kabinetining telefondagi asosiy navigatsiyasi — pastda suzib
 * turuvchi "shisha" kapsula (iOS kabi). Yon menyu (uch chiziq) o'rnini
 * bosadi: tarbiyachining kundalik ishi shu 4–5 bo'limda. Kompyuterda
 * ko'rinmaydi — u yerda yon panel bor.
 */
export function TeacherTabBar({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const pathname = useAppPathname();

  if (!user || !isTeacher(user.role)) return null;

  const subjectTeacher = !!user.position && isSubjectTeacherPosition(user.position);

  // Kirgandan keyin manzil `/{slug}/{filial}` bo'lishi mumkin — bosh sahifa shu ham
  const cosmetic = user.branchSlug ? `/${slug}/${user.branchSlug}` : null;
  const path = cosmetic && pathname.startsWith(cosmetic) ? `/${slug}${pathname.slice(cosmetic.length)}` : pathname;

  // Yordamchida ham xuddi shu bo'limlar — davomat unga faqat ko'rish uchun ochiladi.
  // Fan o'qituvchisida bolalar va Foydali yo'q, o'rniga dars jadvali.
  const tabs: Tab[] = [
    { href: `/${slug}`, label: "Bugun", Icon: HomeIcon, exact: true },
    subjectTeacher
      ? { href: `/${slug}/lesson-attendance`, label: "Davomat", Icon: ChecklistIcon }
      : { href: `/${slug}/attendance`, label: "Davomat", Icon: ChecklistIcon },
    ...(subjectTeacher
      ? [{ href: `/${slug}/my-lessons/schedule`, label: "Jadval", Icon: CalendarIcon }]
      : [{ href: `/${slug}/children`, label: "Bolalar", Icon: ChildIcon }]),
    ...(subjectTeacher ? [] : [{ href: `/${slug}/useful/poems`, label: "Foydali", Icon: BulbIcon, also: [`/${slug}/useful`] }]),
    { href: `/${slug}/settings`, label: "Profil", Icon: UserIcon },
  ];

  const isActive = (tab: Tab) =>
    tab.exact ? path === tab.href : path.startsWith(tab.href) || (tab.also ?? []).some((p) => path.startsWith(p));

  return (
    <nav
      aria-label={tr("Tarbiyachi menyusi")}
      className="fixed inset-x-0 bottom-0 z-40 px-4 md:hidden"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className={clsx(styles.tabBar, "mx-auto flex max-w-[440px] items-stretch rounded-full p-1")}>
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                styles.tab,
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] py-[7px]",
                active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]/80",
              )}
            >
              {active && <span className={styles.tabPill} aria-hidden="true" />}
              <tab.Icon filled={active} className={clsx(styles.tabIcon, "relative h-[23px] w-[23px]")} strokeWidth={active ? 2 : 1.7} />
              <span className={clsx("relative truncate text-[10.5px] leading-none", active ? "font-semibold" : "font-medium")}>
                {tr(tab.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
