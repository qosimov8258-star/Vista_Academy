"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  address: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function AddBranchModal({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Branch>(`/platform/organizations/${organizationId}/branches`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      reset();
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi filial qo'shish">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]"
          >
            {serverError}
          </div>
        )}
        <Input label="Filial nomi" placeholder="Yunusobod filiali" error={errors.name?.message} {...register("name")} />
        <Input label="Manzil (ixtiyoriy)" placeholder="Yunusobod tumani, 12-uy" {...register("address")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Qo&apos;shish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
