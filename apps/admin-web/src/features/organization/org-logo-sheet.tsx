"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, fitToSquarePng } from "@/lib/resize-image";
import { initials } from "@/components/ui/avatar";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { useTr } from "@/i18n/tr";
import { OrgLogo } from "./org-logo";

/** Logo 512x512 PNG da saqlanadi — yon menyu, kirish sahifasi va retina ekranlar uchun yetarli. */
const ORG_LOGO_SIZE = 512;

/** Doira ichidagi logo (yoki bosh harflar) — sheet va Sozlamalar qatori uchun. */
export function OrgLogoBadge({
  slug,
  name,
  updatedAt,
  size,
}: {
  slug: string;
  name: string;
  updatedAt?: string | null;
  size: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <OrgLogo
        slug={slug}
        updatedAt={updatedAt}
        className="h-[78%] w-[78%]"
        fallback={
          <span className="font-bold tracking-tight text-[var(--color-primary)]" style={{ fontSize: Math.round(size * 0.36) }}>
            {initials(name)}
          </span>
        }
      />
    </span>
  );
}

/**
 * Bog'cha logosi: yuklash, almashtirish, o'chirish. Rasm kesilmaydi —
 * kvadrat ichiga sig'diriladi. Yon menyuda, telefon menyusida va kirish
 * sahifasida bog'cha nomining bosh harflari o'rnida ko'rinadi.
 */
export function OrgLogoSheet({
  open,
  onClose,
  slug,
  name,
  updatedAt,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  name: string;
  updatedAt: string | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setConfirmRemove(false);
    }
  }, [open]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    queryClient.invalidateQueries({ queryKey: ["org-public", slug] });
  };
  const upload = useMutation({
    mutationFn: (image: string) => api.put("/app/organizations/me/logo", { image }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Logoni saqlab bo'lmadi")),
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/app/organizations/me/logo"),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Logoni o'chirib bo'lmadi")),
  });

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Bir xil faylni qayta tanlash ham hodisa bersin
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Rasm juda katta (8 MB gacha)");
      return;
    }
    setPreparing(true);
    try {
      upload.mutate(await fitToSquarePng(file, ORG_LOGO_SIZE));
    } catch {
      setError("Bu faylni rasm sifatida o'qib bo'lmadi");
    } finally {
      setPreparing(false);
    }
  };
  const busy = preparing || upload.isPending || remove.isPending;
  const hasLogo = !!updatedAt;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Bog'cha logosi")}
      footer={
        confirmRemove ? (
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => remove.mutate()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white active:scale-[0.96] disabled:opacity-60"
            >
              {remove.isPending ? <Spinner className="h-5 w-5 text-white" /> : <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
              {tr("O'chirish")}
            </button>
            <SheetSecondaryButton onClick={() => setConfirmRemove(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
          </div>
        ) : (
          <div className="space-y-2.5">
            <SheetPrimaryButton loading={preparing || upload.isPending} onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {hasLogo ? tr("Logoni almashtirish") : tr("Logo yuklash")}
            </SheetPrimaryButton>
            {hasLogo && (
              <SheetSecondaryButton danger onClick={() => setConfirmRemove(true)}>
                {tr("Logoni o'chirish")}
              </SheetSecondaryButton>
            )}
          </div>
        )
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <OrgLogoBadge slug={slug} name={name} updatedAt={updatedAt} size={120} />
        <p className="text-[17px] font-semibold text-[var(--color-text)]">{tr(name)}</p>
        <p className="max-w-[300px] text-[13px] leading-snug text-[#8e8e93]">
          {confirmRemove
            ? tr("Logo o'chiriladi, o'rniga bog'cha nomining bosh harflari ko'rinadi.")
            : tr("Yon menyuda va kirish sahifasida bog'cha nomining bosh harflari o'rnida ko'rinadi. Shaffof fonli PNG eng chiroyli chiqadi.")}
        </p>
        {error && (
          <p role="alert" className="rounded-[12px] bg-[#ff3b30]/[0.1] px-3 py-2 text-[13px] text-[#ff3b30]">
            {tr(error)}
          </p>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
    </IosSheet>
  );
}
