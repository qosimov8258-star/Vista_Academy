"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bogcha:sidebar-sections";

type SectionState = Record<string, boolean>;

/**
 * Yon paneldagi ochiladigan bo'limlar holati. Faqat foydalanuvchi o'zi
 * bosgan bo'limlar shu yerda saqlanadi — joriy sahifa turgan bo'lim
 * baribir ochiq ko'rsatiladi (qarang: Sidebar).
 *
 * Boshlang'ich qiymat har doim bo'sh: server HTML'i ham shunday chiziladi,
 * saqlangan holat esa birinchi renderdan keyin qo'llanadi. Aks holda server
 * va brauzer HTML'i mos kelmay, hidratsiya xatosi chiqadi.
 */
export function useSidebarSections(): [SectionState, (id: string) => void] {
  const [openSections, setOpenSections] = useState<SectionState>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setOpenSections(JSON.parse(raw) as SectionState);
      }
    } catch {
      // Shaxsiy rejimda localStorage yopiq yoki yozuv buzilgan bo'lishi mumkin
    }
  }, []);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // saqlab bo'lmasa ham holat shu seans davomida ishlaydi
      }
      return next;
    });
  }, []);

  return [openSections, toggleSection];
}
