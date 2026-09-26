"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MenuEntry, MenuMeal } from "@/lib/types";
import { CameraIcon, CheckIcon, ChevronRightIcon } from "@/components/ui/icons";
import { MAX_PHOTOS_PER_MEAL, MEALS, useMenuPhotos } from "@/features/nutrition/use-menu-photos";
import { MEAL_LOOK } from "./meal-card";
import styles from "./chef.module.css";

const MENU_FIELD: Record<MenuMeal, "breakfast" | "lunch" | "snack"> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  SNACK: "snack",
};

/**
 * Pastki paneldagi kamera tugmasi ochadigan oyna: "qaysi ovqatni suratga
 * olasiz?" — ovqat tanlanishi bilan telefon kamerasi ochiladi, surat
 * yuklangach oyna o'zi yopiladi. Oshpazning kundagi asosiy ishi bir
 * bosishda bajarilsin.
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
  const menuQuery = useQuery({
    queryKey: ["menu", slug, branchId, date, "chef-home"],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${date}&to=${date}`),
    enabled: open && !!branchId,
  });
  const menu = menuQuery.data?.find((e) => e.date.slice(0, 10) === date) ?? null;

  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<MenuMeal | null>(null);
  const [done, setDone] = useState<MenuMeal | null>(null);

  useEffect(() => {
    if (!open) {
      setDone(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const pick = (meal: MenuMeal) => {
    setTarget(meal);
    setDone(null);
    inputRef.current?.click();
  };

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Taomni suratga olish">
      <div className={clsx("absolute inset-0 bg-black/40", styles.backdrop)} onClick={onClose} aria-hidden />
      <div
        className={clsx("absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[var(--color-surface)] px-4 pt-2.5 shadow-[var(--shadow-modal)]", styles.sheet)}
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
            const dishes = menu?.[MENU_FIELD[meal]];
            return (
              <li key={meal}>
                <button
                  type="button"
                  disabled={full || !!uploading}
                  onClick={() => pick(meal)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[20px] border p-3 text-left transition-colors",
                    done === meal ? "border-emerald-300 bg-emerald-50" : "border-[var(--color-separator)] active:bg-[var(--color-surface-sunken)]",
                    (full || (uploading && !busy)) && "opacity-50",
                  )}
                >
                  <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", look.tint, look.ink)}>
                    <look.Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold text-[var(--color-text)]">{label}</span>
                    <span className="block truncate text-[13px] text-[var(--color-text-muted)]">
                      {busy
                        ? "Yuklanmoqda…"
                        : done === meal
                          ? "Yuklandi — ota-onalar ko'rmoqda"
                          : full
                            ? `To'ldi (${count}/${MAX_PHOTOS_PER_MEAL})`
                            : (dishes ?? (count > 0 ? `${count} ta rasm bor` : "Hali rasm yo'q"))}
                    </span>
                    {errors[meal] && <span className="mt-0.5 block text-[12.5px] text-[var(--color-danger)]">{errors[meal]}</span>}
                  </span>
                  {busy ? (
                    <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-orange-200 border-t-orange-600" aria-hidden />
                  ) : done === meal ? (
                    <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white", styles.doneIn)}>
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  ) : full ? (
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                      <CameraIcon className="h-[18px] w-[18px]" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-2xl bg-[var(--color-surface-sunken)] text-[15px] font-semibold text-[var(--color-text)] active:bg-black/[0.06]"
        >
          Yopish
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !target) return;
            const ok = await upload(target, file);
            if (ok) {
              setDone(target);
              // Yashil tasdiqni ko'rsatib, oyna o'zi yopiladi
              window.setTimeout(onClose, 1100);
            }
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
