"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Yashirilgan summalar. Har bir ko'rsatkich kartochkasi alohida yopiladi va
 * tanlov brauzerda saqlanadi — tizimdan chiqib qayta kirilsa ham yopiq
 * qolaveradi (chiqish faqat so'rovlar keshini tozalaydi, localStorage'ga
 * tegmaydi).
 *
 * Kalit foydalanuvchi id'siga bog'langan: bitta kompyuterdan ikki kishi
 * kirsa, biri yopgan summa ikkinchisida ochiq qolishi kerak.
 *
 * Boshlang'ich holat har doim bo'sh: server HTML'i ham shunday chiziladi,
 * saqlangan qiymat esa birinchi renderdan keyin qo'llanadi. Kartochkalar
 * ma'lumot kelgandan keyingina chiziladi, shuning uchun summa bir zumga
 * ochilib ketmaydi.
 */
export function useHiddenAmounts(userId: string | undefined): {
  isHidden: (id: string) => boolean;
  toggle: (id: string) => void;
} {
  const [hidden, setHidden] = useState<string[]>([]);

  const storageKey = userId ? `bogcha:hidden-amounts:${userId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setHidden(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      // Shaxsiy rejimda localStorage yopiq yoki yozuv buzilgan bo'lishi mumkin
      setHidden([]);
    }
  }, [storageKey]);

  const toggle = useCallback(
    (id: string) => {
      setHidden((current) => {
        const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
        if (storageKey) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // saqlab bo'lmasa ham tanlov shu seans davomida ishlaydi
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  const isHidden = useCallback((id: string) => hidden.includes(id), [hidden]);

  return { isHidden, toggle };
}
