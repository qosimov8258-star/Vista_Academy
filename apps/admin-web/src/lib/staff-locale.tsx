"use client";

import { api } from "./api";
import { useAuth } from "./use-auth";
import { isTenantEntrySession } from "./tenant-session";
import { applyLocale, useAccountLocaleSync } from "@/i18n/account-locale";
import type { Locale } from "@/i18n/config";

/**
 * Xodim tilni tanladi: avval hisobga yoziladi, keyin sahifa shu tilda qayta
 * yuklanadi. Saqlanmasa til almashmaydi — aks holda keyingi ochilishda
 * hisobdagi eski tilga qaytib, chalg'itardi. «Profilga kirish» tabida faqat
 * shu brauzerdagi ko'rinish o'zgaradi, hisob egasining tili emas.
 */
export async function changeStaffLocale(next: Locale) {
  if (!isTenantEntrySession()) await api.put("/app/profile/locale", { locale: next });
  applyLocale(next);
}

/** Panel ochilganda hisobdagi tilni qo'llaydi — hech narsa chizmaydi */
export function StaffLocaleSync() {
  const { user } = useAuth();
  useAccountLocaleSync({
    loaded: !!user,
    accountLocale: user?.locale,
    guest: isTenantEntrySession() || !!user?.staffEntryIssuerId,
    save: (locale) => api.put("/app/profile/locale", { locale }),
  });
  return null;
}
