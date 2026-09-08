"use client";

import { useEffect, useState } from "react";

/**
 * Qiymatni kechiktirib qaytaradi. Qidiruv maydonida har bir harf uchun
 * so'rov yuborilmasligi uchun ishlatiladi — foydalanuvchi yozishni
 * to'xtatganidan keyingina so'rov ketadi.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
