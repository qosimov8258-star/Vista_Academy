"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DailyReport, HealthProfile } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

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
  const tr = useTr();
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
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Kundalik hisobot — ${childName}`}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}
        {hasWarning && (
          <div className="space-y-0.5 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {health?.allergies && <p>{tr("Allergiya:")}{" "}{tr(health.allergies)}</p>}
            {health?.chronicConditions && <p>{tr("Surunkali kasallik:")}{" "}{tr(health.chronicConditions)}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label={tr("Ovqatlanishi")} defaultValue="" {...register("eatingQuality")}>
            <option value="">{tr("Belgilanmagan")}</option>
            <option value="GOOD">{tr("Yaxshi")}</option>
            <option value="AVERAGE">{tr("O'rtacha")}</option>
            <option value="POOR">{tr("Yomon")}</option>
          </Select>
          <Select label={tr("Kayfiyati")} defaultValue="" {...register("mood")}>
            <option value="">{tr("Belgilanmagan")}</option>
            <option value="HAPPY">{tr("Xursand")}</option>
            <option value="NEUTRAL">{tr("Oddiy")}</option>
            <option value="UPSET">{tr("Xafa")}</option>
          </Select>
        </div>
        <Input label={tr("Uyqu davomiyligi (daqiqa)")} type="number" min={0} {...register("sleepMinutes")} />
        <Textarea label={tr("Tualet holati (ixtiyoriy)")} rows={2} {...register("toiletNotes")} />
        <Textarea label={tr("Kunlik faoliyat")} rows={3} placeholder={tr("Bugun nima qildi...")} {...register("activityNotes")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tr("Saqlash")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
