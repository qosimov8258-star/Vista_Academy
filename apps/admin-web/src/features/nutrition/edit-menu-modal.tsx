"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MenuEntry } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const schema = z.object({
  breakfast: z.string().optional(),
  lunch: z.string().optional(),
  snack: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditMenuModal({
  open,
  onClose,
  slug,
  date,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  date: string;
  entry: MenuEntry | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { breakfast: entry?.breakfast ?? "", lunch: entry?.lunch ?? "", snack: entry?.snack ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post<MenuEntry>("/app/menu", { date, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Menyu — ${formatDate(date)}`}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Textarea label="Nonushta" placeholder="Sutli botqa, non, choy" rows={2} {...register("breakfast")} />
        <Textarea label="Tushlik" placeholder="Sho'rva, osh, salat" rows={2} {...register("lunch")} />
        <Textarea label="Kechki ovqat / gazak" placeholder="Meva, kefir" rows={2} {...register("snack")} />

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
