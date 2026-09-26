"use client";

import { useRef } from "react";
import clsx from "clsx";
import type { MenuMeal, MenuPhoto } from "@/lib/types";
import { CameraIcon, CheckIcon } from "@/components/ui/icons";
import { MAX_PHOTOS_PER_MEAL, menuPhotoSrc } from "@/features/nutrition/use-menu-photos";
import styles from "./chef.module.css";

/** Har bir ovqatning o'z rangi va belgisi — ro'yxatda bir qarashda ajralsin */
export const MEAL_LOOK: Record<MenuMeal, { tint: string; ink: string; Icon: (p: { className?: string }) => React.JSX.Element }> = {
  BREAKFAST: { tint: "bg-amber-100", ink: "text-amber-600", Icon: SunriseIcon },
  LUNCH: { tint: "bg-orange-100", ink: "text-orange-600", Icon: SunIcon },
  SNACK: { tint: "bg-violet-100", ink: "text-violet-600", Icon: MoonIcon },
};

/**
 * Bitta ovqat: nomi, menyudagi taomlar, suratlar tasmasi va kamera.
 * Oshpaz ovqat tayyor bo'lgach shu kartadagi kamerani bosadi — telefon
 * kamerasi to'g'ridan-to'g'ri ochiladi, surat esa darhol ota-onalarga
 * ko'rinadi. Surat yo'q bo'lsa karta buni ochiq aytadi.
 */
export function MealCard({
  meal,
  label,
  dishes,
  photos,
  uploading,
  error,
  onFile,
  onOpenPhoto,
}: {
  meal: MenuMeal;
  label: string;
  dishes: string | null;
  photos: MenuPhoto[];
  uploading: boolean;
  error?: string;
  onFile: (file: File) => void;
  onOpenPhoto: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const look = MEAL_LOOK[meal];
  const full = photos.length >= MAX_PHOTOS_PER_MEAL;
  const shared = photos.length > 0;

  return (
    <article className="rounded-[22px] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-3">
        <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", look.tint, look.ink)}>
          <look.Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold leading-tight text-[var(--color-text)]">{label}</p>
          {shared ? (
            <p className={clsx("mt-0.5 flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-success)]", styles.doneIn)}>
              <CheckIcon className="h-3.5 w-3.5" />
              Ota-onalarga ko&apos;rinmoqda · {photos.length} ta rasm
            </p>
          ) : (
            <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">Hali rasm yuklanmagan</p>
          )}
        </div>
      </header>

      <p className={clsx("mt-3 text-[15px] leading-snug", dishes ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]")}>
        {dishes || "Menyu kiritilmagan"}
      </p>

      <div className={clsx("-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5", styles.strip)}>
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenPhoto(p.id)}
            className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-2xl bg-[var(--color-surface-sunken)] active:opacity-80"
            aria-label={`${label} suratini ochish`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={menuPhotoSrc(p.id)} alt={label} loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
        {!full && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={clsx(
              "flex h-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-[12px] font-semibold transition-colors",
              shared ? "w-[84px]" : "w-full min-w-[84px]",
              uploading
                ? "border-orange-300 bg-orange-50 text-orange-500"
                : "border-orange-200 text-orange-600 active:bg-orange-50",
            )}
          >
            {uploading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" aria-hidden />
                Yuklanmoqda…
              </>
            ) : (
              <>
                <CameraIcon className="h-6 w-6" />
                {shared ? "Yana" : "Rasmga olish"}
              </>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </div>
      {error && <p className="mt-2 text-[13px] text-[var(--color-danger)]">{error}</p>}
    </article>
  );
}

function SunriseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 17a7 7 0 0 1 14 0" />
      <path d="M3 20h18M12 4v3M4.9 9.4l1.6 1.2M19.1 9.4l-1.6 1.2" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
