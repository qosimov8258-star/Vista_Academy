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
import { PlusIcon, CloseIcon } from "@/components/ui/icons";
import { prepareProductPhoto } from "@/lib/product-photo";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  description: z.string().max(500, "Izoh 500 belgidan oshmasin").optional(),
  color: z.string().optional(),
  priceCoins: z.coerce.number({ invalid_type_error: "Yulduzcha miqdorini kiriting" }).int().min(0, "0 dan kichik bo'lmasin"),
  quantity: z.coerce.number({ invalid_type_error: "Sonini kiriting" }).int().min(0, "Soni 0 dan kichik bo'lmasin"),
});

type FormValues = z.infer<typeof schema>;

const IMAGE_SLOTS = [1, 2, 3] as const;

export function CreateProductModal({
  open,
  onClose,
  slug,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [images, setImages] = useState<Record<number, string | null>>({ 1: null, 2: null, 3: null });
  const [imageError, setImageError] = useState<string | null>(null);
  const [checkingSlot, setCheckingSlot] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 0, priceCoins: 0 },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // branchId yubormaymiz — backend uni har doim foydalanuvchi scope'idan
      // oladi (requireTeachingScope), body'dagi qiymat e'tiborga olinmaydi
      // va ValidationPipe'ning `forbidNonWhitelisted`i uni rad etadi.
      const product = await api.post<Product>("/app/products", {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        color: values.color?.trim() || undefined,
        priceCoins: values.priceCoins,
        quantity: values.quantity,
      });
      // Rasmlar tovar yaratilgandan keyin alohida so'rovlar bilan yuklanadi;
      // shu so'rovlar muvaffaqiyatsiz bo'lsa ham tovar allaqachon yaratilgan hisoblanadi.
      await Promise.all(
        IMAGE_SLOTS.filter((position) => images[position]).map((position) =>
          api.put(`/app/products/${product.id}/images/${position}`, { image: images[position] }).catch(() => {}),
        ),
      );
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", slug, branchId] });
      handleClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
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
      setImages((prev) => ({ ...prev, [position]: result.image }));
    } finally {
      setCheckingSlot(null);
    }
  };

  const removeImage = (position: number) => {
    setImages((prev) => ({ ...prev, [position]: null }));
  };

  const handleClose = () => {
    reset({ quantity: 0, priceCoins: 0 });
    setServerError(null);
    setImageError(null);
    setImages({ 1: null, 2: null, 3: null });
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={tr("Yangi tovar")}>
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{tr("Rasmlar")}</span>
          <div className="flex gap-3">
            {IMAGE_SLOTS.map((position) => {
              const image = images[position];
              const checking = checkingSlot === position;
              return (
                <div key={position} className="group relative aspect-square w-full min-w-0 max-w-[100px] flex-1">
                  {image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, Next optimizatsiyasi kerak emas */}
                      <img
                        src={image}
                        alt={`Tovar surati ${position}`}
                        className="h-full w-full rounded-[var(--radius-md)] object-cover ring-1 ring-inset ring-[rgba(16,24,40,0.06)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(position)}
                        aria-label={tr("Rasmni olib tashlash")}
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
          {imageError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{tr(imageError)}</p>}
        </div>

        <Input label={tr("Nomi")} placeholder={tr("Konstruktor to'plami")} error={errors.name?.message} {...register("name")} />

        <Textarea
          label={tr("Izoh")}
          placeholder={tr("Nima uchun ekanligi haqida qisqacha (ixtiyoriy)")}
          rows={2}
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr("Narxi (yulduzcha)")}
            type="number"
            min={0}
            placeholder="0"
            error={errors.priceCoins?.message}
            {...register("priceCoins")}
          />
          <Input label={tr("Rangi")} placeholder={tr("Ixtiyoriy")} error={errors.color?.message} {...register("color")} />
        </div>

        <Input
          label={tr("Soni")}
          type="number"
          min={0}
          placeholder="10"
          error={errors.quantity?.message}
          {...register("quantity")}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tr("Yaratish")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
