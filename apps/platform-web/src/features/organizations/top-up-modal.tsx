"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  amount: z.coerce.number().positive("Summa musbat bo'lishi kerak"),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function TopUpModal({
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
      api.post(`/platform/organizations/${organizationId}/wallet/top-up`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      reset();
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title="Hamyonni to'ldirish">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input
          label="Summa (UZS)"
          type="number"
          placeholder="5000000"
          error={errors.amount?.message}
          {...register("amount")}
        />
        <Input label="Izoh (ixtiyoriy)" placeholder="Bank o'tkazmasi, shartnoma #..." {...register("note")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            To&apos;ldirish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
