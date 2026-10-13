"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch, Group } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

const schema = z
  .object({
    groupId: z.string().optional(),
    // Bo'sh — har bola o'z guruhi narxida (pastdagi tanlov)
    amount: z.union([z.literal(""), z.coerce.number().positive("Summa musbat bo'lishi kerak")]).optional(),
    discountAmount: z.coerce.number().min(0).optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM formatida"),
    dueDate: z.string().min(1, "Muddatni tanlang"),
  })
  .refine((v) => !v.amount || (v.discountAmount ?? 0) <= v.amount, {
    message: "Chegirma summadan katta bo'lishi mumkin emas",
    path: ["discountAmount"],
  });

type FormValues = z.infer<typeof schema>;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function BulkCreateInvoiceModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  // Butun filial uchun: har bola o'z guruhi narxida (guruh narxi bo'lmasa filial narxi)
  const [perGroupFee, setPerGroupFee] = useState(false);
  const { user } = useAuth();

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { period: currentPeriod(), groupId: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ period: currentPeriod(), groupId: "" });
    setPerGroupFee(false);
    setServerError(null);
    setResultMessage(null);
  }, [open, reset]);

  useEffect(() => {
    if (open && branch?.defaultTuitionAmount && !getValues("amount")) {
      setValue("amount", Number(branch.defaultTuitionAmount));
    }
  }, [open, branch, setValue, getValues]);

  const groupId = watch("groupId");
  const anyGroupFee = (groups ?? []).some((g) => g.status === "ACTIVE" && g.monthlyFee);
  // Guruh narxi bor bo'lsa — butun filialda sukut bo'yicha har bola o'z guruhi narxida
  useEffect(() => {
    if (open && anyGroupFee) setPerGroupFee(true);
  }, [open, anyGroupFee]);
  // Guruh tanlansa — uning narxi summaga qo'yiladi
  useEffect(() => {
    if (!groupId) return;
    const fee = groups?.find((g) => g.id === groupId)?.monthlyFee;
    const value = fee ? Number(fee) : branch?.defaultTuitionAmount ? Number(branch.defaultTuitionAmount) : null;
    if (value) setValue("amount", value);
  }, [groupId, groups, branch, setValue]);
  const usePerGroup = !groupId && perGroupFee;

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<{ createdCount: number; skippedCount: number; noFeeCount?: number }>("/app/invoices/bulk", {
        ...values,
        // Summa berilmasa — server har bolaga o'z guruhi narxini qo'yadi
        amount: usePerGroup || values.amount === "" ? undefined : values.amount,
        groupId: values.groupId || undefined,
        discountAmount: values.discountAmount || undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoices", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      setResultMessage(
        tr("{0} ta hisob-faktura yaratildi", result.createdCount) +
          (result.skippedCount > 0 ? tr(", {0} tasi shu davr uchun allaqachon bor edi", result.skippedCount) : "") +
          (result.noFeeCount ? tr(", {0} ta bolaning guruhida narx yo'q — yaratilmadi", result.noFeeCount) : ""),
      );
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={tr("Ommaviy hisob-faktura")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}
        {resultMessage && (
          <div className="rounded-lg bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]">
            {tr(resultMessage)}
          </div>
        )}
        <Select label={tr("Guruh")} defaultValue="" hint={tr("Tanlanmasa — butun filialdagi barcha faol bolalar")} {...register("groupId")}>
          <option value="">{tr("Butun filial")}</option>
          {groups?.filter((g) => g.status === "ACTIVE").map((group) => (
            <option key={group.id} value={group.id}>
              {tr(group.name)}
            </option>
          ))}
        </Select>
        {!groupId && (
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" checked={perGroupFee} onChange={(e) => setPerGroupFee(e.target.checked)} />
            <span>
              <span className="block text-[14px] font-medium text-[var(--color-text)]">{tr("Har bola o'z guruhi narxida")}</span>
              <span className="block text-[12.5px] text-[var(--color-text-muted)]">
                {anyGroupFee ? tr("Guruhlarda belgilangan oylik to'lov olinadi; narxi yo'q guruhda — filial narxi") : tr("Guruhlarda hali narx belgilanmagan — Guruhlar bo'limida qo'ying")}
              </span>
            </span>
          </label>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {usePerGroup ? (
            <div className="flex flex-col justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-hair)] px-3.5 py-2 text-[13px] text-[var(--color-text-muted)]">
              {tr("Summa — har bolaning guruhi narxi")}
            </div>
          ) : (
            <Input label={tr("Summa (UZS)")} type="number" placeholder="850000" error={errors.amount?.message} {...register("amount")} />
          )}
          <Input
            label={tr("Chegirma (ixtiyoriy)")}
            type="number"
            placeholder="0"
            error={errors.discountAmount?.message}
            {...register("discountAmount")}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={tr("Davr (YYYY-MM)")} placeholder="2026-09" error={errors.period?.message} {...register("period")} />
          <Input label={tr("To'lov muddati")} type="date" error={errors.dueDate?.message} {...register("dueDate")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Yopish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tr("Yaratish")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
