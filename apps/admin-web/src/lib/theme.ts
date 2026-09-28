"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./use-auth";
import type { TenantAuthenticatedUser } from "./types";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isThemeKey, type ThemeKey } from "./theme-config";

export { THEMES, type ThemeKey } from "./theme-config";

/**
 * Rangni sahifaga qo'yadi va brauzerga ham yozadi. Brauzerdagi nusxa faqat
 * keyingi ochilishda birinchi chizishdan oldin qo'llash uchun (sahifa
 * yashil bo'lib "sakramasin") — asl manba foydalanuvchi hisobi.
 */
function applyTheme(theme: ThemeKey) {
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Shaxsiy rejimda localStorage yopiq — rang baribir hisobdan keladi
  }
}

/**
 * Tizim rangi — foydalanuvchi hisobida saqlanadi, shuning uchun istalgan
 * qurilmada bir xil. Hisob yuklanishi bilan uning rangi qo'llanadi;
 * tanlanganda darhol qo'llanib, serverga yoziladi (xato bo'lsa — qaytadi).
 */
export function useTheme(): {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => Promise<void>;
  saving: boolean;
  error: string | null;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hisob hali yuklanmagan bo'lsa — brauzerdagi oxirgi rang ko'rsatiladi
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeKey(saved)) setThemeState(saved);
    } catch {
      // yuqoridagi kabi
    }
  }, []);

  // Hisobdagi rang asosiy: boshqa qurilmada tanlangan bo'lsa ham shu yerda qo'llanadi
  const accountTheme = user ? (isThemeKey(user.themeColor) ? user.themeColor : DEFAULT_THEME) : null;
  useEffect(() => {
    if (!accountTheme) return;
    setThemeState(accountTheme);
    applyTheme(accountTheme);
  }, [accountTheme]);

  const setTheme = useCallback(
    async (next: ThemeKey) => {
      const previous = theme;
      setError(null);
      setThemeState(next);
      applyTheme(next);
      const setCached = (value: string | null) =>
        queryClient.setQueryData<{ user: TenantAuthenticatedUser }>(["auth", "me"], (old) =>
          old ? { ...old, user: { ...old.user, themeColor: value } } : old,
        );
      setCached(next);
      setSaving(true);
      try {
        await api.put("/app/profile/theme", { themeColor: next });
      } catch {
        // Saqlanmadi — oldingi rangga qaytamiz, aks holda boshqa qurilmada boshqacha bo'lib qoladi
        setThemeState(previous);
        applyTheme(previous);
        setCached(previous);
        setError("Rangni saqlab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.");
      } finally {
        setSaving(false);
      }
    },
    [theme, queryClient],
  );

  return { theme, setTheme, saving, error };
}

/**
 * Panel ochilganda hisobdagi rangni qo'llaydi — foydalanuvchi Sozlamalarga
 * kirmasa ham (masalan telefonda birinchi marta kirganda) rang to'g'ri bo'ladi.
 */
export function ThemeSync() {
  useTheme();
  return null;
}
