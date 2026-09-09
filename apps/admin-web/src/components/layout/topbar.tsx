"use client";

import { useAuth } from "@/lib/use-auth";

/**
 * Yuqori panel faqat kontekstni ko'rsatadi — qaysi tashkilotdasiz.
 * Foydalanuvchi nomi va roli yon panelning tepasida, chiqish tugmasi esa
 * uning pastida turadi, shuning uchun bu yerda takrorlanmaydi.
 */
export function Topbar({ slug: _slug }: { slug: string }) {
  const { user } = useAuth();

  return (
    <header className="hairline flex h-[60px] shrink-0 items-center border-b border-[var(--color-separator)] bg-[var(--color-surface)]/80 px-6 backdrop-blur-[20px]">
      {user && (
        <p className="truncate text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
          {user.organizationName}
        </p>
      )}
    </header>
  );
}
