"use client";

import { useQuery } from "@tanstack/react-query";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";

/**
 * Platforma ota-onalar paneli uchun o'chirgan funksiyalar. `/app/parent/me`
 * bilan bir xil keshdan o'qiladi — qo'shimcha so'rov ketmaydi. `me` hali
 * yuklanmagan bo'lsa `ready: false`: bo'limni yashirish/so'rov yuborishni
 * shunga qarab kechiktiring.
 */
export function useParentFeatures(slug: string) {
  const me = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
    // Platforma bo'limni o'chirsa/yoqsa — kabinet bir daqiqada sezadi
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const disabled = me.data?.parent.disabledFeatures ?? [];
  return {
    ready: !!me.data,
    /** `me` olinmadi (seans tugagan, kabinet o'chirilgan) — xato, aks holda null */
    error: me.error,
    isOn: (key: string | undefined) => !key || !disabled.includes(key),
  };
}
