"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { FieldRow, TextInput } from "@/components/ios/form";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  scheduledDate: z.string().min(1, "Sana talab qilinadi"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Sana maydoni qator ichida — ramkasiz, qiymat o'ngda */
const DATE_INPUT = "min-h-[44px] cursor-pointer text-right [&::-webkit-date-and-time-value]:text-right";
const TEXTAREA = "block w-full resize-none bg-transparent text-[15px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]";

export function AddVaccinationModal({
  open,
  onClose,
  slug,
  childId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const formId = useId();
  const ids = { name: useId(), date: useId(), note: useId() };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Majburiy maydonlar to'lmaguncha asosiy tugma xira
  const name = watch("name") ?? "";
  const scheduledDate = watch("scheduledDate") ?? "";
  const incomplete = name.trim().length < 2 || !scheduledDate;

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/app/children/${childId}/vaccinations`, {
        name: values.name,
        scheduledDate: values.scheduledDate,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccinations", slug, childId] });
      reset();
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
      title={tr("Yangi vaksinatsiya")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={busy} dim={incomplete}>
          {tr("Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <SheetSection>
          <FieldRow label={tr("Vaksina nomi")} htmlFor={ids.name} error={errors.name?.message}>
            <TextInput
              id={ids.name}
              placeholder={tr("DPT (Difteriya, ko'k yo'tal, qoqshol)")}
              autoComplete="off"
              className="min-h-[44px] text-right"
              {...register("name")}
            />
          </FieldRow>
          <FieldRow label={tr("Rejalashtirilgan sana")} htmlFor={ids.date} error={errors.scheduledDate?.message}>
            <TextInput id={ids.date} type="date" className={DATE_INPUT} {...register("scheduledDate")} />
          </FieldRow>
        </SheetSection>

        <SheetSection>
          <FieldRow label={tr("Izoh")} htmlFor={ids.note} stacked>
            <textarea id={ids.note} rows={2} placeholder={tr("Ixtiyoriy")} className={TEXTAREA} {...register("note")} />
          </FieldRow>
        </SheetSection>

        {serverError && (
          <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}
      </form>
    </IosSheet>
  );
}
