"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MenuEntry, MenuMeal } from "@/lib/types";
import { CameraIcon, CheckIcon } from "@/components/ui/icons";
import { MAX_PHOTOS_PER_MEAL, MEALS, useMenuPhotos } from "@/features/nutrition/use-menu-photos";
import { MEAL_LOOK } from "./meal-card";
import { usePhotoPicker } from "./photo-picker";
import styles from "./chef.module.css";

const MENU_FIELD: Record<MenuMeal, "breakfast" | "lunch" | "snack"> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  SNACK: "snack",
};

/**
 * Pastki paneldagi kamera tugmasi ochadigan oyna: har bir ovqat qatorida
 * ikkita tugma — "Kamera" (telefonda telefon kamerasi, kompyuterda sahifa
 * ichidagi kamera) va "Galereya" (oldin olingan surat). Yuklangach oyna
 * yopilmaydi — yashil tasdiq chiqadi va oshpaz shu yerdan qolgan ovqatlarni
 * ham suratga olishi mumkin; oynani o'zi yopadi.
 */
export function QuickPhotoSheet({
  open,
  onClose,
  slug,
  branchId,
  date,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string;
  date: string;
}) {
  const { photosOf, upload, uploading, errors } = useMenuPhotos(slug, branchId, date);
  const picker = usePhotoPicker();
  const menuQuery = useQuery({
    queryKey: ["menu", slug, branchId, date, "chef-home"],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${date}&to=${date}`),
    enabled: open && !!branchId,
  });
  const menu = menuQuery.data?.find((e) => e.date.slice(0, 10) === date) ?? null;
  // Shu oyna ochilgandan beri qaysi ovqatlarga surat yuklandi
  const [done, setDone] = useState<MenuMeal[]>([]);

  useEffect(() => {
    if (!open) {
      setDone([]);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const handleFile = (meal: MenuMeal) => async (file: File) => {
    const ok = await upload(meal, file);
    if (ok) setDone((d) => (d.includes(meal) ? d : [...d, meal]));
  };

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Taomni suratga olish">
      <div className={clsx("absolute inset-0 bg-black/40", styles.backdrop)} onClick={onClose} aria-hidden />
      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[var(--color-surface)] px-4 pt-2.5 shadow-[var(--shadow-modal)] md:inset-x-auto md:left-1/2 md:w-[520px] md:-translate-x-1/2",
          styles.sheet,
        )}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-black/15" aria-hidden />
        <h2 className="mt-4 text-[19px] font-semibold text-[var(--color-text)]">Qaysi ovqatni suratga olasiz?</h2>
        <p className="mt-1 text-[13.5px] text-[var(--color-text-muted)]">Surat ota-onalar kabinetida darhol ko&apos;rinadi</p>

        <ul className="mt-4 space-y-2.5">
          {MEALS.map(({ meal, label }) => {
            const look = MEAL_LOOK[meal];
            const count = photosOf(meal).length;
            const full = count >= MAX_PHOTOS_PER_MEAL;
            const busy = uploading === meal;
            const justDone = done.includes(meal) && !busy;
            const dishes = menu?.[MENU_FIELD[meal]];
            return (
              <li
                key={meal}
                className={clsx(
                  "flex items-center gap-3 rounded-[20px] border p-3 transition-colors",
                  justDone ? "border-emerald-300 bg-emerald-50" : "border-[var(--color-separator)]",
                )}
              >
                <span className={clsx("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", look.tint, look.ink)}>
                  <look.Icon className="h-6 w-6" />
                  {justDone && (
                    <span className={clsx("absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white", styles.doneIn)}>
                      <CheckIcon className="h-3 w-3" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-[var(--color-text)]">{label}</span>
                  <span className={clsx("block truncate text-[13px]", justDone ? "font-medium text-emerald-700" : "text-[var(--color-text-muted)]")}>
                    {busy
                      ? "Yuklanmoqda…"
                      : justDone
                        ? `Yuklandi — ota-onalar ko'rmoqda (${count} ta)`
                        : full
                          ? `To'ldi (${count}/${MAX_PHOTOS_PER_MEAL})`
                          : (dishes || (count > 0 ? `${count} ta rasm bor` : "Hali rasm yo'q"))}
                  </span>
                  {errors[meal] && <span className="mt-0.5 block text-[12.5px] text-[var(--color-danger)]">{errors[meal]}</span>}
                </span>
                {busy ? (
                  <span className="mr-2 h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-orange-200 border-t-orange-600" aria-hidden />
                ) : full ? null : (
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={!!uploading}
                      onClick={() => picker.openGallery(handleFile(meal))}
                      aria-label={`${label}: galereyadan tanlash`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] active:bg-black/[0.08] disabled:opacity-40"
                    >
                      <GalleryIcon className="h-[18px] w-[18px]" />
                    </button>
                    <button
                      type="button"
                      disabled={!!uploading}
                      onClick={() => picker.openCamera(handleFile(meal))}
                      aria-label={`${label}: kamera bilan suratga olish`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white active:bg-orange-600 disabled:opacity-40"
                    >
                      <CameraIcon className="h-[18px] w-[18px]" />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-2xl bg-[var(--color-surface-sunken)] text-[15px] font-semibold text-[var(--color-text)] active:bg-black/[0.06]"
        >
          {done.length > 0 ? "Tayyor" : "Yopish"}
        </button>
        {picker.ui}
      </div>
    </div>,
    document.body,
  );
}

/** Galereya belgisi — rasm ramkasi */
export function GalleryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m20.5 15.5-4.8-4.8-9 8.8" />
    </svg>
  );
}
