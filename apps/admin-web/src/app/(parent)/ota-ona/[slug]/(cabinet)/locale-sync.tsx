"use client";

import { useQuery } from "@tanstack/react-query";
import { parentApi } from "@/lib/parent-api";
import { isParentEntrySession } from "@/lib/parent-entry";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { applyLocale, useAccountLocaleSync } from "@/i18n/account-locale";
import type { Locale } from "@/i18n/config";

/**
 * Ota-ona tilni tanladi: hisobga yoziladi, keyin kabinet shu tilda qayta
 * yuklanadi. Xodim «Ota-ona profiliga kirish» orqali ochgan tabda faqat
 * ko'rinish o'zgaradi — ota-onaning o'z tili o'zgarmaydi.
 */
export async function changeParentLocale(next: Locale) {
  if (!isParentEntrySession()) await parentApi.put("/app/parent/locale", { locale: next });
  applyLocale(next);
}

/** Kabinet ochilganda hisobdagi tilni qo'llaydi — hech narsa chizmaydi */
export function ParentLocaleSync({ slug }: { slug: string }) {
  // Sahifalar bilan bir xil kalit — qo'shimcha so'rov ketmaydi
  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  useAccountLocaleSync({
    loaded: !!meQuery.data,
    accountLocale: meQuery.data?.parent.locale,
    guest: isParentEntrySession(),
    save: (locale) => parentApi.put("/app/parent/locale", { locale }),
  });
  return null;
}
