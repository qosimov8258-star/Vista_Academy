"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Dish } from "@/lib/types";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditDishModal } from "./edit-dish-modal";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  calories: z.coerce.number().int().min(0).optional().or(z.literal("")),
  allergens: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function DishCatalogCard({ slug, canWrite }: { slug: string; canWrite: boolean }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [deleteDish, setDeleteDish] = useState<Dish | null>(null);

  const dishesQuery = useQuery({
    queryKey: ["dishes", slug],
    queryFn: () => api.get<Dish[]>("/app/dishes"),
  });

  const deleteMutation = useMutation({
    mutationFn: (dish: Dish) => api.delete(`/app/dishes/${dish.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes", slug] });
      setDeleteDish(null);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Dish>("/app/dishes", {
        name: values.name,
        calories: values.calories === "" ? undefined : values.calories,
        allergens: values.allergens || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes", slug] });
      reset();
      setServerError(null);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{tr("Taomlar katalogi")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {dishesQuery.isLoading ? (
          <LoadingState rows={3} />
        ) : dishesQuery.isError ? (
          <ErrorState message={tr((dishesQuery.error as Error).message)} />
        ) : !dishesQuery.data || dishesQuery.data.length === 0 ? (
          <EmptyState title={tr("Hali taom qo'shilmagan")} />
        ) : (
          <ul className="divide-y divide-[var(--color-separator)]">
            {dishesQuery.data.map((dish) => (
              <li key={dish.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <span className="text-[14px] font-medium text-[var(--color-text)]">{tr(dish.name)}</span>
                  <span className="ml-2 text-[12.5px] text-[var(--color-text-muted)]">
                    {dish.calories != null && `${dish.calories} kkal`}
                    {dish.calories != null && dish.allergens && " · "}
                    {dish.allergens && `Allergen: ${dish.allergens}`}
                  </span>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setEditDish(dish)}>
                      {tr("Tahrirlash")}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteDish(dish)}>
                      {tr("O'chirish")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canWrite && (
          <form
            className="flex flex-wrap items-end gap-3 border-t border-[var(--color-separator)] pt-4"
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
          >
            {serverError && (
              <div className="w-full rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {tr(serverError)}
              </div>
            )}
            <Input label={tr("Taom nomi")} placeholder={tr("Sutli bo'tqa")} error={errors.name?.message} {...register("name")} className="min-w-[160px]" />
            <Input
              label={tr("Kaloriya (ixtiyoriy)")}
              type="number"
              min={0}
              placeholder="250"
              error={errors.calories?.message}
              {...register("calories")}
              className="w-[140px]"
            />
            <Input
              label={tr("Allergenlar (ixtiyoriy)")}
              placeholder={tr("sut, yong'oq")}
              error={errors.allergens?.message}
              {...register("allergens")}
              className="min-w-[160px]"
            />
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {tr("Qo'shish")}
            </Button>
          </form>
        )}
      </CardBody>

      {editDish && <EditDishModal open={!!editDish} onClose={() => setEditDish(null)} slug={slug} dish={editDish} />}

      <ConfirmDialog
        open={!!deleteDish}
        onClose={() => setDeleteDish(null)}
        title={tr("Taomni o'chirish")}
        confirmLabel={tr("O'chirish")}
        tone="danger"
        loading={deleteMutation.isPending}
        description={
          <>
            <b className="text-[var(--color-text)]">{tr(deleteDish?.name)}</b> {tr("katalogdan butunlay o'chiriladi.")}
          </>
        }
        onConfirm={() => deleteDish && deleteMutation.mutate(deleteDish)}
      />
    </Card>
  );
}
