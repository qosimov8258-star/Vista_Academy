"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MenuMeal, MenuPhoto } from "@/lib/types";
import { prepareMenuPhoto } from "@/lib/menu-photo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Bitta ovqatga bir kunda yuklanadigan suratlar soni (server ham tekshiradi) */
export const MAX_PHOTOS_PER_MEAL = 4;

export const MEALS: { meal: MenuMeal; label: string; short: string }[] = [
  { meal: "BREAKFAST", label: "Nonushta", short: "Nonushta" },
  { meal: "LUNCH", label: "Tushlik", short: "Tushlik" },
  { meal: "SNACK", label: "Kechki ovqat / gazak", short: "Kechki" },
];

export const menuPhotoSrc = (id: string) => `${API_URL}/app/menu/photos/${id}/image`;

export const menuPhotosKey = (slug: string, branchId: string, date: string) => ["menu-photos", slug, branchId, date];

/**
 * Kunning taom suratlari: ro'yxat, yuklash va o'chirish. Oshpaz sahifasidagi
 * kartalar, pastki paneldagi kamera tugmasi va ovqatlanish sahifasi bir xil
 * keshdan foydalanadi — biri yuklasa, qolganlari darhol yangilanadi.
 */
export function useMenuPhotos(slug: string, branchId: string, date: string) {
  const queryClient = useQueryClient();
  const queryKey = menuPhotosKey(slug, branchId, date);
  const query = useQuery({
    queryKey,
    queryFn: () => api.get<MenuPhoto[]>(`/app/menu/photos?branchId=${branchId}&date=${date}`),
    enabled: !!branchId,
  });
  const photos = query.data ?? [];

  // Qaysi ovqatga hozir surat yuklanyapti va oxirgi xato — ovqat bo'yicha
  const [uploading, setUploading] = useState<MenuMeal | null>(null);
  const [errors, setErrors] = useState<Partial<Record<MenuMeal, string>>>({});

  const upload = useCallback(
    async (meal: MenuMeal, file: File): Promise<boolean> => {
      setErrors((e) => ({ ...e, [meal]: undefined }));
      setUploading(meal);
      try {
        const prepared = await prepareMenuPhoto(file);
        if (!prepared.ok) {
          setErrors((e) => ({ ...e, [meal]: prepared.reason }));
          return false;
        }
        await api.post("/app/menu/photos", { date, meal, image: prepared.image });
        await queryClient.invalidateQueries({ queryKey });
        return true;
      } catch (err) {
        setErrors((e) => ({ ...e, [meal]: (err as Error).message }));
        return false;
      } finally {
        setUploading(null);
      }
    },
    // queryKey har renderda yangi massiv — uning tarkibi (slug, branchId, date) yetarli
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, queryClient, slug, branchId],
  );

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/app/menu/photos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    query,
    photos,
    photosOf: (meal: MenuMeal) => photos.filter((p) => p.meal === meal),
    upload,
    uploading,
    errors,
    remove,
  };
}
