"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/use-auth";

/**
 * Bu tab uchun kirish talab qiladi. Avval cookie orqali proxy.ts'da
 * tekshirilardi — lekin cookie butun origin uchun umumiy, shuning uchun
 * bitta tabdan chiqish boshqa tabni ham chiqarib yuborardi. Endi har bir
 * tab o'zining sessionStorage'idagi tokeni (useAuth → api.ts) orqali
 * mustaqil tekshiriladi.
 */
export function AuthGuard({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isError } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !user) {
      const loginUrl = new URL(`/${slug}/login`, window.location.origin);
      loginUrl.searchParams.set("next", pathname);
      router.replace(`${loginUrl.pathname}${loginUrl.search}`);
    }
  }, [isLoading, isError, user, slug, pathname, router]);

  if (isLoading || isError || !user) return null;
  return <>{children}</>;
}
