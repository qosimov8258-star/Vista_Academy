"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Plan, Subscription } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({ planId: z.string().min(1, "Reja tanlang") });
type FormValues = z.infer<typeof schema>;

export function AssignSubscriptionModal({
  open,
  onClose,
  organizationId,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  mode: "assign" | "change";
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/platform/plans"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      mode === "assign"
        ? api.post<Subscription>("/platform/subscriptions", { organizationId, planId: values.planId })
        : api.patch<Subscription>(`/platform/subscriptions/organization/${organizationId}/plan`, {
            planId: values.planId,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      reset();
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title={mode === "assign" ? "Obuna biriktirish" : "Rejani o'zgartirish"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]"
          >
            {serverError}
          </div>
        )}
        <Select label="Tarif reja" defaultValue="" error={errors.planId?.message} {...register("planId")}>
          <option value="" disabled>
            Tanlang...
          </option>
          {plans?.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {Number(plan.priceMonthly).toLocaleString("uz-UZ")} {plan.currency}/oy
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
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
