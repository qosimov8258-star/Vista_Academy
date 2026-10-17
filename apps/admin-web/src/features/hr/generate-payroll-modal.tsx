"use client";

import { useEffect, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Employee, PayrollEntry } from "@/lib/types";
import { FieldRow, FormSection, MoneyInput, TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { EmployeePicker } from "@/features/hr/employee-picker";
import { useTr } from "@/i18n/tr";

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

const schema = z.object({
  employeeId: z.string().min(1, "Xodimni tanlang"),
  period: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM formatida"),
  bonusAmount: z.coerce.number().min(0).optional(),
  penaltyAmount: z.coerce.number().min(0).optional(),
  deductionAmount: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Ixtiyoriy summa: 0 bo'sh maydon bo'lib ko'rinadi (placeholder "0") */
const moneyValue = (value: number | undefined) => (value ? String(value) : "");
const toNumber = (digits: string) => (digits ? Number(digits) : 0);

export function GeneratePayrollModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: employees, isLoading: employeesLoading } = useQuery({
    // Ishdan bo'shagan xodimga oylik hisoblanmasin.
    queryKey: ["employees", slug, "active"],
    queryFn: () => api.get<Employee[]>("/app/employees?isActive=true"),
    enabled: open,
  });

  const {
    control,
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
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });
  const busy = isSubmitting || mutation.isPending;

  const moneyRow = (name: "bonusAmount" | "penaltyAmount" | "deductionAmount", label: string) => (
    <FieldRow label={label} htmlFor={`${formId}-${name}`} error={errors[name]?.message}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <MoneyInput
            id={`${formId}-${name}`}
            name={field.name}
            value={moneyValue(field.value)}
            onChange={(digits) => field.onChange(toNumber(digits))}
            onBlur={field.onBlur}
            placeholder="0"
          />
        )}
      />
    </FieldRow>
  );

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Ish haqi hisoblash")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={busy}>
          {tr("Hisoblash")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}
        <FormSection>
          <FieldRow label={tr("Xodim")} error={errors.employeeId?.message}>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <EmployeePicker
                  title={tr("Xodim")}
                  value={field.value}
                  onChange={field.onChange}
                  employees={employees ?? []}
                  loading={employeesLoading}
                  placeholder={tr("Tanlang")}
                />
              )}
            />
          </FieldRow>
          <FieldRow label={tr("Davr")} htmlFor={`${formId}-period`} error={errors.period?.message}>
            <div className="flex justify-end">
              <TextInput id={`${formId}-period`} type="month" placeholder="2026-09" className="!w-auto text-right tabular-nums" {...register("period")} />
            </div>
          </FieldRow>
        </FormSection>

        <FormSection
          title={tr("Qo'shimcha (ixtiyoriy)")}
          footer={tr("Soliq, sug'urta, avans kabi rasmiy ushlab qolish — jarimadan alohida")}
        >
          {moneyRow("bonusAmount", tr("Mukofot"))}
          {moneyRow("penaltyAmount", tr("Jarima"))}
          {moneyRow("deductionAmount", tr("Ushlab qolish"))}
        </FormSection>

        <FormSection>
          <FieldRow label={tr("Izoh")} htmlFor={`${formId}-note`}>
            <TextInput id={`${formId}-note`} placeholder={tr("Ixtiyoriy")} className="text-right" {...register("note")} />
          </FieldRow>
        </FormSection>
      </form>
    </IosSheet>
  );
}
