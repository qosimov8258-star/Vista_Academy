"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Vaccination } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  status: z.enum(["SCHEDULED", "DONE", "MISSED"]),
  doneDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function UpdateVaccinationModal({
  open,
  onClose,
  slug,
  childId,
  vaccination,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  vaccination: Vaccination;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      status: vaccination.status,
      doneDate: vaccination.doneDate ?? new Date().toISOString().slice(0, 10),
      note: vaccination.note ?? "",
    },
  });

  const status = watch("status");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch(`/app/vaccinations/${vaccination.id}`, {
        status: values.status,
        doneDate: values.status === "DONE" ? values.doneDate || undefined : undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccinations", slug, childId] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Vaksinatsiyani yangilash — ${vaccination.name}`}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Holati" {...register("status")}>
          <option value="SCHEDULED">Rejalashtirilgan</option>
          <option value="DONE">Bajarildi</option>
          <option value="MISSED">O'tkazib yuborildi</option>
        </Select>
        {status === "DONE" && <Input label="Bajarilgan sana" type="date" {...register("doneDate")} />}
        <Textarea label="Izoh (ixtiyoriy)" rows={2} {...register("note")} />

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
