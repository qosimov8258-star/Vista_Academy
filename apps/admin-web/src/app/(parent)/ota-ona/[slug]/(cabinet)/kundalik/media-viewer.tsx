"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import { DownloadIcon } from "../foydali/save-image-button";
import { saveImages } from "../foydali/share-image";
import { clockOf, fetchMediaFile, mediaUrl, type DiaryMedia } from "./diary";

function ArrowIcon({ className, left }: { className?: string; left?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={left ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

/**
 * Kun lahzalarini to'liq ekranda ko'rish: surish (barmoq yoki strelka),
 * video o'ynatish va galereyaga saqlash. Telefonda "saqlash" ulashish oynasini
 * ochadi — u yerdan rasm/video galereyaga tushadi.
 */
export function MediaViewer({
  items,
  startIndex,
  date,
  onClose,
}: {
  items: DiaryMedia[];
  startIndex: number;
  date: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [saving, setSaving] = useState<"idle" | "saving" | "done" | "error">("idle");
  const touchX = useRef<number | null>(null);
  const current = items[index];
  const many = items.length > 1;

  const go = useCallback(
    (step: number) => {
      setIndex((i) => (i + step + items.length) % items.length);
      setSaving("idle");
    },
    [items.length],
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && many) go(1);
      if (event.key === "ArrowLeft" && many) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, go, many]);

  const save = async () => {
    setSaving("saving");
    try {
      const file = await fetchMediaFile(current, date, index);
      const result = await saveImages([file], "Bog'chadagi kun", current.caption ?? "Kun lahzasi");
      setSaving(result === "cancelled" ? "idle" : "done");
    } catch {
      setSaving("error");
    }
  };

  if (!current) return null;

  return (
    <div
      className={`${styles.fadeIn} fixed inset-0 z-[60] flex flex-col bg-black text-white`}
      role="dialog"
      aria-modal="true"
      aria-label="Kun lahzalari"
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        const end = event.changedTouches[0]?.clientX;
        touchX.current = null;
        if (!many || start === null || end === undefined) return;
        if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-3 pb-2"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-colors active:bg-white/20"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        {many && (
          <span className="text-[14px] font-semibold tabular-nums text-white/80">
            {index + 1} / {items.length}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving === "saving"}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold transition-colors active:bg-white/20 disabled:opacity-60"
        >
          {saving === "done" ? (
            <CheckIcon className="h-[18px] w-[18px]" />
          ) : saving === "saving" ? (
            <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <DownloadIcon className="h-[18px] w-[18px]" />
          )}
          {saving === "done" ? "Saqlandi" : saving === "error" ? "Qayta urinish" : "Saqlash"}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {current.kind === "VIDEO" ? (
          <video
            key={current.id}
            src={mediaUrl(current)}
            poster={current.hasPoster ? mediaUrl(current, "poster") : undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-full max-w-full"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- himoyalangan API fayli, optimallashtirilmaydi
          <img key={current.id} src={mediaUrl(current)} alt={current.caption ?? "Kun lahzasi"} className="max-h-full max-w-full object-contain" />
        )}

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Oldingisi"
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 sm:flex"
            >
              <ArrowIcon left className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Keyingisi"
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 sm:flex"
            >
              <ArrowIcon className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      <div className="px-5 pt-3" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        {current.caption && <p className="text-[15.5px] font-semibold leading-snug">{current.caption}</p>}
        <p className="mt-1 text-[13px] text-white/60">
          {current.createdByName} · {clockOf(current.createdAt)}
        </p>
        {many && (
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
            {items.map((item, i) => (
              <span
                key={item.id}
                className={clsx("h-1.5 rounded-full transition-all duration-300", i === index ? "w-5 bg-white" : "w-1.5 bg-white/35")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
