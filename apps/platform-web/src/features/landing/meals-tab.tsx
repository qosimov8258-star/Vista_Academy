"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingMeal, LandingMealType, LandingWeekday } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ErrorState, EmptyState, CardsSkeleton } from "@/components/ui/states";
import { CameraIcon, CloseIcon, FoodIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";

const TYPE_LABELS: Record<LandingMealType, string> = {
  BREAKFAST: "Nonushta",
  LUNCH: "Tushlik",
  SNACK: "Tamaddi",
  DINNER: "Kechki ovqat",
  OTHER: "Boshqa",
};

const WEEKDAY_LABELS: Record<LandingWeekday, string> = {
  MONDAY: "Dushanba",
  TUESDAY: "Seshanba",
  WEDNESDAY: "Chorshanba",
  THURSDAY: "Payshanba",
  FRIDAY: "Juma",
  SATURDAY: "Shanba",
  SUNDAY: "Yakshanba",
};

const WEEKDAY_ORDER: LandingWeekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const schema = z.object({
  title: z.string().min(2, "Nomi kamida 2 belgi"),
  description: z.string().optional(),
  mealType: z.enum(["BREAKFAST", "LUNCH", "SNACK", "DINNER", "OTHER"]),
  weekday: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt SS:DD formatida bo'lsin (masalan, 08:30)"),
  order: z.coerce.number().int(),
});
type FormValues = z.infer<typeof schema>;

export function MealsTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LandingMeal | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landing", "meals"],
    queryFn: () => api.get<LandingMeal[]>("/platform/landing/meals"),
  });

  const deleteMeal = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/landing/meals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing", "meals"] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          "Sog'lom taomlar" bo'limida chiqadigan taomlar ro'yxati.
        </p>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="h-4 w-4" />
          Taom qo'shish
        </Button>
      </div>

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FoodIcon}
          title="Taomlar yo'q"
          description="Hozircha taom qo'shilmagan"
          action={
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              Taom qo'shish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((meal) => (
            <Card key={meal.id} className="overflow-hidden">
              <div className="flex h-32 items-center justify-center bg-[var(--color-surface-sunken)]">
                {meal.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                  <img src={assetUrl(meal.photoPath) ?? undefined} alt={meal.title} className="h-full w-full object-cover" />
                ) : (
                  <FoodIcon className="h-8 w-8 text-[var(--color-text-subtle)]" />
                )}
              </div>
              <div className="space-y-2 px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[14px] font-semibold text-[var(--color-text)]">{meal.title}</p>
                  <Badge tone="neutral">{TYPE_LABELS[meal.mealType]}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {meal.weekday && <Badge tone="primary">{WEEKDAY_LABELS[meal.weekday]}</Badge>}
                  {meal.time && <Badge tone="primary">{meal.time}</Badge>}
                </div>
                {meal.description && (
                  <p className="line-clamp-2 text-[13px] text-[var(--color-text-muted)]">{meal.description}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditing(meal);
                      setModalOpen(true);
                    }}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Tahrirlash
                  </Button>
                  <IconButton
                    label="O'chirish"
                    onClick={() => {
                      if (confirm(`"${meal.title}" taomini o'chirasizmi?`)) deleteMeal.mutate(meal.id);
                    }}
                    className="hover:text-[var(--color-danger)]"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MealFormModal open={modalOpen} onClose={() => setModalOpen(false)} meal={editing} />
    </div>
  );
}

function MealFormModal({
  open,
  onClose,
  meal,
}: {
  open: boolean;
  onClose: () => void;
  meal?: LandingMeal | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(meal);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset(
        meal
          ? {
              title: meal.title,
              description: meal.description ?? "",
              mealType: meal.mealType,
              weekday: meal.weekday ?? "MONDAY",
              time: meal.time ?? "08:00",
              order: meal.order,
            }
          : { title: "", description: "", mealType: "OTHER", weekday: "MONDAY", time: "08:00", order: 0 },
      );
      setServerError(null);
    }
  }, [open, meal, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? api.patch<LandingMeal>(`/platform/landing/meals/${meal!.id}`, values)
        : api.post<LandingMeal>("/platform/landing/meals", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing", "meals"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.upload<LandingMeal>(`/platform/landing/meals/${meal!.id}/photo`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing", "meals"] }),
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Taomni tahrirlash" : "Yangi taom"}>
      <div className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)]">
              {meal!.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                <img src={assetUrl(meal!.photoPath) ?? undefined} alt={meal!.title} className="h-full w-full object-cover" />
              ) : (
                <FoodIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) photoMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button type="button" size="sm" variant="outline" loading={photoMutation.isPending} onClick={() => fileInputRef.current?.click()}>
              <CameraIcon className="h-4 w-4" />
              Rasm yuklash
            </Button>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Input label="Nomi" placeholder="Sabzavotli osh" error={errors.title?.message} {...register("title")} />
          <Select label="Turi" error={errors.mealType?.message} {...register("mealType")}>
            <option value="BREAKFAST">Nonushta</option>
            <option value="LUNCH">Tushlik</option>
            <option value="SNACK">Tamaddi</option>
            <option value="DINNER">Kechki ovqat</option>
            <option value="OTHER">Boshqa</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Haftaning kuni" error={errors.weekday?.message} {...register("weekday")}>
              {WEEKDAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LABELS[day]}
                </option>
              ))}
            </Select>
            <Input label="Vaqti" type="time" error={errors.time?.message} {...register("time")} />
          </div>
          <Textarea label="Tavsif" rows={3} placeholder="Tarkibi va foydasi haqida qisqacha" error={errors.description?.message} {...register("description")} />
          <Input label="Tartib raqami" type="number" hint="Kichik raqam avval chiqadi" error={errors.order?.message} {...register("order")} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Saqlash
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
