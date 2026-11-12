"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, resizeToSquare } from "@/lib/resize-image";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { GroupAvatar } from "./group-avatar";
import { useTr } from "@/i18n/tr";

/** Guruh rasmi 512x512 da saqlanadi — sahifa sarlavhasida ham tiniq ko'rinadi. */
const GROUP_AVATAR_SIZE = 512;

/**
 * Guruh rasmi (profil belgisi): qo'yish, almashtirish, o'chirish. Rasm
 * markazidan kvadrat qilib kesiladi. Panelda guruhlar ro'yxati va guruh
 * sahifasida, ota-ona kabinetida esa guruh nomi yonida ko'rinadi.
 */
export function GroupPhotoSheet({
  open,
  onClose,
  slug,
  group,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  group: { id: string; name: string; avatarUpdatedAt?: string | null };
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["group-overview", slug, group.id] });
    queryClient.invalidateQueries({ queryKey: ["groups", slug] });
  };
  const upload = useMutation({
    mutationFn: (image: string) => api.put(`/app/groups/${group.id}/avatar`, { image }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Rasmni saqlab bo'lmadi")),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/app/groups/${group.id}/avatar`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Rasmni o'chirib bo'lmadi")),
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
      upload.mutate(await resizeToSquare(file, GROUP_AVATAR_SIZE));
    } catch {
      setError("Bu faylni rasm sifatida o'qib bo'lmadi");
    } finally {
      setPreparing(false);
    }
  };
  const busy = preparing || upload.isPending || remove.isPending;
  const hasPhoto = !!group.avatarUpdatedAt;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Guruh rasmi")}
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
              <Camera className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {hasPhoto ? tr("Rasmni almashtirish") : tr("Rasm qo'yish")}
            </SheetPrimaryButton>
            {hasPhoto && (
              <SheetSecondaryButton danger onClick={() => setConfirmRemove(true)}>
                {tr("Rasmni o'chirish")}
              </SheetSecondaryButton>
            )}
          </div>
        )
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <GroupAvatar group={group} size={120} />
        <p className="text-[17px] font-semibold text-[var(--color-text)]">{tr(group.name)}</p>
        <p className="max-w-[300px] text-[13px] leading-snug text-[#8e8e93]">
          {confirmRemove
            ? tr("Rasm o'chiriladi, o'rniga guruh nomining bosh harfi ko'rinadi.")
            : tr("Guruhlar ro'yxatida, guruh sahifasida va ota-onalar kabinetida ko'rinadi. Rasm markazidan kvadrat qilib kesiladi.")}
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
