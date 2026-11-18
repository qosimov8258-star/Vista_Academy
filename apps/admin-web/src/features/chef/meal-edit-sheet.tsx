"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { MenuMeal, MenuPhoto } from "@/lib/types";
import { prepareMenuPhoto } from "@/lib/menu-photo";
import { getTenantAccessToken } from "@/lib/tenant-session";
import { FieldRow, TextArea } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { MAX_PHOTOS_PER_MEAL, menuPhotoSrc, menuPhotosKey } from "@/features/nutrition/use-menu-photos";
import { usePhotoPicker } from "./photo-picker";
import { useTr } from "@/i18n/tr";

export const MENU_FIELD: Record<MenuMeal, "breakfast" | "lunch" | "snack"> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  SNACK: "snack",
};

const PLACEHOLDER: Record<MenuMeal, string> = {
  BREAKFAST: "Sutli botqa, non, choy",
  LUNCH: "Sho'rva, osh, salat",
  SNACK: "Meva, kefir",
};

/** Bugun bo'sh bo'lgan qism uchun oldingi kundan olinadigan matn va rasmlar */
export interface CarriedMeal {
  /** «Kechagi menyu» yoki «16-noyabr menyusi» */
  label: string;
  /** Bugun matn yozilmagan bo'lsa — oldingi kunniki */
  text: string | null;
  /** Bugun rasm yo'q bo'lsa — oldingi kunniki (nusxa olinadi, asli tegilmaydi) */
  photos: MenuPhoto[];
}

export interface MealEditTarget {
  meal: MenuMeal;
  label: string;
  todayText: string | null;
  todayPhotos: MenuPhoto[];
  carried: CarriedMeal | null;
}

/** Oynadagi bitta rasm: bugungisi, oldingi kundan (saqlanganda nusxa olinadi) yoki yangi tanlangan */
type EditPhoto =
  | { key: string; kind: "today"; id: string }
  | { key: string; kind: "carried"; id: string }
  | { key: string; kind: "new"; dataUrl: string };

/** Oldingi kun rasmini bugunga nusxalash uchun — serverdagi rasmni o'qib, qayta yuklashga tayyorlaydi */
async function copyPhoto(id: string): Promise<string | null> {
  const token = getTenantAccessToken();
  const res = await fetch(menuPhotoSrc(id), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) return null;
  const blob = await res.blob();
  const prepared = await prepareMenuPhoto(new File([blob], "menu-photo", { type: blob.type || "image/jpeg" }));
  return prepared.ok ? prepared.image : null;
}

/**
 * Bitta ovqatni tahrirlash (oshpaz): rasmlar (olib tashlash, kamera,
 * galereya — 4 tagacha) va taomlar matni. Hammasi BUGUNGI sanaga yoziladi.
 * Bugun bo'sh bo'lsa oyna oldingi kunning matni va rasmlari bilan ochiladi —
 * «Saqlash» ularni bugunga ko'chiradi (rasmlardan nusxa olinadi), oldingi
 * kunning o'zi o'zgarmaydi. Ota-onalar bugungi menyuni shundan keyin ko'radi.
 */
