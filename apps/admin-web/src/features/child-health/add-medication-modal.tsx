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
  medicationName: z.string().min(2, "Nomi kamida 2 belgi"),
  dose: z.string().min(1, "Doza talab qilinadi"),
  givenAt: z.string().min(1, "Sana/vaqt talab qilinadi"),
  parentAuthorized: z.boolean(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function nowForInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function AddMedicationModal({
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
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { medicationName: "", dose: "", givenAt: nowForInput(), parentAuthorized: false, note: "" },
  });

  const parentAuthorized = watch("parentAuthorized");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/app/children/${childId}/medications`, {
        medicationName: values.medicationName,
        dose: values.dose,
        givenAt: new Date(values.givenAt).toISOString(),
        parentAuthorized: values.parentAuthorized,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications", slug, childId] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi dori-darmon yozuvi">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="Dori nomi" placeholder="Paratsetamol" error={errors.medicationName?.message} {...register("medicationName")} />
        <Input label="Doza" placeholder="5 ml" error={errors.dose?.message} {...register("dose")} />
        <Input label="Berilgan sana/vaqt" type="datetime-local" error={errors.givenAt?.message} {...register("givenAt")} />

        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" {...register("parentAuthorized")} />
          Ota-ona rasman ruxsat bergan
        </label>
        {!parentAuthorized && (
          <div className="rounded-lg bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-warning)]">
            Diqqat: ota-ona ruxsati belgilanmagan. Baribir saqlashingiz mumkin, lekin bu xavfsizlik nuqtai nazaridan muhim maydon.
          </div>
        )}

        <Textarea label="Izoh (ixtiyoriy)" rows={2} {...register("note")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Qo'shish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
