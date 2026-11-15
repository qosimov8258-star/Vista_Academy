"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { prepareMenuPhoto } from "@/lib/menu-photo";
import { Spinner } from "@/components/ios/spinner";
import { IosIcon } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";

/**
 * Surat tanlagich (varaq ichida, oq blok ichida): bo'sh bo'lsa — katta
 * bosiladigan maydon, tanlangach — ko'rinish va «Boshqa surat» /
 * «Olib tashlash». Surat brauzerda kichraytiriladi (`prepareMenuPhoto`:
 * uzun tomoni 1280px, ~700 KB gacha) va data URL sifatida qaytadi.
 * Telefonda `accept="image/*"` kamera yoki galereyani taklif qiladi.
 */
export function PhotoPicker({
  src,
  loading = false,
  onPicked,
  onRemove,
  aspect = "wide",
  emptyTitle,
  emptyHint,
  error,
  alt,
}: {
  /** Ko'rsatiladigan surat (data URL yoki blob manzil); null — hali yo'q */
  src: string | null;
  /** Mavjud surat serverdan yuklanmoqda */
  loading?: boolean;
  onPicked: (dataUrl: string) => void;
  onRemove?: () => void;
  /** wide — 16:9 muqova (kesib ko'rsatiladi), square — butun surat ko'rinadi */
  aspect?: "wide" | "square";
  emptyTitle: string;
  emptyHint?: string;
  error?: string;
  alt: string;
}) {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setPrepError(null);
    try {
      const result = await prepareMenuPhoto(file);
      if (result.ok) onPicked(result.image);
      else setPrepError(result.reason);
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    if (!busy) input.current?.click();
  };
  const shownError = prepError ?? error;
  const frame = aspect === "wide" ? "aspect-[16/9]" : "aspect-square max-h-[360px]";

  return (
    <div className={clsx("space-y-3 p-3", shownError && "bg-[#ff3b30]/[0.06]")}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {src || loading ? (
        <>
          <div className={clsx("relative mx-auto w-full overflow-hidden rounded-[14px] bg-[#767680]/[0.12]", frame)}>
            {src && (
              // eslint-disable-next-line @next/next/no-img-element -- data/blob manzil
              <img src={src} alt={alt} className={clsx("h-full w-full", aspect === "wide" ? "object-cover" : "object-contain")} />
            )}
            {(busy || (loading && !src)) && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/50">
                <Spinner className="h-6 w-6 text-[#8e8e93]" />
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={open}
              disabled={busy}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#767680]/[0.12] text-[15px] font-semibold text-[var(--color-primary)] transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
              {tr("Boshqa surat")}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#767680]/[0.12] text-[15px] font-semibold text-[#ff3b30] transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                {tr("Olib tashlash")}
              </button>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className={clsx(
            "flex w-full flex-col items-center justify-center gap-2 rounded-[14px] bg-[#767680]/[0.08] px-4 text-center transition-transform active:scale-[0.98]",
            aspect === "wide" ? "aspect-[16/9]" : "min-h-[220px]",
          )}
        >
          {busy ? <Spinner className="h-6 w-6 text-[#8e8e93]" /> : <IosIcon icon={ImagePlus} tint="blue" size={48} />}
          <span className="text-[16px] font-semibold text-[var(--color-text)]">{tr(emptyTitle)}</span>
          {emptyHint && <span className="max-w-[280px] text-[13px] leading-snug text-[#8e8e93]">{tr(emptyHint)}</span>}
        </button>
      )}

      {shownError && (
        <p role="alert" className="px-1 text-[13px] leading-snug text-[#ff3b30]">
          {tr(shownError)}
        </p>
      )}
    </div>
  );
}
