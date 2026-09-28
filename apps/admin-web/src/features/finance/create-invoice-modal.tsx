"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch, Invoice } from "@/lib/types";
import type { GroupChildRow, GroupPaymentSummary } from "@/features/cash/shared";
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { period: currentPeriod() },
  });

  // Avval guruh, keyin shu guruhdagi bolalar. Tanlangan davr uchun hisob-fakturasi
  // borlar belgilanib turadi, hisob-fakturasizlari oddiy ro'yxatda qoladi.
  const period = watch("period");
  const [groupId, setGroupId] = useState("");
  const validPeriod = /^\d{4}-\d{2}$/.test(period ?? "");
  const { data: groups } = useQuery({
    queryKey: ["cash-groups", slug, period],
    queryFn: () => api.get<{ groups: GroupPaymentSummary[] }>(`/app/cash/groups?period=${period}`),
    enabled: open && validPeriod,
  });
  const { data: groupChildren } = useQuery({
    queryKey: ["cash-group-children", slug, groupId, period],
    queryFn: () => api.get<{ children: GroupChildRow[] }>(`/app/cash/groups/${groupId}?period=${period}`),
    enabled: open && validPeriod && !!groupId,
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
      setGroupId("");
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi hisob-faktura">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="font-heading text-center text-[28px] font-extrabold tracking-tight text-[var(--color-primary)]">
          Vista Academy
        </h1>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select
          label="Guruh"
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            setValue("childId", "");
          }}
        >
          <option value="" disabled>
            Guruhni tanlang
          </option>
          {groups?.groups.map((g) => (
            <option key={g.groupId} value={g.groupId}>
              {g.name} ({g.total} bola)
            </option>
          ))}
        </Select>
        <Select label="Bola" defaultValue="" disabled={!groupId} error={errors.childId?.message} {...register("childId")}>
          <option value="" disabled>
            {groupId ? "Bolani tanlang" : "Avval guruhni tanlang"}
          </option>
          {groupChildren?.children.map((child) => (
            <option key={child.childId} value={child.childId}>
              {child.childName}
              {child.state === "PAID" ? "  ✓ to'lagan" : child.state !== "NONE" ? "  ✓ hisob-faktura bor" : ""}
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
