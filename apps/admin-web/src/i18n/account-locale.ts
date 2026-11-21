"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { isLocale, localeCookieName, type Locale } from "./config";

/**
 * Til hisobga bog'langan (xodimda `TenantUser.locale`, ota-onada
 * `Guardian.locale`). Cookie esa faqat server sahifani qaysi tilda chizishini
 * biladigan joy: u butun brauzer uchun bitta, shuning uchun avval bitta
 * brauzerdagi hamma hisob oxirgi tanlangan tilda ochilardi.
 */

/** Kirish sahifasida (hisobsiz) tanlangan til — kirgach hisobga yoziladi */
const PICKED_KEY = "bogcha:locale-picked";

/** Cookie yoziladi; brauzer cookie'ni qabul qilmagan bo'lsa — false */
function writeLocaleCookie(next: Locale): boolean {
  document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000`;
  return document.cookie.split("; ").includes(`${localeCookieName}=${next}`);
}

/**
 * Tilni almashtiradi: cookie yoziladi va sahifa to'liq qayta yuklanadi.
 * router.refresh() yetarli emas: DomTranslator ba'zi matn tugunlarini React'dan
 * tashqarida almashtirgan, React esa ularni "o'zgarmagan" deb o'tkazib yuboradi —
 * shuning uchun eski til qolib ketardi. To'liq qayta yuklash toza holat beradi.
 */
export function applyLocale(next: Locale) {
  writeLocaleCookie(next);
  window.location.reload();
}

/** Kirish sahifasi: hisob hali yo'q — tanlov eslab qolinadi va kirgach hisobga yoziladi */
export function applyLocaleBeforeLogin(next: Locale) {
  try {
    sessionStorage.setItem(PICKED_KEY, next);
  } catch {
    // maxfiy rejim — til baribir almashadi, faqat hisobga yozilmaydi
  }
  applyLocale(next);
}

function takePickedLocale(): Locale | null {
  try {
    const value = sessionStorage.getItem(PICKED_KEY) ?? undefined;
    sessionStorage.removeItem(PICKED_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Hisob yuklangach sahifa tilini hisobdagi tilga keltiradi.
 *
 * - Hisobda til bor va sahifa boshqa tilda — cookie to'g'rilanib, sahifa bir
 *   marta qayta yuklanadi.
 * - Hisobda til yo'q (eski hisob) — hozirgi til hisobga yozib qo'yiladi.
 * - Kirish sahifasida hozirgina til tanlangan bo'lsa — o'sha tanlov hisobga yoziladi.
 * - `guest` («Profilga kirish» orqali ochilgan tab) — hech narsa qilinmaydi:
 *   mehmon panelni o'z tilida ko'radi, egasining tili o'zgarmaydi.
 */
export function useAccountLocaleSync({
  loaded,
  accountLocale,
  guest,
  save,
}: {
  loaded: boolean;
  accountLocale: string | null | undefined;
  guest: boolean;
  save: (locale: Locale) => Promise<unknown>;
}) {
  const current = useLocale() as Locale;
  const saveRef = useRef(save);
  saveRef.current = save;
  const savedRef = useRef(false);

  useEffect(() => {
    if (!loaded || guest) return;
    const picked = takePickedLocale();
    const account = isLocale(accountLocale ?? undefined) ? (accountLocale as Locale) : null;

    if (picked && picked === current) {
      if (picked !== account) saveRef.current(picked).catch(() => undefined);
      savedRef.current = true;
      return;
    }
    if (!account) {
      if (savedRef.current) return;
      savedRef.current = true;
      saveRef.current(current).catch(() => undefined);
      return;
    }
    // Hozirgina saqlangan bo'lsa, keshdagi eski qiymat sahifani ortga qaytarmasin
    if (savedRef.current) return;
    // Cookie yozilmasa (brauzer taqiqlagan) qayta yuklash cheksiz aylanib qolardi
    if (account !== current && writeLocaleCookie(account)) window.location.reload();
  }, [loaded, accountLocale, guest, current]);
}
