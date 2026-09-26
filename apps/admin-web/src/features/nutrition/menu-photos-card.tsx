"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MenuMeal, MenuPhoto } from "@/lib/types";
import { prepareMenuPhoto } from "@/lib/menu-photo";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/states";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Bitta ovqatga bir kunda yuklanadigan suratlar soni (server ham tekshiradi) */
const MAX_PER_MEAL = 4;

const MEALS: { meal: MenuMeal; label: string }[] = [
  { meal: "BREAKFAST", label: "Nonushta" },
  { meal: "LUNCH", label: "Tushlik" },
  { meal: "SNACK", label: "Kechki ovqat / gazak" },
];

export const menuPhotoSrc = (id: string) => `${API_URL}/app/menu/photos/${id}/image`;

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
  const queryClient = useQueryClient();
  const queryKey = ["menu-photos", slug, branchId, date];
  const photosQuery = useQuery({
    queryKey,
    queryFn: () => api.get<MenuPhoto[]>(`/app/menu/photos?branchId=${branchId}&date=${date}`),
    enabled: !!branchId,
  });
  const photos = photosQuery.data ?? [];

  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/menu/photos/${id}`),
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey });
    },
  });

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
        {photosQuery.isLoading ? (
          <LoadingState rows={2} />
        ) : photosQuery.isError ? (
          <p className="text-[13px] text-[var(--color-danger)]">{(photosQuery.error as Error).message}</p>
        ) : (
          MEALS.map(({ meal, label }) => (
            <MealRow
              key={meal}
              meal={meal}
              label={label}
              date={date}
              photos={photos.filter((p) => p.meal === meal)}
              canWrite={canWrite}
              onUploaded={() => queryClient.invalidateQueries({ queryKey })}
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
          deleteMutation.reset();
        }}
        title="Suratni o'chirish"
        description="Surat ota-onalar kabinetidan ham olib tashlanadi."
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.error ? (deleteMutation.error as Error).message : undefined}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </Card>
  );
}

function MealRow({
  meal,
  label,
  date,
  photos,
  canWrite,
  onUploaded,
  onView,
  onDelete,
}: {
  meal: MenuMeal;
  label: string;
  date: string;
  photos: MenuPhoto[];
  canWrite: boolean;
  onUploaded: () => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const prepared = await prepareMenuPhoto(file);
      if (!prepared.ok) {
        setError(prepared.reason);
        return;
      }
      await api.post("/app/menu/photos", { date, meal, image: prepared.image });
      onUploaded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-[var(--color-text)]">{label}</p>
        {canWrite && photos.length < MAX_PER_MEAL && (
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
              onChange={(e) => handleFile(e.target.files?.[0])}
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
