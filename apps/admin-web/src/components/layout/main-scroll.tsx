"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * `<main>` — yagona DOM elementi, sahifalar orasida faqat `children` almashadi.
 * Next.js sahifa almashganda faqat `window`ni tepaga suradi, bu ichki
 * `overflow-y-auto` konteynerga tegmaydi — shuning uchun ro'yxatni pastga
 * aylantirib turib biror elementga bosilsa, ochilgan yangi sahifa ham o'sha
 * eski scroll pozitsiyasidan boshlanadi va uning boshi (ba'zan oxiri ham)
 * pastki panel/ekran ortida "yo'qolib qolganday" ko'rinadi. Har bir yo'l
 * o'zgarganda shu yerni tepaga qaytaramiz.
 */
export function MainScroll({ children, className }: { children: ReactNode; className: string }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  );
}
