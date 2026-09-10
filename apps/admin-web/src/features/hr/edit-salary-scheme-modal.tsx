"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { SalaryScheme } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { AmountInput } from "@/components/ui/amount-input";
import { SelectMenu } from "@/components/ui/select-menu";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";

const RULE_TYPE_OPTIONS = [
  { value: "FIXED", label: "Belgilangan (oylik summa)" },
  { value: "PER_HOUR", label: "Soatiga (ish soatlari asosida)" },
  { value: "PER_CHILD", label: "Boladan (faol bolalar soni asosida)" },
];

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

  useEffect(() => {
    if (!open) return;
    if (schemeQuery.data) {
      reset({
        ruleType: schemeQuery.data.ruleType,
        fixedAmount: Number(schemeQuery.data.fixedAmount),
        rate: Number(schemeQuery.data.rate),
      });
    } else if (notFound) {
      reset({ ruleType: "FIXED", fixedAmount: 0, rate: 0 });
    }
  }, [open, schemeQuery.data, notFound, reset]);

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
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={employeeName ? `Maosh sxemasi — ${employeeName}` : "Maosh sxemasi"}
      widthClassName="max-w-md"
    >
      {schemeQuery.isLoading ? (
        <LoadingState />
      ) : realError ? (
        <ErrorState message={(schemeQuery.error as Error).message} />
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          {serverError && (
            <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {serverError}
            </div>
          )}
          <Controller
            control={control}
            name="ruleType"
            render={({ field }) => (
              <SelectMenu
                label="Hisoblash turi"
                options={RULE_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.ruleType?.message}
              />
            )}
          />

          {ruleType === "FIXED" ? (
            <Controller
              control={control}
              name="fixedAmount"
              render={({ field }) => (
                <AmountInput
                  label="Oylik summa (UZS)"
                  placeholder="2 500 000"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.fixedAmount?.message}
                />
              )}
            />
          ) : (
            <Controller
              control={control}
              name="rate"
              render={({ field }) => (
                <AmountInput
                  label={ruleType === "PER_HOUR" ? "Bir soat narxi (UZS)" : "Bir bola uchun narx (UZS)"}
                  placeholder="15 000"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.rate?.message}
                />
              )}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Saqlash
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
