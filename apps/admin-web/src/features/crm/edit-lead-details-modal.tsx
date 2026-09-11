"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  followUpDate: z.string().optional(),
  trialDate: z.string().optional(),
  contractDate: z.string().optional(),
  contractNote: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditLeadDetailsModal({
  open,
  onClose,
  slug,
  leadId,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  leadId: string;
  lead: Lead;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      followUpDate: lead.followUpDate?.slice(0, 10) ?? "",
      trialDate: lead.trialDate?.slice(0, 10) ?? "",
      contractDate: lead.contractDate?.slice(0, 10) ?? "",
      contractNote: lead.contractNote ?? "",
    },
  });

  const mutation = useMutation({
    // Bo'sh qoldirilgan maydon `null` bilan yuboriladi (`undefined` emas) —
    // `undefined` kalitlari JSON'ga chiqmaydi va backend uni "o'zgarmasin"
    // deb tushunadi, `null` esa "tozala" deb. Aks holda bir marta sana
    // kiritilgach uni hech qachon tozalab bo'lmas edi.
    mutationFn: (values: FormValues) =>
      api.patch<Lead>(`/app/leads/${leadId}/details`, {
        followUpDate: values.followUpDate || null,
        trialDate: values.trialDate || null,
        contractDate: values.contractDate || null,
        contractNote: values.contractNote || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Tafsilotlarni tahrirlash">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Keyingi bog'lanish sanasi" type="date" {...register("followUpDate")} />
          <Input label="Sinov kuni" type="date" {...register("trialDate")} />
        </div>
        <Input label="Shartnoma sanasi" type="date" {...register("contractDate")} />
        <Textarea label="Shartnoma izohi" rows={3} placeholder="Shartlar, oylik to'lov, izoh..." {...register("contractNote")} />

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
