"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DevelopmentAssessment } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ratingField = z.enum(["BELOW_EXPECTED", "ON_TRACK", "ABOVE_EXPECTED", ""]).optional();

const schema = z.object({
  speechRating: ratingField,
  motorRating: ratingField,
  socialRating: ratingField,
  cognitiveRating: ratingField,
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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
  const t = useTranslations("development");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const period = existing?.period ?? currentPeriod();

  const {
    register,
    handleSubmit,
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
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("modalTitle", { period })}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label={t("speechLabel")} defaultValue="" {...register("speechRating")}>
            <option value="">{t("notRated")}</option>
            <option value="BELOW_EXPECTED">{t("rating.belowExpected")}</option>
            <option value="ON_TRACK">{t("rating.onTrack")}</option>
            <option value="ABOVE_EXPECTED">{t("rating.aboveExpected")}</option>
          </Select>
          <Select label={t("motorLabel")} defaultValue="" {...register("motorRating")}>
            <option value="">{t("notRated")}</option>
            <option value="BELOW_EXPECTED">{t("rating.belowExpected")}</option>
            <option value="ON_TRACK">{t("rating.onTrack")}</option>
            <option value="ABOVE_EXPECTED">{t("rating.aboveExpected")}</option>
          </Select>
          <Select label={t("socialLabel")} defaultValue="" {...register("socialRating")}>
            <option value="">{t("notRated")}</option>
            <option value="BELOW_EXPECTED">{t("rating.belowExpected")}</option>
            <option value="ON_TRACK">{t("rating.onTrack")}</option>
            <option value="ABOVE_EXPECTED">{t("rating.aboveExpected")}</option>
          </Select>
          <Select label={t("cognitiveLabel")} defaultValue="" {...register("cognitiveRating")}>
            <option value="">{t("notRated")}</option>
            <option value="BELOW_EXPECTED">{t("rating.belowExpected")}</option>
            <option value="ON_TRACK">{t("rating.onTrack")}</option>
            <option value="ABOVE_EXPECTED">{t("rating.aboveExpected")}</option>
          </Select>
        </div>
        <Textarea label={t("noteLabel")} rows={3} {...register("note")} />

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
