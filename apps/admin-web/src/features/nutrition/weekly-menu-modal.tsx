"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MenuEntry } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

type FormValues = Record<string, string>;

function fieldName(date: string, meal: "breakfast" | "lunch" | "snack") {
  return `${date}__${meal}`;
}

export function WeeklyMenuModal({
  open,
  onClose,
  slug,
  days,
  entryByDate,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  /** Haftaning 7 ta sanasi, dushanbadan boshlab. */
  days: string[];
  entryByDate: Map<string, MenuEntry>;
}) {
  const t = useTranslations("nutrition");
  const WEEKDAY_LABELS = t.raw("weekdays") as string[];
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues = days.reduce<FormValues>((acc, day) => {
    const entry = entryByDate.get(day);
    acc[fieldName(day, "breakfast")] = entry?.breakfast ?? "";
    acc[fieldName(day, "lunch")] = entry?.lunch ?? "";
    acc[fieldName(day, "snack")] = entry?.snack ?? "";
    return acc;
  }, {});

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ values: defaultValues });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await Promise.all(
        days.map((day) =>
          api.post<MenuEntry>("/app/menu", {
            date: day,
            breakfast: values[fieldName(day, "breakfast")] || undefined,
            lunch: values[fieldName(day, "lunch")] || undefined,
            snack: values[fieldName(day, "snack")] || undefined,
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("weeklyMenuTitle")}>
      <form className="space-y-5" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {days.map((day, i) => (
            <div key={day} className="space-y-3 border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {WEEKDAY_LABELS[i]} <span className="font-normal text-[var(--color-text-muted)]">— {formatDate(day)}</span>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Textarea label={t("breakfastLabel")} rows={2} {...register(fieldName(day, "breakfast"))} />
                <Textarea label={t("lunchLabel")} rows={2} {...register(fieldName(day, "lunch"))} />
                <Textarea label={t("snackLabel")} rows={2} {...register(fieldName(day, "snack"))} />
              </div>
            </div>
          ))}
        </div>

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
