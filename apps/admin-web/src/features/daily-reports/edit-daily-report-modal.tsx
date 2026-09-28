"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DailyReport, HealthProfile } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  eatingQuality: z.enum(["GOOD", "AVERAGE", "POOR", ""]).optional(),
  sleepMinutes: z.coerce.number().int().min(0).optional().or(z.literal("")),
  mood: z.enum(["HAPPY", "NEUTRAL", "UPSET", ""]).optional(),
  toiletNotes: z.string().optional(),
  activityNotes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditDailyReportModal({
  open,
  onClose,
  slug,
  branchId,
  date,
  childId,
  childName,
  report,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string;
  date: string;
  childId: string;
  childName: string;
  report: DailyReport | null;
}) {
  const t = useTranslations("dailyReports");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const healthQuery = useQuery({
    queryKey: ["child-health", slug, childId],
    queryFn: () => api.get<HealthProfile | null>(`/app/children/${childId}/health`),
    enabled: open,
  });
  const health = healthQuery.data;
  const hasWarning = !!(health?.allergies || health?.chronicConditions);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      eatingQuality: report?.eatingQuality ?? "",
      sleepMinutes: report?.sleepMinutes ?? "",
      mood: report?.mood ?? "",
      toiletNotes: report?.toiletNotes ?? "",
      activityNotes: report?.activityNotes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/app/daily-reports", {
        childId,
        date,
        eatingQuality: values.eatingQuality || undefined,
        sleepMinutes: values.sleepMinutes === "" ? undefined : values.sleepMinutes,
        mood: values.mood || undefined,
        toiletNotes: values.toiletNotes || undefined,
        activityNotes: values.activityNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-reports", slug, branchId, date] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("modalTitle", { childName })}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        {hasWarning && (
          <div className="space-y-0.5 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {health?.allergies && <p>{t("allergyLabel")}: {health.allergies}</p>}
            {health?.chronicConditions && <p>{t("chronicConditionLabel")}: {health.chronicConditions}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label={t("eatingLabel")} defaultValue="" {...register("eatingQuality")}>
            <option value="">{t("notSet")}</option>
            <option value="GOOD">{t("eating.good")}</option>
            <option value="AVERAGE">{t("eating.average")}</option>
            <option value="POOR">{t("eating.poor")}</option>
          </Select>
          <Select label={t("moodLabel")} defaultValue="" {...register("mood")}>
            <option value="">{t("notSet")}</option>
            <option value="HAPPY">{t("mood.happy")}</option>
            <option value="NEUTRAL">{t("mood.neutral")}</option>
            <option value="UPSET">{t("mood.upset")}</option>
          </Select>
        </div>
        <Input label={t("sleepLabel")} type="number" min={0} {...register("sleepMinutes")} />
        <Textarea label={t("toiletLabel")} rows={2} {...register("toiletNotes")} />
        <Textarea label={t("activityLabel")} rows={3} placeholder={t("activityPlaceholder")} {...register("activityNotes")} />

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
