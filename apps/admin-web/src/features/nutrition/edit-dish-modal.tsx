"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Dish } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  calories: z.coerce.number().int().min(0).optional().or(z.literal("")),
  allergens: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditDishModal({
  open,
  onClose,
  slug,
  dish,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  dish: Dish;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: dish.name, calories: dish.calories ?? "", allergens: dish.allergens ?? "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: dish.name, calories: dish.calories ?? "", allergens: dish.allergens ?? "" });
    setServerError(null);
  }, [open, dish, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch<Dish>(`/app/dishes/${dish.id}`, {
        name: values.name,
        calories: values.calories === "" ? null : values.calories,
        allergens: values.allergens ? values.allergens : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Taomni tahrirlash">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="Taom nomi" error={errors.name?.message} {...register("name")} />
        <Input
          label="Kaloriya (ixtiyoriy)"
          type="number"
          min={0}
          error={errors.calories?.message}
          {...register("calories")}
        />
        <Input label="Allergenlar (ixtiyoriy)" error={errors.allergens?.message} {...register("allergens")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
