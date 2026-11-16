"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { TenantAuthenticatedUser } from "./types";

export function useAuth() {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<{ user: TenantAuthenticatedUser }>("/app/auth/me"),
    retry: false,
    // Platforma funksiyani o'chirsa/yoqsa — panel bir daqiqada sezadi
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    user: query.data?.user ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/**
 * Platforma o'chirgan funksiyalar. `ready` — `me` yuklanganmi: yuklanmaguncha
 * `isOn` hammasini yoqilgan deb qaytaradi, shuning uchun bo'limni ko'rsatish
 * yoki so'rov yuborishdan oldin `ready` ham tekshirilsin.
 */
export function useFeatureFlags() {
  const { user } = useAuth();
  const disabled = user?.disabledFeatures ?? [];
  return {
    ready: !!user,
    isOn: (key: string) => !disabled.includes(key),
  };
}

/**
 * Platforma shu panel uchun funksiyani o'chirganmi. `me` hali yuklanmagan
 * bo'lsa hammasi yoqilgan hisoblanadi (API baribir to'sadi) — buni bilish
 * kerak bo'lsa `useFeatureFlags().ready`.
 */
export function useFeatureEnabled() {
  return useFeatureFlags().isOn;
}
