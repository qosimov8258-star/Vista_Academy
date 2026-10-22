"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import type { MenuMeal, MenuPhoto } from "@/lib/types";
import { Group } from "@/components/ios/group";
import { IosSheet, SheetSecondaryButton } from "@/components/ios/sheet";
import { SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, ROW_SEPARATOR } from "@/components/ios/tokens";
import { Spinner } from "@/components/ios/spinner";
import { MAX_PHOTOS_PER_MEAL, MEALS, menuPhotoSrc, useMenuPhotos } from "./use-menu-photos";
import { useTr } from "@/i18n/tr";

/**
 * Tayyor ovqat suratlari: oshpaz har bir ovqatni suratga olib yuklaydi,
 * ota-onalar ularni kabinetdagi "Bugungi ovqat" bo'limida ko'radi.
 * Telefonda "+" katagi to'g'ridan-to'g'ri kamerani ochadi. Surat bosilsa
 * kattalashadi; o'chirish shu oynada, ikki bosqichda.
 */
export function MenuPhotosCard({
  slug,
  branchId,
  date,
  canWrite,
}: {
  slug: string;
  branchId: string;
  date: string;
  canWrite: boolean;
}) {
  const tr = useTr();
  const { query, photosOf, upload, uploading, errors, remove } = useMenuPhotos(slug, branchId, date);
  const [viewing, setViewing] = useState<{ id: string; label: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const closeViewer = () => {
    if (remove.isPending) return;
    setViewing(null);
    setConfirming(false);
    remove.reset();
  };

  return (
    <Group
      title={tr("Tayyor ovqat suratlari")}
      footer={
        canWrite
          ? tr("Ovqat tayyor bo'lgach suratga olib yuklang — ota-onalar kabinetda menyu ostida ko'radi.")
          : tr("Suratlarni faqat oshpaz yuklaydi — bu yerda uning yuklaganini kuzatasiz. Ota-onalar ham shularni ko'radi.")
      }
      bare
    >
      {query.isLoading ? (
        <SkeletonRows rows={3} avatar={false} />
      ) : query.isError ? (
        <p className="px-4 text-[13px] text-[#ff3b30]">{tr((query.error as Error).message)}</p>
      ) : (
        <div className={GROUP_BLOCK}>
          {MEALS.map(({ meal, label }) => (
            <MealRow
              key={meal}
              meal={meal}
              label={tr(label)}
              photos={photosOf(meal)}
              canWrite={canWrite}
              uploading={uploading === meal}
              error={errors[meal]}
              onFile={(file) => upload(meal, file)}
              onView={(id) => setViewing({ id, label: tr(label) })}
            />
          ))}
        </div>
      )}

      <IosSheet
        open={!!viewing}
        onClose={closeViewer}
        cancelLabel="Yopish"
        title={viewing?.label ?? tr("Ovqat surati")}
        footer={
          canWrite && viewing ? (
            confirming ? (
              <div className="space-y-2">
                <p className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] text-[#d70015]">{tr("Surat ota-onalar kabinetidan ham olib tashlanadi.")}</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SheetSecondaryButton onClick={() => setConfirming(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
                  </div>
                  <div className="flex-1">
                    <SheetSecondaryButton danger onClick={() => remove.mutate(viewing.id, { onSuccess: () => closeViewer() })}>
                      {remove.isPending ? <Spinner className="h-5 w-5" /> : tr("O'chirish")}
                    </SheetSecondaryButton>
                  </div>
                </div>
              </div>
            ) : (
              <SheetSecondaryButton danger onClick={() => setConfirming(true)}>
                {tr("Suratni o'chirish")}
              </SheetSecondaryButton>
            )
          ) : undefined
        }
      >
        {viewing && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={menuPhotoSrc(viewing.id)} alt={tr("Ovqat surati")} className="max-h-[65vh] w-full rounded-[14px] bg-black/[0.04] object-contain" />
            {remove.error && <p className="px-1 text-[13px] text-[#ff3b30]">{tr((remove.error as Error).message)}</p>}
          </>
        )}
      </IosSheet>
    </Group>
  );
}

function MealRow({
  label,
  photos,
  canWrite,
  uploading,
  error,
  onFile,
  onView,
}: {
  meal: MenuMeal;
  label: string;
  photos: MenuPhoto[];
  canWrite: boolean;
  uploading: boolean;
  error?: string;
  onFile: (file: File) => Promise<boolean>;
  onView: (id: string) => void;
}) {
  const tr = useTr();
  const inputRef = useRef<HTMLInputElement>(null);
  const canAdd = canWrite && photos.length < MAX_PHOTOS_PER_MEAL;

  return (
    <div className="group/row relative px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-medium text-[var(--color-text)]">{label}</p>
        <span className="text-[12.5px] tabular-nums text-[#8e8e93]">
          {photos.length ? tr("{0} ta surat", photos.length) : tr("Surat yo'q")}
        </span>
      </div>
      {(photos.length > 0 || canAdd) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onView(p.id)}
              className="block h-[76px] w-[76px] overflow-hidden rounded-[12px] bg-black/[0.04] transition-transform active:scale-[0.96]"
              aria-label={tr("{0} suratini kattalashtirish", label)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={menuPhotoSrc(p.id)} alt={label} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          {canAdd && (
            <>
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="flex h-[76px] w-[76px] flex-col items-center justify-center gap-1 rounded-[12px] bg-[#767680]/[0.12] text-[12px] font-medium text-[var(--color-primary)] transition-transform active:scale-[0.96]"
                aria-label={tr("Rasm qo'shish")}
              >
                {uploading ? <Spinner className="h-5 w-5" /> : <Camera className="h-[22px] w-[22px]" strokeWidth={2} />}
                {!uploading && tr("Qo'shish")}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) await onFile(file);
                }}
              />
            </>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}
