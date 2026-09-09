"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// Sign-in muvaffaqiyatli bo'lgandan so'ng, dashboard boshlang'ich
// ma'lumotlari tayyor bo'lgunicha LoadingScreen'ni ko'rsatib turish uchun
// global holat. Foydalanish: login-form.tsx `startPostLoginLoading()` ni
// chaqiradi, dashboard sahifasi esa boshlang'ich so'rovi tugagach
// `stopPostLoginLoading()` ni chaqiradi.

// Dashboard sahifasi biror sababdan hech qachon mount bo'lmasa (masalan
// navigatsiya to'xtab qolsa), ekran abadiy osilib qolmasligi uchun
// xavfsizlik chegarasi.
const SAFETY_TIMEOUT_MS = 10_000;

interface PostLoginLoadingContextValue {
  isPostLoginLoading: boolean;
  startPostLoginLoading: () => void;
  stopPostLoginLoading: () => void;
}

const PostLoginLoadingContext = createContext<PostLoginLoadingContextValue | null>(null);

export function PostLoginLoadingProvider({ children }: { children: ReactNode }) {
  const [isPostLoginLoading, setIsPostLoginLoading] = useState(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPostLoginLoading = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    setIsPostLoginLoading(false);
  }, []);

  const startPostLoginLoading = useCallback(() => {
    setIsPostLoginLoading(true);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(stopPostLoginLoading, SAFETY_TIMEOUT_MS);
  }, [stopPostLoginLoading]);

  return (
    <PostLoginLoadingContext.Provider
      value={{ isPostLoginLoading, startPostLoginLoading, stopPostLoginLoading }}
    >
      {children}
    </PostLoginLoadingContext.Provider>
  );
}

export function usePostLoginLoading() {
  const ctx = useContext(PostLoginLoadingContext);
  if (!ctx) {
    throw new Error("usePostLoginLoading faqat PostLoginLoadingProvider ichida ishlatilishi kerak");
  }
  return ctx;
}
