"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isThemeKey, type ThemeKey } from "./theme-config";

export { THEMES, type ThemeKey } from "./theme-config";

function apply(theme: ThemeKey) {
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function useTheme(): [ThemeKey, (theme: ThemeKey) => void] {
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeKey(saved)) setThemeState(saved);
    } catch {
      // Shaxsiy rejimda localStorage yopiq — sukut rangi qoladi
    }
  }, []);

  const setTheme = useCallback((next: ThemeKey) => {
    setThemeState(next);
    apply(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // yuqoridagi kabi — rang shu sahifada qo'llanadi, lekin saqlanmaydi
    }
  }, []);

  return [theme, setTheme];
}
