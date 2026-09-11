"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Branch, Child, Invoice } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z
  .object({
    childId: z.string().min(1, "Bolani tanlang"),
    amount: z.coerce.number().positive("Summa musbat bo'lishi kerak"),
    discountAmount: z.coerce.number().min(0).optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM formatida"),
    dueDate: z.string().min(1, "Muddatni tanlang"),
  })
  .refine((v) => (v.discountAmount ?? 0) <= v.amount, {
    message: "Chegirma summadan katta bo'lishi mumkin emas",
    path: ["discountAmount"],
  });

type FormValues = z.infer<typeof schema>;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function CreateInvoiceModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { user } = useAuth();

  const { data: children } = useQuery({
    queryKey: ["children", slug, "all"],
    queryFn: () => getPaginated<Child>("/app/children?page=1&limit=100"),
    enabled: open,
  });

  const { data: branch } = useQuery({
    queryKey: ["branch", slug, user?.branchId],
    queryFn: () => api.get<Branch>(`/app/organizations/me/branches/${user!.branchId}`),
    enabled: open && !!user?.branchId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { period: currentPeriod() },
  });

  // Filialning standart to'lov summasi qo'yilgan bo'lsa — foydalanuvchi hali
  // qo'lda hech narsa kiritmagan bo'lsa, shuni taklif qilamiz.
  useEffect(() => {
    if (open && branch?.defaultTuitionAmount && !getValues("amount")) {
      setValue("amount", Number(branch.defaultTuitionAmount));
    }
  }, [open, branch, setValue, getValues]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Invoice>("/app/invoices", { ...values, discountAmount: values.discountAmount || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi hisob-faktura">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Bola" defaultValue="" error={errors.childId?.message} {...register("childId")}>
          <option value="" disabled>
            Tanlang
          </option>
          {children?.data.map((child) => (
            <option key={child.id} value={child.id}>
              {child.fullName}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Summa (UZS)" type="number" placeholder="850000" error={errors.amount?.message} {...register("amount")} />
          <Input
            label="Chegirma (ixtiyoriy)"
            type="number"
            placeholder="0"
            hint="Masalan ko'p farzandli oila uchun"
            error={errors.discountAmount?.message}
            {...register("discountAmount")}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Davr (YYYY-MM)" placeholder="2026-09" error={errors.period?.message} {...register("period")} />
          <Input label="To'lov muddati" type="date" error={errors.dueDate?.message} {...register("dueDate")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
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
