"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Vaccination } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSection } from "@/components/ios/sheet";
import { FieldRow, TextInput } from "@/components/ios/form";
import { IOS } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  status: z.enum(["SCHEDULED", "DONE", "MISSED"]),
  doneDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Holat plitkalari — sahifadagi yorliqlar bilan bir xil rang */
const STATUS_OPTIONS: { value: FormValues["status"]; label: string; color: string }[] = [
  { value: "SCHEDULED", label: "Rejalashtirilgan", color: IOS.orange },
  { value: "DONE", label: "Bajarildi", color: IOS.green },
  { value: "MISSED", label: "O'tkazib yuborildi", color: IOS.red },
];

const DATE_INPUT = "min-h-[44px] cursor-pointer text-right [&::-webkit-date-and-time-value]:text-right";
const TEXTAREA = "block w-full resize-none bg-transparent text-[15px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]";

export function UpdateVaccinationModal({
  open,
  onClose,
  slug,
  childId,
  vaccination,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  vaccination: Vaccination;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const formId = useId();
  const ids = { doneDate: useId(), note: useId() };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      status: vaccination.status,
      doneDate: vaccination.doneDate ?? new Date().toISOString().slice(0, 10),
      note: vaccination.note ?? "",
    },
  });

  const status = watch("status");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch(`/app/vaccinations/${vaccination.id}`, {
        status: values.status,
        doneDate: values.status === "DONE" ? values.doneDate || undefined : undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccinations", slug, childId] });
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
      title={tr("Vaksinatsiyani yangilash")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={busy}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <SheetSection>
          <SheetRow label={tr("Vaksina nomi")}>
            <span className="block truncate text-[var(--color-text)]">{vaccination.name}</span>
          </SheetRow>
          <SheetRow label={tr("Rejalashtirilgan sana")}>
            <span className="tabular-nums">{formatDate(vaccination.scheduledDate)}</span>
          </SheetRow>
        </SheetSection>

        <SheetSection title={tr("Holati")}>
          <div role="radiogroup" aria-label={tr("Holati")} className="grid grid-cols-3 gap-2 p-3">
            {STATUS_OPTIONS.map((option) => {
              const active = status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setValue("status", option.value, { shouldDirty: true })}
                  className={clsx(
                    "flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1.5 py-2 text-center transition-transform active:scale-[0.96]",
                    active ? "ring-2 ring-inset ring-current" : "bg-[#767680]/[0.12]",
                  )}
                  style={active ? { backgroundColor: `${option.color}1f`, color: option.color } : undefined}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" />
                  <span className={clsx("line-clamp-2 text-[13px] leading-tight", active ? "font-semibold" : "text-[var(--color-text)]")}>{tr(option.label)}</span>
                </button>
              );
            })}
          </div>
        </SheetSection>

        <SheetSection>
          {status === "DONE" && (
            <FieldRow label={tr("Bajarilgan sana")} htmlFor={ids.doneDate}>
              <TextInput id={ids.doneDate} type="date" className={DATE_INPUT} {...register("doneDate")} />
            </FieldRow>
          )}
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
