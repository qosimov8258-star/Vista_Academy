"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Child } from "@/lib/types";
import { prepareChildPhoto } from "@/lib/child-photo";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { useTr } from "@/i18n/tr";

/** Bola surati: yuz tekshiriladi va saqlanadi. Shu surat Face ID terminaliga ham ketadi. */
export function ChildPhotoSheet({
  open,
  onClose,
  slug,
  child,
  canRemove,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  child: Child;
  canRemove: boolean;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setConfirmRemove(false);
    }
  }, [open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["child", slug, child.id] });
    queryClient.invalidateQueries({ queryKey: ["children", slug] });
  };
  const upload = useMutation({
    mutationFn: (image: string) => api.put(`/app/children/${child.id}/avatar`, { image }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Suratni saqlab bo'lmadi")),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/app/children/${child.id}/avatar`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Suratni o'chirib bo'lmadi")),
  });

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setChecking(true);
    try {
      // Yuz tekshiruvi va kesish shu yerda — natija tayyor bo'lsagina yuboriladi
      const result = await prepareChildPhoto(file);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      upload.mutate(result.image);
    } finally {
      setChecking(false);
    }
  };
  const busy = checking || upload.isPending || remove.isPending;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Surat")}
      footer={
        confirmRemove ? (
          <div className="space-y-2.5">
            <button type="button" disabled={busy} onClick={() => remove.mutate()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white active:scale-[0.96] disabled:opacity-60">
              {remove.isPending ? <Spinner className="h-5 w-5 text-white" /> : <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
              {tr("O'chirish")}
            </button>
            <SheetSecondaryButton onClick={() => setConfirmRemove(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
          </div>
        ) : (
          <div className="space-y-2.5">
            <SheetPrimaryButton loading={checking || upload.isPending} onClick={() => inputRef.current?.click()}>
              <Camera className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {child.avatarUpdatedAt ? tr("Suratni almashtirish") : tr("Surat qo'yish")}
            </SheetPrimaryButton>
            {canRemove && child.avatarUpdatedAt && (
              <SheetSecondaryButton danger onClick={() => setConfirmRemove(true)}>
                {tr("Suratni o'chirish")}
              </SheetSecondaryButton>
            )}
          </div>
        )
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <ChildPhoto child={child} size={120} fallback={initials(child.fullName)} />
        <p className="max-w-[300px] text-[13px] leading-snug text-[#8e8e93]">
          {checking ? tr("Surat tekshirilmoqda…") : confirmRemove ? tr("Surat o'chiriladi, o'rniga bosh harflar ko'rinadi.") : tr("Yuzi ko'rinib turgan surat, 3 MB gacha. Yuz avtomatik topiladi va kesiladi.")}
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
