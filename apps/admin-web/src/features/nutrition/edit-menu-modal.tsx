"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MenuEntry } from "@/lib/types";
import { FieldRow, FormSection, TextArea } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { dayMonthLabel, WEEKDAYS } from "@/components/ios/day-stepper";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  breakfast: z.string().optional(),
  lunch: z.string().optional(),
  snack: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Bir kunlik menyu: nonushta, tushlik, kechki ovqat / gazak */
export function EditMenuModal({
  open,
  onClose,
  slug,
  date,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  date: string;
  entry: MenuEntry | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { breakfast: entry?.breakfast ?? "", lunch: entry?.lunch ?? "", snack: entry?.snack ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post<MenuEntry>("/app/menu", { date, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const busy = isSubmitting || mutation.isPending;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      cancelLabel="Bekor"
      title={`${tr(weekday)}, ${dayMonthLabel(date, tr)}`}
      footer={
        <SheetPrimaryButton type="submit" form="edit-menu-form" loading={busy}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id="edit-menu-form" className="space-y-5" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && <p className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] text-[#d70015]">{tr(serverError)}</p>}
        <FormSection title={tr("Menyu")} footer={tr("Taomlarni vergul bilan yozing — allergiyasi bor bolalar uchun ogohlantirish shu so'zlardan topiladi.")}>
          <FieldRow label={tr("Nonushta")} htmlFor="menu-breakfast" stacked>
            <TextArea id="menu-breakfast" placeholder={tr("Sutli botqa, non, choy")} {...register("breakfast")} />
          </FieldRow>
          <FieldRow label={tr("Tushlik")} htmlFor="menu-lunch" stacked>
            <TextArea id="menu-lunch" placeholder={tr("Sho'rva, osh, salat")} {...register("lunch")} />
          </FieldRow>
          <FieldRow label={tr("Kechki ovqat / gazak")} htmlFor="menu-snack" stacked>
            <TextArea id="menu-snack" placeholder={tr("Meva, kefir")} {...register("snack")} />
          </FieldRow>
        </FormSection>
      </form>
    </IosSheet>
  );
}
