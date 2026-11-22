"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, ImagePlus, Images, X } from "lucide-react";
import { prepareMenuPhoto } from "@/lib/menu-photo";
import { Spinner } from "@/components/ios/spinner";
import { IosIcon } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";

/** Bitta ishga ko'pi bilan nechta surat (API bilan bir xil) */
export const GALLERY_MAX_PHOTOS = 5;

/**
 * Galereyaga 1–5 ta surat tanlash. Guruh katta bo'lsa, bolalar 5 tadan
 * bo'linib suratga olinadi — har bir surat alohida qo'shiladi, ota-onalar
 * hammasini varaqlab ko'radi. Telefonda ikki yo'l: «Suratga olish» (kamera,
 * bittadan) va «Galereyadan» (bir nechtasini birdan); kompyuterda — fayl
 * tanlash. Har surat brauzerda kichraytiriladi (`prepareMenuPhoto`).
 */
export function GalleryPhotosPicker({
  images,
  onAdd,
  onRemove,
  error,
}: {
  images: string[];
  onAdd: (dataUrl: string) => void;
  onRemove: (index: number) => void;
  error?: string;
}) {
  const tr = useTr();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Surat o'qilmadi — xato; 5 tadan oshgani olinmadi — shunchaki izoh
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  // Telefon/planshet — kamera tugmasi alohida chiqadi
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);

  const room = GALLERY_MAX_PHOTOS - images.length;
  const full = room <= 0;

  const pick = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0 || full) return;
    setBusy(true);
    setNote(null);
    try {
      const taken = files.slice(0, room);
      let failed: string | null = null;
      for (const file of taken) {
        const result = await prepareMenuPhoto(file);
        if (result.ok) onAdd(result.image);
        else failed = result.reason;
      }
      if (failed) setNote({ text: failed, error: true });
      else if (files.length > taken.length) setNote({ text: tr("Ko'pi bilan {0} ta surat — ortiqchasi olinmadi", GALLERY_MAX_PHOTOS), error: false });
    } finally {
      setBusy(false);
    }
  };

  const open = (which: "camera" | "gallery") => {
    if (busy || full) return;
    (which === "camera" ? camera : gallery).current?.click();
  };
  const shownError = note?.error ? note.text : error;
  const info = note && !note.error ? note.text : null;

  const sources = touch
    ? [
        { key: "camera" as const, icon: Camera, label: "Suratga olish" },
        { key: "gallery" as const, icon: Images, label: "Galereyadan" },
      ]
    : [{ key: "gallery" as const, icon: ImagePlus, label: "Surat tanlash" }];

  return (
    <div className={clsx("space-y-3 p-3", shownError && "bg-[#ff3b30]/[0.06]")}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length === 0 ? (
        <div className="space-y-3">
          <div className={clsx("grid gap-2.5", sources.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
            {sources.map((source) => (
              <button
                key={source.key}
                type="button"
                onClick={() => open(source.key)}
                disabled={busy}
                className="flex min-h-[150px] flex-col items-center justify-center gap-2.5 rounded-[14px] bg-[#767680]/[0.08] px-3 text-center transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                {busy ? (
                  <Spinner className="h-6 w-6 text-[#8e8e93]" />
                ) : (
                  <IosIcon icon={source.icon} tint={source.key === "camera" ? "blue" : "green"} size={48} />
                )}
                <span className="text-[15.5px] font-semibold text-[var(--color-text)]">{tr(source.label)}</span>
              </button>
            ))}
          </div>
          <p className="px-1 text-center text-[13px] leading-snug text-[#8e8e93]">
            {tr("1 tadan {0} tagacha surat. Guruh katta bo'lsa, bolalarni bo'lib suratga oling — ota-onalar hammasini varaqlab ko'radi.", GALLERY_MAX_PHOTOS)}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              <div key={`${i}-${src.length}`} className="relative aspect-square overflow-hidden rounded-[12px] bg-[#767680]/[0.12]">
                {/* eslint-disable-next-line @next/next/no-img-element -- data manzil */}
                <img src={src} alt={tr("{0}-surat", i + 1)} className="h-full w-full object-cover" />
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/55 px-1.5 text-[12.5px] font-semibold tabular-nums text-white backdrop-blur-sm">
                  {i + 1}
                </span>
                {/* Ko'rinishi 26px, bosiladigan joyi 44px */}
                <button
                  type="button"
                  onClick={() => {
                    setNote(null);
                    onRemove(i);
                  }}
                  disabled={busy}
                  aria-label={tr("{0}-suratni olib tashlash", i + 1)}
                  className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5 disabled:opacity-60"
                >
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                    <X className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </button>
              </div>
            ))}
            {busy && (
              <div className="flex aspect-square items-center justify-center rounded-[12px] bg-[#767680]/[0.08]">
                <Spinner className="h-6 w-6 text-[#8e8e93]" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[13px] text-[#8e8e93]">
              {tr("Birinchisi — muqova")}
            </span>
            <span className={clsx("shrink-0 text-[13px] font-semibold tabular-nums", full ? "text-[#34c759]" : "text-[#8e8e93]")}>
              {images.length}/{GALLERY_MAX_PHOTOS}
            </span>
          </div>

          {!full && (
            <div className="flex gap-2">
              {sources.map((source) => (
                <button
                  key={source.key}
                  type="button"
                  onClick={() => open(source.key)}
                  disabled={busy}
                  className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#767680]/[0.12] px-3 text-[15px] font-semibold text-[var(--color-primary)] transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  <source.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
                  <span className="truncate">{tr(source.label)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {shownError ? (
        <p role="alert" className="px-1 text-[13px] leading-snug text-[#ff3b30]">
          {tr(shownError)}
        </p>
      ) : (
        info && (
          <p role="status" className="px-1 text-[13px] leading-snug text-[#ff9500]">
            {info}
          </p>
        )
      )}
    </div>
  );
}
