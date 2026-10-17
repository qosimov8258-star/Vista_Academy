"use client";

import { useEffect, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Employee, Shift } from "@/lib/types";
import { FieldRow, FormSection, TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { EmployeePicker } from "@/features/hr/employee-picker";
import { useTr } from "@/i18n/tr";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

const schema = z.object({
  employeeId: z.string().min(1, "Xodimni tanlang"),
  date: z.string().min(1, "Sanani tanlang"),
  hours: z.coerce.number().min(0, "Soat manfiy bo'lishi mumkin emas"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LogShiftModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: employees, isLoading: employeesLoading } = useQuery({
    // Ishdan bo'shagan xodim uchun smena qayd etilmasin.
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
    defaultValues: { employeeId: "", date: "", hours: 8, note: "" },
  });

  // Seed "today" only after mount (client-side), since the server-rendered
  // pass and the client hydration pass can disagree on the current date.
  useEffect(() => {
    if (open) {
      reset({ employeeId: "", date: todayDateString(), hours: 8, note: "" });
      setServerError(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Shift>("/app/shifts", { ...values, note: values.note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });
  const busy = isSubmitting || mutation.isPending;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Smena qo'shish")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={busy}>
          {tr("Saqlash")}
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
          <FieldRow label={tr("Sana")} htmlFor={`${formId}-date`} error={errors.date?.message}>
            <div className="flex justify-end">
              <TextInput id={`${formId}-date`} type="date" className="!w-auto text-right tabular-nums" {...register("date")} />
            </div>
          </FieldRow>
          <FieldRow label={tr("Ish soatlari")} htmlFor={`${formId}-hours`} error={errors.hours?.message}>
            <TextInput id={`${formId}-hours`} type="number" inputMode="decimal" step="0.5" placeholder="8" className="text-right tabular-nums" {...register("hours")} />
          </FieldRow>
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
