"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bogcha:sidebar-collapsed";

/**
 * Yon panel yig'ilgan yoki yozilgan holati. Tanlov brauzerda saqlanadi —
 * xodim har safar sahifani ochganda qaytadan yig'ishi shart emas.
 *
 * Boshlang'ich qiymat har doim "yozilgan": server HTML'i ham shunday
 * chiziladi, saqlangan holat esa birinchi renderdan keyin qo'llanadi.
 * Aks holda server va brauzer HTML'i mos kelmay, hidratsiya xatosi chiqadi.
 */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Shaxsiy rejimda localStorage yopiq bo'lishi mumkin — yozilgan holda qolaveradi
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // saqlab bo'lmasa ham holat shu seans davomida ishlaydi
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
