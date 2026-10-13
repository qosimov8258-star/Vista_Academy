"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { DevelopmentAssessment } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSection } from "@/components/ios/sheet";
import { FieldRow } from "@/components/ios/form";
import { IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

const ratingField = z.enum(["BELOW_EXPECTED", "ON_TRACK", "ABOVE_EXPECTED", ""]).optional();

const schema = z.object({
  speechRating: ratingField,
  motorRating: ratingField,
  socialRating: ratingField,
  cognitiveRating: ratingField,
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;
type RatingKey = "speechRating" | "motorRating" | "socialRating" | "cognitiveRating";
type Rating = Exclude<FormValues[RatingKey], "" | undefined>;

/** Baholanadigan sohalar — avvalgi tartibda */
const AREAS: { key: RatingKey; label: string }[] = [
  { key: "speechRating", label: "Nutq" },
  { key: "motorRating", label: "Motorika" },
  { key: "socialRating", label: "Ijtimoiy ko'nikma" },
  { key: "cognitiveRating", label: "Bilim / idrok" },
];

/** Baho plitkalari — sahifadagi yorliqlar bilan bir xil rang */
const RATINGS: { value: Rating; label: string; color: string }[] = [
  { value: "BELOW_EXPECTED", label: "Kutilganidan past", color: IOS.red },
  { value: "ON_TRACK", label: "Yoshiga mos", color: IOS.green },
  { value: "ABOVE_EXPECTED", label: "Kutilganidan yuqori", color: IOS.blue },
];

const TEXTAREA = "block w-full resize-none bg-transparent text-[15px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function EditDevelopmentModal({
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
  existing: DevelopmentAssessment | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const period = existing?.period ?? currentPeriod();
  const formId = useId();
  const noteId = useId();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      speechRating: existing?.speechRating ?? "",
      motorRating: existing?.motorRating ?? "",
      socialRating: existing?.socialRating ?? "",
      cognitiveRating: existing?.cognitiveRating ?? "",
      note: existing?.note ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/app/development", {
        childId,
        period,
        speechRating: values.speechRating || undefined,
        motorRating: values.motorRating || undefined,
        socialRating: values.socialRating || undefined,
        cognitiveRating: values.cognitiveRating || undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development", slug, childId] });
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
      title={tr("Rivojlanishni baholash")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={busy}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <SheetSection>
          <SheetRow label={tr("Davr")}>
            <span className="tabular-nums text-[var(--color-text)]">{period}</span>
          </SheetRow>
        </SheetSection>

        <SheetSection footer={tr("Tanlangan bahoni qayta bossangiz, «Baholanmagan» bo'ladi.")}>
          {AREAS.map((area) => {
            const value = watch(area.key);
            const current = RATINGS.find((r) => r.value === value);
            return (
              <div key={area.key} className="group/row relative px-4 pb-3 pt-3">
                <div className="mb-2.5 flex min-h-[24px] items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] text-[var(--color-text)]">{tr(area.label)}</span>
                  <span className="shrink-0 text-[13px]" style={{ color: current ? current.color : IOS.gray }}>
                    {tr(current ? current.label : "Baholanmagan")}
                  </span>
                </div>
                <div role="radiogroup" aria-label={tr(area.label)} className="grid grid-cols-3 gap-2">
                  {RATINGS.map((rating) => {
                    const active = value === rating.value;
                    return (
                      <button
                        key={rating.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setValue(area.key, active ? "" : rating.value, { shouldDirty: true })}
                        className={clsx(
                          "flex min-h-[48px] min-w-0 items-center justify-center rounded-[12px] px-1.5 py-1.5 text-center transition-transform active:scale-[0.96]",
                          active ? "ring-2 ring-inset ring-current" : "bg-[#767680]/[0.12] text-[var(--color-text)]",
                        )}
                        style={active ? { backgroundColor: `${rating.color}1f`, color: rating.color } : undefined}
                      >
                        <span className={clsx("line-clamp-2 text-[13px] leading-tight", active && "font-semibold")}>{tr(rating.label)}</span>
                      </button>
                    );
                  })}
                </div>
                <span className={ROW_SEPARATOR} aria-hidden="true" />
              </div>
            );
          })}
        </SheetSection>

        <SheetSection>
          <FieldRow label={tr("Izoh")} htmlFor={noteId} stacked>
            <textarea id={noteId} rows={3} placeholder={tr("Ixtiyoriy")} className={TEXTAREA} {...register("note")} />
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