export function MealEditSheet({
  slug,
  branchId,
  date,
  target,
  onClose,
}: {
  slug: string;
  branchId: string;
  date: string;
  target: MealEditTarget | null;
  onClose: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const picker = usePhotoPicker();
  const [text, setText] = useState("");
  const [items, setItems] = useState<EditPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Yopilish animatsiyasida ichi bo'shab qolmasin — oxirgi ko'rsatilgani saqlanadi
  const [shown, setShown] = useState<MealEditTarget | null>(target);

  // Faqat ochilganda to'ldiriladi: sahifa ma'lumoti fonda yangilansa (har daqiqada),
  // yozilayotgan matn va tanlangan rasmlar qayta tiklanib ketmasin
  const openMeal = target?.meal ?? null;
  useEffect(() => {
    if (!target) return;
    setShown(target);
    setText(target.todayText ?? target.carried?.text ?? "");
    setItems(
      target.todayPhotos.length > 0
        ? target.todayPhotos.map((p) => ({ key: p.id, kind: "today" as const, id: p.id }))
        : (target.carried?.photos ?? []).map((p) => ({ key: p.id, kind: "carried" as const, id: p.id })),
    );
    setError(null);
    setSaving(false);
    setPreparing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMeal]);

  const add = async (file: File) => {
    setError(null);
    setPreparing(true);
    try {
      const prepared = await prepareMenuPhoto(file);
      if (!prepared.ok) {
        setError(prepared.reason);
        return;
      }
      setItems((list) => (list.length >= MAX_PHOTOS_PER_MEAL ? list : [...list, { key: `new-${Date.now()}`, kind: "new", dataUrl: prepared.image }]));
    } finally {
      setPreparing(false);
    }
  };

  const save = async () => {
    if (!shown) return;
    setSaving(true);
    setError(null);
    try {
      // 1) Olib tashlangan bugungi rasmlar
      const keptToday = new Set(items.flatMap((i) => (i.kind === "today" ? [i.id] : [])));
      for (const photo of shown.todayPhotos) {
        if (!keptToday.has(photo.id)) await api.delete(`/app/menu/photos/${photo.id}`);
      }
      // 2) Oldingi kundan qolganlari (nusxa) va yangilari — ko'rsatilgan tartibda
      for (const item of items) {
        if (item.kind === "today") continue;
        const image = item.kind === "new" ? item.dataUrl : await copyPhoto(item.id);
        if (!image) throw new Error(tr("Kechagi rasmni olib bo'lmadi"));
        await api.post("/app/menu/photos", { date, meal: shown.meal, image });
      }
      // 3) Matn — faqat shu ovqatning maydoni (qolgan ikkitasiga tegilmaydi)
      const next = text.trim();
      if (next !== (shown.todayText ?? "")) {
        await api.post("/app/menu", { date, [MENU_FIELD[shown.meal]]: next });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    } finally {
      setSaving(false);
      // Qisman saqlangan bo'lsa ham kartalar haqiqiy holatni ko'rsatsin
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["menu", slug] }),
        queryClient.invalidateQueries({ queryKey: menuPhotosKey(slug, branchId, date) }),
      ]);
    }
  };

  const busy = saving || preparing;
  const full = items.length >= MAX_PHOTOS_PER_MEAL;

  return (
    <IosSheet
      open={target !== null}
      onClose={() => !saving && onClose()}
      cancelLabel="Bekor qilish"
      title={shown ? tr(shown.label) : ""}
      footer={
        <SheetPrimaryButton onClick={() => void save()} loading={saving} dim={preparing}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      {shown?.carried && (
        <p className="rounded-[14px] bg-[#ff9500]/[0.1] px-4 py-3 text-[13.5px] leading-snug text-[#b25f00]">
          {tr("{0}. «Saqlash» bosilsa — bugungi menyu bo'ladi va ota-onalarga ko'rinadi.", shown.carried.label)}
        </p>
      )}

      <SheetSection title={tr("Rasmlar")} footer={tr("{0} tagacha rasm", MAX_PHOTOS_PER_MEAL)}>
        <div className="grid grid-cols-3 gap-2 p-3">
          {items.map((item) => (
            <div key={item.key} className="relative aspect-square overflow-hidden rounded-[14px] bg-[#767680]/[0.12]">
              {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan yoki data manzil */}
              <img src={item.kind === "new" ? item.dataUrl : menuPhotoSrc(item.id)} alt={shown ? tr(shown.label) : ""} className="h-full w-full object-cover" />
              <button
                type="button"
                disabled={busy}
                onClick={() => setItems((list) => list.filter((x) => x.key !== item.key))}
                aria-label={tr("Olib tashlash")}
                className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5 disabled:opacity-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                  <X className="h-4 w-4" strokeWidth={2.6} />
                </span>
              </button>
            </div>
          ))}
          {!full && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => picker.openCamera((file) => void add(file))}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] bg-[#767680]/[0.12] text-[13px] font-semibold text-[var(--color-primary)] transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                {preparing ? <Spinner className="h-5 w-5 text-[#8e8e93]" /> : <Camera className="h-6 w-6" strokeWidth={2} />}
                {tr("Kamera")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => picker.openGallery((file) => void add(file))}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] bg-[#767680]/[0.12] text-[13px] font-semibold text-[var(--color-primary)] transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                <ImagePlus className="h-6 w-6" strokeWidth={2} />
                {tr("Galereya")}
              </button>
            </>
          )}
        </div>
        {picker.ui}
      </SheetSection>

      <SheetSection>
        <FieldRow label={tr("Taomlar")} htmlFor="meal-edit-text" stacked>
          <TextArea
            id="meal-edit-text"
            rows={3}
            value={text}
            disabled={saving}
            onChange={(e) => setText(e.target.value)}
            placeholder={shown ? tr(PLACEHOLDER[shown.meal]) : undefined}
          />
        </FieldRow>
      </SheetSection>

      {error && (
        <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[13.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </p>
      )}
    </IosSheet>
  );
}
