"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  address: z.string().optional(),
  managerFullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  managerEmail: z.string().email("Email formati noto'g'ri"),
  managerPassword: z.string().min(8, "Kamida 8 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function CreateBranchModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
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
      api.post<Branch>("/app/organizations/me/branches", { ...values, address: values.address || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
      queryClient.invalidateQueries({ queryKey: ["tenant-users", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi filial (bog'cha)">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="Filial nomi" placeholder="Yunusobod filiali" error={errors.name?.message} {...register("name")} />
        <Input label="Manzil" placeholder="Toshkent sh., Yunusobod tumani" {...register("address")} />

        <div className="border-t border-[var(--color-border)] pt-4">
          <p className="mb-3 text-sm font-medium text-[var(--color-text)]">Filial menejeri</p>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Bu filialni boshqaradigan menejerning login ma&apos;lumotlari — filial bilan birga bir vaqtda yaratiladi.
          </p>
          <div className="space-y-4">
            <Input
              label="Menejer to'liq ismi"
              placeholder="Aziz Rahimov"
              error={errors.managerFullName?.message}
              {...register("managerFullName")}
            />
            <Input
              label="Login email"
              type="email"
              placeholder="menejer@tarmoq.uz"
              error={errors.managerEmail?.message}
              {...register("managerEmail")}
            />
            <Input
              label="Parol"
              type="password"
              placeholder="Kamida 8 belgi"
              error={errors.managerPassword?.message}
              {...register("managerPassword")}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
