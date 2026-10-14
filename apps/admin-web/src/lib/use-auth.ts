"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { TenantAuthenticatedUser } from "./types";

export function useAuth() {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<{ user: TenantAuthenticatedUser }>("/app/auth/me"),
    retry: false,
  });

  return {
    user: query.data?.user ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/**
 * Platforma shu panel uchun funksiyani o'chirganmi. `me` hali yuklanmagan
 * bo'lsa hammasi yoqilgan hisoblanadi (API baribir to'sadi).
 */
export function useFeatureEnabled() {
  const { user } = useAuth();
  const disabled = user?.disabledFeatures ?? [];
  return (key: string) => !disabled.includes(key);
}
