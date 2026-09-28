"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { menuPhotoSrc } from "@/features/nutrition/use-menu-photos";
import styles from "./chef.module.css";

/**
 * Taom suratini to'liq ekranda ko'rsatadi. Telefonda qora fon ustida,
 * yopish tugmasi bosh barmoq yetadigan joyda. O'chirish ikki bosqichli:
 * birinchi bosishda tasdiq so'raladi — tasodifan o'chib ketmasin.
 */
export function PhotoViewer({
  photoId,
  title,
  onClose,
  onDelete,
  deleting,
}: {
  photoId: string | null;
  title: string;
  onClose: () => void;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setConfirming(false);
    if (!photoId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photoId, onClose]);

  if (!photoId || typeof document === "undefined") return null;

  return createPortal(
    <div className={`fixed inset-0 z-[60] flex flex-col bg-black ${styles.backdrop}`} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="flex items-center justify-between px-4 pb-3 text-white"
        style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}
      >
        <p className="text-[15px] font-semibold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <button type="button" onClick={onClose} className="flex min-h-0 flex-1 items-center justify-center px-3" aria-label="Yopish">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={menuPhotoSrc(photoId)} alt={title} className="max-h-full max-w-full rounded-2xl object-contain" />
      </button>

      {onDelete && (
        <div className="px-4 pt-3" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {confirming ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-12 flex-1 rounded-2xl bg-white/15 text-[15px] font-semibold text-white active:bg-white/25"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(photoId)}
                className="h-12 flex-1 rounded-2xl bg-red-600 text-[15px] font-semibold text-white active:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "O'chirilmoqda…" : "Ha, o'chirish"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-[15px] font-semibold text-red-300 active:bg-white/20"
            >
              <TrashIcon className="h-5 w-5" />
              Suratni o&apos;chirish
            </button>
          )}
          <p className="mt-2 text-center text-[12px] text-white/50">O&apos;chirilsa, ota-onalar kabinetidan ham olib tashlanadi</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
