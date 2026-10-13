"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { HealthProfile } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { FieldRow } from "@/components/ios/form";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  bloodType: z.enum([
    "A_POSITIVE",
    "A_NEGATIVE",
    "B_POSITIVE",
    "B_NEGATIVE",
    "AB_POSITIVE",
    "AB_NEGATIVE",
    "O_POSITIVE",
    "O_NEGATIVE",
    "",
  ]),
  chronicConditions: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export const BLOOD_TYPE_LABEL: Record<string, string> = {
  A_POSITIVE: "A(II) Rh+",
  A_NEGATIVE: "A(II) Rh-",
  B_POSITIVE: "B(III) Rh+",
  B_NEGATIVE: "B(III) Rh-",
  AB_POSITIVE: "AB(IV) Rh+",
  AB_NEGATIVE: "AB(IV) Rh-",
  O_POSITIVE: "O(I) Rh+",
  O_NEGATIVE: "O(I) Rh-",
};

const FILL = "bg-[#767680]/[0.12]";
const TEXTAREA = "block w-full resize-none bg-transparent text-[15px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]";

/**
 * Sog'liq profili varag'i: qon guruhi — 8 ta kapsula (4×2) va «Kiritilmagan»,
 * so'ng allergiya, surunkali kasallik va izoh — chegarasiz matn maydonlari.
 */
export function EditHealthProfileModal({
  open,
  onClose,
  slug,
  childId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  existing: HealthProfile | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const formId = useId();
  const ids = { allergies: useId(), chronic: useId(), notes: useId() };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      bloodType: existing?.bloodType ?? "",
      chronicConditions: existing?.chronicConditions ?? "",
      allergies: existing?.allergies ?? "",
      notes: existing?.notes ?? "",
    },
  });

  const bloodType = watch("bloodType");
  const pickBloodType = (value: FormValues["bloodType"]) => setValue("bloodType", value, { shouldDirty: true });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/app/children/${childId}/health`, {
        bloodType: values.bloodType || undefined,
        chronicConditions: values.chronicConditions || undefined,
        allergies: values.allergies || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-health", slug, childId] });
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
      title={tr("Sog'liq profili")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={busy}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <SheetSection title={tr("Qon guruhi")}>
          <div role="radiogroup" aria-label={tr("Qon guruhi")} className="grid grid-cols-4 gap-2 p-3">
            <button
              type="button"
              role="radio"
              aria-checked={!bloodType}
              onClick={() => pickBloodType("")}
              className={clsx(
                "col-span-4 flex h-11 items-center justify-center rounded-full px-3 text-[15px] font-semibold transition-transform active:scale-[0.96]",
                !bloodType ? "bg-[var(--color-primary)] text-white" : clsx(FILL, "text-[var(--color-text)]"),
              )}
            >
              {tr("Kiritilmagan")}
            </button>
            {Object.entries(BLOOD_TYPE_LABEL).map(([value, label]) => {
              const active = bloodType === value;
              const [group, rh] = label.split(" ");
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={tr(label)}
                  onClick={() => pickBloodType(value as FormValues["bloodType"])}
                  className={clsx(
                    "flex min-h-[52px] min-w-0 flex-col items-center justify-center rounded-[14px] px-1 py-1.5 leading-tight transition-transform active:scale-[0.96]",
                    active ? "bg-[var(--color-primary)] text-white" : clsx(FILL, "text-[var(--color-text)]"),
                  )}
                >
                  <span className="truncate text-[15px] font-semibold">{group}</span>
                  <span className={clsx("text-[12.5px] tabular-nums", active ? "text-white/85" : "text-[#8e8e93]")}>{rh}</span>
                </button>
              );
            })}
          </div>
        </SheetSection>

        <SheetSection>
          <FieldRow label={tr("Allergiyalar")} htmlFor={ids.allergies} stacked>
            <textarea id={ids.allergies} rows={2} placeholder={tr("Ixtiyoriy")} className={TEXTAREA} {...register("allergies")} />
          </FieldRow>
          <FieldRow label={tr("Surunkali kasalliklar")} htmlFor={ids.chronic} stacked>
            <textarea id={ids.chronic} rows={2} placeholder={tr("Ixtiyoriy")} className={TEXTAREA} {...register("chronicConditions")} />
          </FieldRow>
          <FieldRow label={tr("Qo'shimcha izoh")} htmlFor={ids.notes} stacked>
            <textarea id={ids.notes} rows={2} placeholder={tr("Ixtiyoriy")} className={TEXTAREA} {...register("notes")} />
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
