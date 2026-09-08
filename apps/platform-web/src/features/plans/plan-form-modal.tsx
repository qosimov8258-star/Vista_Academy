"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  code: z
    .string()
    .min(2, "Kod kamida 2 belgi")
    .regex(/^[a-z0-9-]+$/, "Faqat kichik lotin harflar, raqam va tire"),
  priceMonthly: z.coerce.number().min(0, "Manfiy bo'lishi mumkin emas"),
  maxBranches: z.coerce.number().int().min(1),
  maxChildren: z.coerce.number().int().min(1),
  maxEmployees: z.coerce.number().int().min(1),
  maxStorageGb: z.coerce.number().int().min(1),
});
type FormValues = z.infer<typeof schema>;

export function PlanFormModal({
  open,
  onClose,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  plan?: Plan | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(plan);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset(
        plan
          ? {
              name: plan.name,
              code: plan.code,
              priceMonthly: Number(plan.priceMonthly),
              maxBranches: plan.maxBranches,
              maxChildren: plan.maxChildren,
              maxEmployees: plan.maxEmployees,
              maxStorageGb: plan.maxStorageGb,
            }
          : { name: "", code: "", priceMonthly: 0, maxBranches: 1, maxChildren: 50, maxEmployees: 10, maxStorageGb: 5 },
      );
      setServerError(null);
    }
  }, [open, plan, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? api.patch<Plan>(`/platform/plans/${plan!.id}`, values) : api.post<Plan>("/platform/plans", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Tarif rejani tahrirlash" : "Yangi tarif reja"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]"
          >
            {serverError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nomi" placeholder="Standart" error={errors.name?.message} {...register("name")} />
          <Input
            label="Kod"
            placeholder="standard"
            hint="Faqat lotin harflar/raqam, masalan: standard"
            disabled={isEdit}
            error={errors.code?.message}
            {...register("code")}
          />
        </div>
        <Input
          label="Oylik narx (UZS)"
          type="number"
          error={errors.priceMonthly?.message}
          {...register("priceMonthly")}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Input label="Max filial" type="number" error={errors.maxBranches?.message} {...register("maxBranches")} />
          <Input label="Max bola" type="number" error={errors.maxChildren?.message} {...register("maxChildren")} />
          <Input label="Max xodim" type="number" error={errors.maxEmployees?.message} {...register("maxEmployees")} />
          <Input label="Storage (GB)" type="number" error={errors.maxStorageGb?.message} {...register("maxStorageGb")} />
        </div>
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
