"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MenuEntry } from "@/lib/types";
import { FieldRow, FormSection, TextArea } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { dayMonthLabel } from "@/components/ios/day-stepper";
import { useTr } from "@/i18n/tr";

const WEEKDAY_LABELS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

type FormValues = Record<string, string>;

function fieldName(date: string, meal: "breakfast" | "lunch" | "snack") {
  return `${date}__${meal}`;
}

/** Butun hafta menyusini bir oynada to'ldirish — har kun alohida bo'limda */
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
  const tr = useTr();
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
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const busy = isSubmitting || mutation.isPending;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      cancelLabel="Bekor"
      title={tr("Haftalik menyu")}
      footer={
        <SheetPrimaryButton type="submit" form="weekly-menu-form" loading={busy}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id="weekly-menu-form" className="space-y-5" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && <p className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] text-[#d70015]">{tr(serverError)}</p>}
        {days.map((day, i) => (
          <FormSection key={day} title={`${tr(WEEKDAY_LABELS[i])} · ${dayMonthLabel(day, tr)}`}>
            <FieldRow label={tr("Nonushta")} htmlFor={fieldName(day, "breakfast")} stacked>
              <TextArea id={fieldName(day, "breakfast")} rows={1} {...register(fieldName(day, "breakfast"))} />
            </FieldRow>
            <FieldRow label={tr("Tushlik")} htmlFor={fieldName(day, "lunch")} stacked>
              <TextArea id={fieldName(day, "lunch")} rows={1} {...register(fieldName(day, "lunch"))} />
            </FieldRow>
            <FieldRow label={tr("Kechki ovqat / gazak")} htmlFor={fieldName(day, "snack")} stacked>
              <TextArea id={fieldName(day, "snack")} rows={1} {...register(fieldName(day, "snack"))} />
            </FieldRow>
          </FormSection>
        ))}
      </form>
    </IosSheet>
  );
}
