"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { toInternalPath } from "./tenant-host";

/** Qaysi bog'cha subdomenida turibmiz (`null` — oddiy /{slug}/... rejim). */
const TenantHostContext = createContext<string | null>(null);

export function TenantHostProvider({ slug, children }: { slug: string | null; children: ReactNode }) {
  return <TenantHostContext.Provider value={slug}>{children}</TenantHostContext.Provider>;
}

export function useTenantHostSlug(): string | null {
  return useContext(TenantHostContext);
}

/**
 * `usePathname()` o'rniga: har doim ilova ichidagi yo'lni qaytaradi
 * (/{slug}/attendance). Subdomenda brauzer manzili toza (/attendance),
 * menyudagi "faol bo'lim" solishtiruvlari esa /{slug}/... bilan yozilgan.
 */
export function useAppPathname(): string {
  const pathname = usePathname();
  return toInternalPath(pathname, useTenantHostSlug());
}
