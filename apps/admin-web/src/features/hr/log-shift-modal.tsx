"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { Employee, Shift } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

export function LogShiftModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const t = useTranslations("hr");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    employeeId: z.string().min(1, t("validation.selectEmployee")),
    date: z.string().min(1, t("validation.selectDate")),
    hours: z.coerce.number().min(0, t("validation.hoursNonNegative")),
    note: z.string().optional(),
  });

  type FormValues = z.infer<typeof schema>;

  const { data: employees } = useQuery({
    // Ishdan bo'shagan xodim uchun smena qayd etilmasin.
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
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("addShiftTitle")}>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t("dateLabel")} type="date" error={errors.date?.message} {...register("date")} />
          <Input label={t("workHoursLabel")} type="number" step="0.5" placeholder="8" error={errors.hours?.message} {...register("hours")} />
        </div>
        <Input label={t("noteLabelOptional")} {...register("note")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
