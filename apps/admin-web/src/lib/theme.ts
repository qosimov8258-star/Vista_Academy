"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./use-auth";
import type { TenantAuthenticatedUser } from "./types";
import {
  CUSTOM_THEME_VARS,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEME_VARS_STORAGE_KEY,
  customThemeVars,
  isCustomColor,
  isThemeValue,
  type ThemeValue,
} from "./theme-config";

export { THEMES, isCustomColor, type ThemeKey, type ThemeValue } from "./theme-config";

/**
 * Rangni sahifaga qo'yadi va brauzerga ham yozadi. Brauzerdagi nusxa faqat
 * keyingi ochilishda birinchi chizishdan oldin qo'llash uchun (sahifa
 * yashil bo'lib "sakramasin") — asl manba foydalanuvchi hisobi.
 */
export function applyTheme(theme: ThemeValue) {
  const root = document.documentElement;
  // Oldingi o'z rangining o'zgaruvchilari tozalanadi — tayyor to'plam ularni bosib ketmasin
  CUSTOM_THEME_VARS.forEach((name) => root.style.removeProperty(name));
  let vars: Record<string, string> | null = null;
  if (isCustomColor(theme)) {
    vars = customThemeVars(theme);
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
    root.dataset.theme = "custom";
  } else if (theme === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (vars) window.localStorage.setItem(THEME_VARS_STORAGE_KEY, JSON.stringify(vars));
    else window.localStorage.removeItem(THEME_VARS_STORAGE_KEY);
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
  theme: ThemeValue;
  setTheme: (theme: ThemeValue) => Promise<void>;
  saving: boolean;
  error: string | null;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [theme, setThemeState] = useState<ThemeValue>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hisob hali yuklanmagan bo'lsa — brauzerdagi oxirgi rang ko'rsatiladi
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeValue(saved)) setThemeState(saved);
    } catch {
      // yuqoridagi kabi
    }
  }, []);

  // Hisobdagi rang asosiy: boshqa qurilmada tanlangan bo'lsa ham shu yerda qo'llanadi
  const accountTheme = user ? (isThemeValue(user.themeColor) ? user.themeColor : DEFAULT_THEME) : null;
  useEffect(() => {
    if (!accountTheme) return;
    setThemeState(accountTheme);
    applyTheme(accountTheme);
  }, [accountTheme]);

  const setTheme = useCallback(
    async (next: ThemeValue) => {
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
