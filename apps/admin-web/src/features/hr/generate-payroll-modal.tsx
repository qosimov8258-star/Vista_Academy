"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { Employee, PayrollEntry } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function currentPeriodString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export function GeneratePayrollModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const t = useTranslations("hr");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    employeeId: z.string().min(1, t("validation.selectEmployee")),
    period: z.string().regex(/^\d{4}-\d{2}$/, t("validation.periodFormat")),
    bonusAmount: z.coerce.number().min(0).optional(),
    penaltyAmount: z.coerce.number().min(0).optional(),
    deductionAmount: z.coerce.number().min(0).optional(),
    note: z.string().optional(),
  });

  type FormValues = z.infer<typeof schema>;

  const { data: employees } = useQuery({
    // Ishdan bo'shagan xodimga oylik hisoblanmasin.
    queryKey: ["employees", slug, "active"],
    queryFn: () => api.get<Employee[]>("/app/employees?isActive=true"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employeeId: "", period: "", bonusAmount: 0, penaltyAmount: 0, deductionAmount: 0, note: "" },
  });

  // Seed the current period only after mount (client-side) to avoid a
  // server/client hydration mismatch on the initial render.
  useEffect(() => {
    if (open) {
      reset({ employeeId: "", period: currentPeriodString(), bonusAmount: 0, penaltyAmount: 0, deductionAmount: 0, note: "" });
      setServerError(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<PayrollEntry>("/app/payroll", {
        ...values,
        bonusAmount: values.bonusAmount || undefined,
        penaltyAmount: values.penaltyAmount || undefined,
        deductionAmount: values.deductionAmount || undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("generatePayrollTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label={t("employeeLabel")} defaultValue="" error={errors.employeeId?.message} {...register("employeeId")}>
          <option value="" disabled>
            {t("choose")}
          </option>
          {employees?.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </Select>
        <Input label={t("periodLabel")} placeholder="2026-09" error={errors.period?.message} {...register("period")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t("bonusLabel")}
            type="number"
            placeholder="0"
            error={errors.bonusAmount?.message}
            {...register("bonusAmount")}
          />
          <Input
            label={t("penaltyLabel")}
            type="number"
            placeholder="0"
            error={errors.penaltyAmount?.message}
            {...register("penaltyAmount")}
          />
        </div>
        <Input
          label={t("deductionLabel")}
          type="number"
          placeholder="0"
          hint={t("deductionHint")}
          error={errors.deductionAmount?.message}
          {...register("deductionAmount")}
        />
        <Input label={t("noteLabelOptional")} {...register("note")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {t("calculate")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
