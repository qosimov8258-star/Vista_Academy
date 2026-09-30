"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EmployeeNotification } from "@/lib/types";
import { isCallOperatorUser } from "@/lib/employee-position";
import { useAuth } from "@/lib/use-auth";
import { isChef, isTeacher, receivesEmployeeNotifications } from "@/lib/permissions";
import { BellIcon } from "@/components/ui/icons";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

/**
 * Yuqori panel faqat kontekstni ko'rsatadi — qaysi tashkilotdasiz.
 * Foydalanuvchi nomi va roli yon panelning tepasida, chiqish tugmasi esa
 * uning pastida turadi, shuning uchun bu yerda takrorlanmaydi.
 *
 * Mobilda o'qituvchi uchun bundan tashqari bildirishnoma qo'ng'irog'i ham
 * shu yerda turadi — yon panel <768px da butunlay yashirilgani va uning
 * o'rnini bosuvchi pastki navigatsiyada joy tejash uchun bu bo'lim
 * takrorlanmagani uchun (qarang: Sidebar).
 */
export function Topbar({ slug }: { slug: string }) {
  const { user } = useAuth();
  const showNotifications = receivesEmployeeNotifications(user?.role);
  // Oshpazda telefonda pastki panel bor: menyu tugmasi va qo'ng'iroqcha takrorlanmaydi
  const chef = isChef(user?.role);
  // Tarbiyachida ham telefonda pastki tab-bar bor — menyu tugmasi kerak emas,
  // til esa Profil (Sozlamalar) ichida
  const teacher = isTeacher(user?.role);
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();

  // Pastki paneli bor rollarda (direktor, filial admini, call operator) telefonda ichki
  // sahifaga kirilganda chap tepada "orqaga" strelkasi. Bosh sahifada kerak emas.
  const usesBottomBar = !!user && (user.role === "NETWORK_ADMIN" || user.role === "BRANCH_ADMIN" || isCallOperatorUser(user));
  const opSegments = pathname
    .split("/")
    .filter(Boolean)
    .slice(1)
    .filter((seg) => seg !== user?.branchSlug);
  const showBack = usesBottomBar && opSegments.length > 0;
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(`/${slug}`);
  };

  const notificationsQuery = useQuery({
    queryKey: ["employee-notifications", slug],
    queryFn: () => api.get<EmployeeNotification[]>("/app/employee-notifications"),
    enabled: showNotifications,
    refetchInterval: 60_000,
  });
  const unreadCount = notificationsQuery.data?.filter((n) => !n.isRead).length ?? 0;

  return (
    <header className="hairline flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--color-separator)] bg-[var(--color-surface)]/80 px-4 backdrop-blur-[20px] md:px-6">
      {/* Oshpaz, tarbiyachi, filial admini, call operator va direktorda telefon menyusi pastki panelda — bu tugma kerak emas */}
      {user && !chef && !teacher && user.role !== "NETWORK_ADMIN" && user.role !== "BRANCH_ADMIN" && !isCallOperatorUser(user) && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-mobile-menu"))}
          aria-label="Menyuni ochish"
          className="-ml-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:bg-black/[0.05] md:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      )}
      {showBack && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Orqaga"
          className="-ml-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-soft-ink)] transition-transform active:scale-90 md:hidden"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
      )}
      {user && (
        <div className={showBack ? "hidden min-w-0 items-center gap-2.5 md:flex" : "flex min-w-0 items-center gap-2.5"}>
          {/* Call operatorda bog'cha belgisi: nomining bosh harflari yashil doirada */}
          {isCallOperatorUser(user) && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-rail)] text-[13px] font-extrabold text-[var(--accent-light)]" aria-hidden="true">
              {user.organizationName.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <p className="truncate text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
            {user.organizationName}
          </p>
        </div>
      )}
      <div id="topbar-actions" className="ml-auto flex items-center gap-2 md:hidden" />
      {showNotifications && !chef && (
        <Link
          href={`/${slug}/my-notifications`}
          aria-label={t("notificationsAria")}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)] md:hidden"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      )}
      <div className={teacher ? "hidden md:ml-auto md:block" : "md:ml-auto"}>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
