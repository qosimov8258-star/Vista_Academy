"use client";

import { use, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingMeal, LandingMealType, LandingWeekday } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CameraIcon, MealIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { LendingTabs } from "@/features/lending/lending-tabs";

const TYPE_LABELS: Record<LandingMealType, string> = {
  BREAKFAST: "Nonushta",
  LUNCH: "Tushlik",
  SNACK: "Ikkinchi nonushta",
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

const schema = z.object({
  title: z.string().min(2, "Nomi kamida 2 belgi"),
  description: z.string().optional(),
  mealType: z.enum(["BREAKFAST", "LUNCH", "SNACK", "DINNER", "OTHER"]),
  weekday: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt SS:DD formatida bo'lsin (masalan, 08:30)"),
  order: z.coerce.number().int(),
});
type FormValues = z.infer<typeof schema>;
type MenuWeekday = FormValues["weekday"];

const WEEKDAY_ORDER: MenuWeekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export default function LendingMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; meal: LandingMeal | null }>({ open: false, meal: null });
  const [deleting, setDeleting] = useState<LandingMeal | null>(null);
  const [activeDay, setActiveDay] = useState<MenuWeekday>("MONDAY");

  const mealsQuery = useQuery({
    queryKey: ["landing-meals"],
    queryFn: () => api.get<LandingMeal[]>("/app/landing/meals"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/landing/meals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-meals"] });
      setDeleting(null);
    },
  });

  const meals = mealsQuery.data ?? [];
  const byDay = new Map<MenuWeekday, LandingMeal[]>(WEEKDAY_ORDER.map((day) => [day, []]));
  const unscheduled: LandingMeal[] = [];
  for (const meal of meals) {
    if (meal.weekday && byDay.has(meal.weekday as MenuWeekday)) byDay.get(meal.weekday as MenuWeekday)!.push(meal);
    else unscheduled.push(meal);
  }
  const activeMeals = byDay.get(activeDay) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Lending sahifa</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            Saytdagi "Haftalik menyu" bo'limi — shu yerdan tahrirlansa, o'zgarish saytda darhol ko'rinadi
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setModal({ open: true, meal: null })}>
            <PlusIcon className="h-4 w-4" />
            Taom qo'shish
          </Button>
        )}
      </div>

      <LendingTabs base={base} />

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {mealsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : mealsQuery.isError ? (
        <ErrorState message={mealsQuery.error instanceof ApiError ? mealsQuery.error.message : "Xatolik yuz berdi"} />
      ) : meals.length === 0 ? (
        <EmptyState
          icon={<MealIcon className="h-[26px] w-[26px]" />}
          title="Hali taom yo'q"
          description={canWrite ? "\"+ Taom qo'shish\" tugmasi orqali birinchisini qo'shing" : undefined}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_ORDER.map((day) => {
              const count = byDay.get(day)!.length;
              const isActive = day === activeDay;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={clsx(
                    "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                    isActive
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]",
                  )}
                >
                  {WEEKDAY_LABELS[day]}
                  {count > 0 && <span className="ml-1.5 opacity-75">({count})</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {activeMeals.length === 0 ? (
              <EmptyState
                icon={<MealIcon className="h-[26px] w-[26px]" />}
                title={`${WEEKDAY_LABELS[activeDay]} kuni uchun taom yo'q`}
                description={canWrite ? "\"+ Taom qo'shish\" tugmasi orqali qo'shing" : undefined}
              />
            ) : (
              activeMeals.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  canWrite={canWrite}
                  onEdit={() => setModal({ open: true, meal })}
                  onDelete={() => setDeleting(meal)}
                />
              ))
            )}
          </div>

          {unscheduled.length > 0 && (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                Kunsiz taomlar
              </p>
              {unscheduled.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  canWrite={canWrite}
                  onEdit={() => setModal({ open: true, meal })}
                  onDelete={() => setDeleting(meal)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {canWrite && (
        <MealFormModal
          open={modal.open}
          onClose={() => setModal({ open: false, meal: null })}
          meal={modal.meal}
          defaultWeekday={activeDay}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Taomni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        description={<><b className="text-[var(--color-text)]">{deleting?.title}</b> saytdan o&apos;chiriladi.</>}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function MealRow({
  meal,
  canWrite,
  onEdit,
  onDelete,
}: {
  meal: LandingMeal;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const items = meal.title
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)]">
        {meal.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
          <img src={assetUrl(meal.photoPath) ?? undefined} alt={meal.title} className="h-full w-full object-cover" />
        ) : (
          <MealIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {meal.time && <Badge tone="primary">{meal.time}</Badge>}
          <Badge tone="neutral">{TYPE_LABELS[meal.mealType]}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <span
              key={index}
              className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-2.5 py-1 text-[13px] font-medium text-[var(--color-text)]"
            >
              {item}
            </span>
          ))}
        </div>
        {meal.description && <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">{meal.description}</p>}
      </div>
      {canWrite && (
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <PencilIcon className="h-3.5 w-3.5" />
            Tahrirlash
          </Button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="O'chirish"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </Card>
  );
}

function MealFormModal({
  open,
  onClose,
  meal,
  defaultWeekday,
}: {
  open: boolean;
  onClose: () => void;
  meal: LandingMeal | null;
  defaultWeekday: MenuWeekday;
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
              weekday: (meal.weekday ?? defaultWeekday) as FormValues["weekday"],
              time: meal.time ?? "08:00",
              order: meal.order,
            }
          : { title: "", description: "", mealType: "OTHER", weekday: defaultWeekday, time: "08:00", order: 0 },
      );
      setServerError(null);
    }
  }, [open, meal, defaultWeekday, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? api.patch<LandingMeal>(`/app/landing/meals/${meal!.id}`, values)
        : api.post<LandingMeal>("/app/landing/meals", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-meals"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.upload<LandingMeal>(`/app/landing/meals/${meal!.id}/photo`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing-meals"] }),
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
                <MealIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
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
            <option value="SNACK">Ikkinchi nonushta</option>
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
          <Textarea label="Tarkibi" rows={3} placeholder="Taom tarkibidagi mahsulotlar, vergul bilan" error={errors.description?.message} {...register("description")} />
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
