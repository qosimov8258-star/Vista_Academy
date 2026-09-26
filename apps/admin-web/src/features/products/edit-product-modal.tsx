"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlusIcon, CloseIcon } from "@/components/ui/icons";
import { prepareProductPhoto } from "@/lib/product-photo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  description: z.string().max(500, "Izoh 500 belgidan oshmasin").optional(),
  color: z.string().optional(),
  priceCoins: z.coerce.number({ invalid_type_error: "Coin miqdorini kiriting" }).int().min(0, "0 dan kichik bo'lmasin"),
  quantity: z.coerce.number({ invalid_type_error: "Sonini kiriting" }).int().min(0, "Soni 0 dan kichik bo'lmasin"),
});

type FormValues = z.infer<typeof schema>;

const IMAGE_SLOTS = [1, 2, 3] as const;

type SlotState =
  | { status: "empty" }
  | { status: "existing" }
  | { status: "new"; image: string }
  | { status: "removed" };

function hasImage(product: Product, position: 1 | 2 | 3) {
  if (position === 1) return product.hasImage1;
  if (position === 2) return product.hasImage2;
  return product.hasImage3;
}

function initialSlots(product: Product): Record<number, SlotState> {
  return {
    1: hasImage(product, 1) ? { status: "existing" } : { status: "empty" },
    2: hasImage(product, 2) ? { status: "existing" } : { status: "empty" },
    3: hasImage(product, 3) ? { status: "existing" } : { status: "empty" },
  };
}

export function EditProductModal({
  open,
  onClose,
  slug,
  branchId,
  product,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string;
  product: Product;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<number, SlotState>>(() => initialSlots(product));
  const [imageError, setImageError] = useState<string | null>(null);
  const [checkingSlot, setCheckingSlot] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product.name,
      description: product.description ?? "",
      color: product.color ?? "",
      priceCoins: product.priceCoins,
      quantity: product.quantity,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await api.patch(`/app/products/${product.id}`, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: values.color?.trim() || null,
        priceCoins: values.priceCoins,
        quantity: values.quantity,
      });
      await Promise.all(
        IMAGE_SLOTS.map((position) => {
          const slot = slots[position];
          if (slot.status === "new") {
            return api.put(`/app/products/${product.id}/images/${position}`, { image: slot.image }).catch(() => {});
          }
          if (slot.status === "removed") {
            return api.delete(`/app/products/${product.id}/images/${position}`).catch(() => {});
          }
          return Promise.resolve();
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", slug, branchId] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/app/products/${product.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", slug, branchId] });
      setDeleteOpen(false);
      onClose();
    },
  });

  const handleImagePick = async (position: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageError(null);
    setCheckingSlot(position);
    try {
      const result = await prepareProductPhoto(file);
      if (!result.ok) {
        setImageError(result.reason);
        return;
      }
      setSlots((prev) => ({ ...prev, [position]: { status: "new", image: result.image } }));
    } finally {
      setCheckingSlot(null);
    }
  };

  const removeImage = (position: number) => {
    setSlots((prev) => ({
      ...prev,
      [position]: prev[position].status === "existing" ? { status: "removed" } : { status: "empty" },
    }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Tovarni tahrirlash">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Rasmlar</span>
          <div className="flex gap-3">
            {IMAGE_SLOTS.map((position) => {
              const slot = slots[position];
              const checking = checkingSlot === position;
              const showsImage = slot.status === "existing" || slot.status === "new";
              const src =
                slot.status === "new"
                  ? slot.image
                  : slot.status === "existing"
                    ? `${API_URL}/app/products/${product.id}/images/${position}?v=${encodeURIComponent(product.imagesUpdatedAt ?? "")}`
                    : undefined;
              return (
                <div key={position} className="group relative aspect-square w-full min-w-0 max-w-[100px] flex-1">
                  {showsImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- tashqi/data: manzil, Next optimizatsiyasi kerak emas */}
                      <img
                        src={src}
                        alt={`Tovar surati ${position}`}
                        className="h-full w-full rounded-[var(--radius-md)] object-cover ring-1 ring-inset ring-[rgba(16,24,40,0.06)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(position)}
                        aria-label="Rasmni olib tashlash"
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-[var(--color-danger)] text-white shadow-[var(--shadow-xs)]"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[position]?.click()}
                      disabled={checking}
                      className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-wait"
                    >
                      {checking ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <PlusIcon className="h-5 w-5" />
                      )}
                    </button>
                  )}
                  <input
                    ref={(el) => {
                      fileInputRefs.current[position] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleImagePick(position, e)}
                  />
                </div>
              );
            })}
          </div>
          {imageError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{imageError}</p>}
        </div>

        <Input label="Nomi" placeholder="Konstruktor to'plami" error={errors.name?.message} {...register("name")} />

        <Textarea
          label="Izoh"
          placeholder="Nima uchun ekanligi haqida qisqacha (ixtiyoriy)"
          rows={2}
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Narxi (coin)"
            type="number"
            min={0}
            placeholder="0"
            error={errors.priceCoins?.message}
            {...register("priceCoins")}
          />
          <Input label="Rangi" placeholder="Ixtiyoriy" error={errors.color?.message} {...register("color")} />
        </div>

        <Input
          label="Soni"
          type="number"
          min={0}
          placeholder="10"
          error={errors.quantity?.message}
          {...register("quantity")}
        />

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="dangerSoft" onClick={() => setDeleteOpen(true)}>
            Tovarni o&apos;chirish
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Saqlash
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Tovarni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? "Kutilmagan xatolik yuz berdi" : null}
        description={
          <>
            <b className="text-[var(--color-text)]">{product.name}</b> do&apos;kondan butunlay o&apos;chiriladi.
          </>
        }
        onConfirm={() => deleteMutation.mutate()}
      />
    </Modal>
  );
}
