"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { SalaryScheme } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";

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
    register,
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
    <Modal open={open} onClose={onClose} title={employeeName ? `Maosh sxemasi — ${employeeName}` : "Maosh sxemasi"}>
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
          <Select label="Hisoblash turi" error={errors.ruleType?.message} {...register("ruleType")}>
            <option value="FIXED">Belgilangan (oylik summa)</option>
            <option value="PER_HOUR">Soatiga (ish soatlari asosida)</option>
            <option value="PER_CHILD">Boladan (faol bolalar soni asosida)</option>
          </Select>

          {ruleType === "FIXED" ? (
            <Input
              label="Oylik summa (UZS)"
              type="number"
              placeholder="2500000"
              error={errors.fixedAmount?.message}
              {...register("fixedAmount")}
            />
          ) : (
            <Input
              label={ruleType === "PER_HOUR" ? "Bir soat narxi (UZS)" : "Bir bola uchun narx (UZS)"}
              type="number"
              placeholder="15000"
              error={errors.rate?.message}
              {...register("rate")}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
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
