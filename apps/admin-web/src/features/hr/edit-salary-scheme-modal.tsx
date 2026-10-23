"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { SalaryScheme } from "@/lib/types";
import { FieldRow, FormSection, MoneyInput } from "@/components/ios/form";
import { CheckIcon } from "@/components/ios/icons";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

const RULE_TYPE_OPTIONS = [
  { value: "FIXED", label: "Belgilangan", hint: "Oylik summa" },
  { value: "PER_HOUR", label: "Soatiga", hint: "Ish soatlari asosida" },
  { value: "PER_CHILD", label: "Boladan", hint: "Faol bolalar soni asosida" },
] as const;

const schema = z
  .object({
    ruleType: z.enum(["FIXED", "PER_HOUR", "PER_CHILD"]),
    fixedAmount: z.coerce.number().min(0).optional(),
    rate: z.coerce.number().min(0).optional(),
  })
  .refine((v) => v.ruleType !== "FIXED" || v.fixedAmount !== undefined, {
    message: "Belgilangan summani kiriting",
    path: ["fixedAmount"],
  })
  .refine((v) => v.ruleType === "FIXED" || v.rate !== undefined, {
    message: "Stavkani kiriting",
    path: ["rate"],
  });

type FormValues = z.infer<typeof schema>;

export function EditSalarySchemeModal({
  open,
  onClose,
  slug,
  employeeId,
  employeeName,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  employeeId: string;
  employeeName?: string;
}) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const schemeQuery = useQuery({
    queryKey: ["salary-scheme", slug, employeeId],
    queryFn: () => api.get<SalaryScheme>(`/app/employees/${employeeId}/salary-scheme`),
    enabled: open && !!employeeId,
    retry: false,
  });

  const notFound = schemeQuery.isError && schemeQuery.error instanceof ApiError && schemeQuery.error.status === 404;
  const realError = schemeQuery.isError && !notFound;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ruleType: "FIXED", fixedAmount: 0, rate: 0 },
  });

  // Backend sxema topilmasa 404 emas, `data: null` bilan 200 qaytaradi —
  // shuning uchun bu yerda `notFound`ga emas, `isSuccess`ga qarab tekshiramiz.
  // Aks holda: bir xodimning sxemasini ochib, keyin sxemasi yo'q boshqa
  // xodimga o'tsangiz, avvalgisining qiymatlari formada qolib ketardi —
  // saqlasangiz noto'g'ri xodimga noto'g'ri sxema yozilib qolardi.
  useEffect(() => {
    if (!open || !schemeQuery.isSuccess) return;
    if (schemeQuery.data) {
      reset({
        ruleType: schemeQuery.data.ruleType,
        fixedAmount: Number(schemeQuery.data.fixedAmount),
        rate: Number(schemeQuery.data.rate),
      });
    } else {
      reset({ ruleType: "FIXED", fixedAmount: 0, rate: 0 });
    }
  }, [open, schemeQuery.isSuccess, schemeQuery.data, reset]);

  useEffect(() => {
    if (open) setServerError(null);
  }, [open]);

  const ruleType = watch("ruleType");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<SalaryScheme>(`/app/employees/${employeeId}/salary-scheme`, {
        ruleType: values.ruleType,
        fixedAmount: values.ruleType === "FIXED" ? values.fixedAmount : undefined,
        rate: values.ruleType !== "FIXED" ? values.rate : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-scheme", slug, employeeId] });
      // Ish haqi sahifasidagi xodim qatorida sxema summasi ko'rinadi
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });
  const busy = isSubmitting || mutation.isPending;
  const ready = !schemeQuery.isLoading && !realError;

  const amountName = ruleType === "FIXED" ? "fixedAmount" : "rate";
  const amountLabel = ruleType === "FIXED" ? tr("Oylik summa") : ruleType === "PER_HOUR" ? tr("Bir soat narxi") : tr("Bir bola uchun");

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Maosh sxemasi")}
      footer={
        ready ? (
          <SheetPrimaryButton type="submit" form={formId} loading={busy}>
            {tr("Saqlash")}
          </SheetPrimaryButton>
        ) : undefined
      }
    >
      {employeeName && <p className="-mt-2 px-4 text-center text-[13px] text-[#8e8e93]">{tr(employeeName)}</p>}
      {schemeQuery.isLoading ? (
        <SkeletonRows rows={4} avatar={false} />
      ) : realError ? (
        <ErrorState message={(schemeQuery.error as Error).message} onRetry={() => schemeQuery.refetch()} retrying={schemeQuery.isFetching} />
      ) : (
        <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          {serverError && (
            <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
              {tr(serverError)}
            </p>
          )}
          <Controller
            control={control}
            name="ruleType"
            render={({ field }) => (
              <FormSection title={tr("Hisoblash turi")}>
                <div role="radiogroup" aria-label={tr("Hisoblash turi")}>
                  {RULE_TYPE_OPTIONS.map((option) => {
                    const active = field.value === option.value;
                    return (
                      <div key={option.value} className="group/row relative">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => field.onChange(option.value)}
                          className={clsx("flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] text-[var(--color-text)]">{tr(option.label)}</span>
                            <span className="block truncate text-[13px] text-[#8e8e93]">{tr(option.hint)}</span>
                          </span>
                          {active && <CheckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
                        </button>
                        <span className={ROW_SEPARATOR} aria-hidden="true" />
                      </div>
                    );
                  })}
                </div>
              </FormSection>
            )}
          />

          <FormSection>
            <FieldRow label={amountLabel} htmlFor={`${formId}-amount`} error={errors[amountName]?.message}>
              <Controller
                key={amountName}
                control={control}
                name={amountName}
                render={({ field }) => (
                  <MoneyInput
                    id={`${formId}-amount`}
                    name={field.name}
                    value={field.value === undefined ? "" : String(field.value)}
                    onChange={(digits) => field.onChange(digits ? Number(digits) : undefined)}
                    onBlur={field.onBlur}
                    placeholder={ruleType === "FIXED" ? "2 500 000" : "15 000"}
                  />
                )}
              />
            </FieldRow>
          </FormSection>
        </form>
      )}
    </IosSheet>
  );
}
