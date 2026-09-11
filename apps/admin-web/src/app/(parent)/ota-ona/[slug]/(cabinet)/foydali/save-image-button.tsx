"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon } from "@/components/ui/icons";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import styles from "../../parent.module.css";
import { saveImages } from "./share-image";

/**
 * Bog'cha nomi — rasm pastiga yoziladi. Kabinet qobig'i bilan bir xil so'rov
 * (bir xil kalit), shuning uchun qayta yuklanmaydi.
 */
export function useKindergartenName(slug: string): string | null {
  const query = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  return query.data?.parent.organizationName ?? null;
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5v11" />
      <path d="m7.5 10 4.5 4.5 4.5-4.5" />
      <path d="M4 16.5v1.8A2.2 2.2 0 0 0 6.2 20.5h11.6a2.2 2.2 0 0 0 2.2-2.2v-1.8" />
    </svg>
  );
}

interface Preview {
  file: File;
  url: string;
}

/**
 * "Rasm qilib saqlash": rasm tayyorlanadi va avval oldindan ko'rsatiladi —
 * ota-ona nima saqlanishini ko'radi, keyin "Galereyaga saqlash"ni bosadi.
 * Ulashish oynasi faqat shu ikkinchi bosishda ochiladi: telefonlar uni
 * bevosita foydalanuvchi bosishidan so'ng ochishga ruxsat beradi.
 */
export function SaveImageButton({
  label,
  build,
  shareTitle,
  shareText,
}: {
  label: string;
  build: () => Promise<File[]>;
  shareTitle: string;
  shareText: string;
}) {
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Preview[] | null>(null);
  const urls = useRef<string[]>([]);

  const release = useCallback(() => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current = [];
  }, []);
  useEffect(() => release, [release]);

  const open = async () => {
    if (building) return;
    setBuilding(true);
    setError(null);
    try {
      const files = await build();
      release();
      const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
      urls.current = next.map((preview) => preview.url);
      setPreviews(next);
    } catch {
      setError("Rasmni tayyorlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setBuilding(false);
    }
  };

  const close = useCallback(() => {
    setPreviews(null);
    release();
  }, [release]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={building}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-[var(--p-line)] bg-[var(--p-card)] py-3.5 text-[15px] font-bold text-[var(--p-ink)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
      >
        {building ? (
          <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-[var(--p-coral)] border-t-transparent" />
        ) : (
          <DownloadIcon className="h-5 w-5 text-[var(--p-coral)]" />
        )}
        {building ? "Rasm tayyorlanmoqda…" : label}
      </button>
      {error && <p className="mt-2 text-center text-[13px] font-medium text-[var(--p-coral)]">{error}</p>}
      {previews && <ImageSheet previews={previews} onClose={close} shareTitle={shareTitle} shareText={shareText} />}
    </>
  );
}

function ImageSheet({
  previews,
  onClose,
  shareTitle,
  shareText,
}: {
  previews: Preview[];
  onClose: () => void;
  shareTitle: string;
  shareText: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "downloaded">("idle");
  const saveRef = useRef<HTMLButtonElement>(null);
  const many = previews.length > 1;

  useEffect(() => {
    // Oyna ochiqligida orqa sahifa aylanmasin; Escape — yopish
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    saveRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const save = async () => {
    setStatus("saving");
    const result = await saveImages(
      previews.map((preview) => preview.file),
      shareTitle,
      shareText,
    );
    if (result === "shared") onClose();
    else setStatus(result === "downloaded" ? "downloaded" : "idle");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Rasmni saqlash">
      <button type="button" aria-label="Yopish" onClick={onClose} className={`${styles.fadeIn} absolute inset-0 cursor-default bg-black/45`} />
      <div
        className={`${styles.sheetIn} relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[30px] bg-[var(--p-card)] px-5 pt-3 shadow-[var(--p-shadow)]`}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-full bg-[var(--p-muted)]/30" />
        <p className={`${styles.roundedFont} mt-3 text-[20px] font-extrabold text-[var(--p-ink)]`}>Rasm tayyor</p>
        <p className="mt-0.5 text-[13.5px] text-[var(--p-muted)]">
          {many ? `${previews.length} ta sahifa — hammasi birga saqlanadi` : "Pastki chekkada bog'changiz nomi"}
        </p>

        <div className={clsx("mt-4 flex gap-3", many && "snap-x snap-mandatory overflow-x-auto pb-2")}>
          {previews.map((preview, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- mahalliy blob, optimallashtirish kerak emas
            <img
              key={preview.url}
              src={preview.url}
              alt={many ? `${i + 1}-sahifa` : "Saqlanadigan rasm"}
              className={clsx(
                "rounded-[18px] border border-[var(--p-line)] shadow-[var(--p-shadow)]",
                many ? "w-[62%] shrink-0 snap-center" : "mx-auto max-h-[56dvh] w-auto max-w-full",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-[12.5px] text-[var(--p-muted)]">
          Rasmni bosib turib ham saqlashingiz mumkin
        </p>

        <button
          ref={saveRef}
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--p-coral)] py-4 text-[16px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(255,122,102,0.9)] transition-transform active:scale-[0.98] disabled:opacity-70"
        >
          {status === "downloaded" ? <CheckIcon className="h-5 w-5" /> : <DownloadIcon className="h-5 w-5" />}
          {status === "downloaded" ? "Yuklab olindi" : status === "saving" ? "Saqlanmoqda…" : "Galereyaga saqlash"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-1.5 w-full cursor-pointer rounded-full py-3 text-[15px] font-bold text-[var(--p-muted)] transition-colors active:bg-[var(--p-sunken)]"
        >
          Yopish
        </button>
      </div>
    </div>
  );
}
