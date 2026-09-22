"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EmployeeNotification } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { isTeacher } from "@/lib/permissions";
import { BellIcon } from "@/components/ui/icons";

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
  const teacher = isTeacher(user?.role);

  const notificationsQuery = useQuery({
    queryKey: ["employee-notifications", slug],
    queryFn: () => api.get<EmployeeNotification[]>("/app/employee-notifications"),
    enabled: teacher,
    refetchInterval: 60_000,
  });
  const unreadCount = notificationsQuery.data?.filter((n) => !n.isRead).length ?? 0;

  return (
    <header className="hairline flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--color-separator)] bg-[var(--color-surface)]/80 px-6 backdrop-blur-[20px]">
      {user && (
        <p className="truncate text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
          {user.organizationName}
        </p>
      )}
      {teacher && (
        <Link
          href={`/${slug}/my-notifications`}
          aria-label="Bildirishnomalarim"
          className="relative ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)] md:hidden"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      )}
    </header>
  );
}
