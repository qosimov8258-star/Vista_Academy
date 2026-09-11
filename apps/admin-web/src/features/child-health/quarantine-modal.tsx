"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  until: z.string().min(1, "Sana talab qilinadi"),
  reason: z.string().min(2, "Sabab kamida 2 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function QuarantineModal({
  open,
  onClose,
  slug,
  childId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
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
    mutationFn: (values: FormValues) => api.post(`/app/children/${childId}/quarantine`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child", slug, childId] });
      // Ro'yxat va guruh sahifasidagi holat belgisi ham yangilansin.
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Karantin e'lon qilish">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="Qaysi sanagacha" type="date" error={errors.until?.message} {...register("until")} />
        <Textarea label="Sabab" rows={2} placeholder="Vetryanka (suvchechak)" error={errors.reason?.message} {...register("reason")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="danger" loading={isSubmitting || mutation.isPending}>
            Karantin e'lon qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
