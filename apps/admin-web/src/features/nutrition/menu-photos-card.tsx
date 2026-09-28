"use client";

import { useRef, useState } from "react";
import type { MenuMeal, MenuPhoto } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/states";
import { MAX_PHOTOS_PER_MEAL, MEALS, menuPhotoSrc, useMenuPhotos } from "./use-menu-photos";

/**
 * Tayyor ovqat suratlari: oshpaz har bir ovqatni suratga olib yuklaydi,
 * ota-onalar ularni kabinetdagi "Bugungi ovqat" bo'limida ko'radi.
 * Telefonda "Rasm qo'shish" to'g'ridan-to'g'ri kamerani ochadi.
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
  const { query, photosOf, upload, uploading, errors, remove } = useMenuPhotos(slug, branchId, date);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tayyor ovqat suratlari</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {canWrite
            ? "Ovqat tayyor bo'lgach suratga olib yuklang — ota-onalar kabinetda menyu ostida ko'radi."
            : "Oshpaz yuklagan suratlar — ota-onalar ham shularni ko'radi."}
        </p>
        {query.isLoading ? (
          <LoadingState rows={2} />
        ) : query.isError ? (
          <p className="text-[13px] text-[var(--color-danger)]">{(query.error as Error).message}</p>
        ) : (
          MEALS.map(({ meal, label }) => (
            <MealRow
              key={meal}
              meal={meal}
              label={label}
              photos={photosOf(meal)}
              canWrite={canWrite}
              uploading={uploading === meal}
              error={errors[meal]}
              onFile={(file) => upload(meal, file)}
              onView={setViewing}
              onDelete={setDeleting}
            />
          ))
        )}
      </CardBody>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Ovqat surati" widthClassName="max-w-3xl">
        {viewing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={menuPhotoSrc(viewing)} alt="Ovqat surati" className="max-h-[75vh] w-full rounded-lg object-contain" />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Suratni o'chirish"
        description="Surat ota-onalar kabinetidan ham olib tashlanadi."
        confirmLabel="O'chirish"
        tone="danger"
        loading={remove.isPending}
        error={remove.error ? (remove.error as Error).message : undefined}
        onConfirm={() => deleting && remove.mutate(deleting, { onSuccess: () => setDeleting(null) })}
      />
    </Card>
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
  onDelete,
}: {
  meal: MenuMeal;
  label: string;
  photos: MenuPhoto[];
  canWrite: boolean;
  uploading: boolean;
  error?: string;
  onFile: (file: File) => Promise<boolean>;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-[var(--color-text)]">{label}</p>
        {canWrite && photos.length < MAX_PHOTOS_PER_MEAL && (
          <>
            <Button variant="outline" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
              Rasm qo&apos;shish
            </Button>
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
      {photos.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <button
                type="button"
                onClick={() => onView(p.id)}
                className="block h-24 w-24 overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]"
                aria-label={`${label} suratini kattalashtirish`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={menuPhotoSrc(p.id)} alt={label} loading="lazy" className="h-full w-full object-cover" />
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[13px] leading-none text-white"
                  aria-label="Suratni o'chirish"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Surat yo&apos;q</p>
      )}
      {error && <p className="mt-2 text-[13px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
