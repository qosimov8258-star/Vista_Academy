"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

const schema = z.object({
  amount: z.coerce.number().positive("Summa musbat bo'lishi kerak"),
  method: z.enum(["CASH", "BANK_TRANSFER"]),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function RecordPaymentModal({
  open,
  onClose,
  slug,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  invoice: Invoice;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const remaining = Number(invoice.amount) - Number(invoice.discountAmount) - Number(invoice.paidAmount);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { amount: remaining, method: "CASH", note: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/app/payments", { invoiceId: invoice.id, ...values, note: values.note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="To'lov qabul qilish">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <p className="text-sm text-[var(--color-text-muted)]">
          {invoice.child?.fullName} — {invoice.period} — qolgan qarz: <strong>{formatMoney(remaining, invoice.currency)}</strong>
        </p>
        <Input label="Summa" type="number" error={errors.amount?.message} {...register("amount")} />
        <Select label="To'lov usuli" error={errors.method?.message} {...register("method")}>
          <option value="CASH">Naqd</option>
          <option value="BANK_TRANSFER">Bank o'tkazmasi</option>
        </Select>
        <Input label="Izoh (ixtiyoriy)" {...register("note")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Qabul qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
