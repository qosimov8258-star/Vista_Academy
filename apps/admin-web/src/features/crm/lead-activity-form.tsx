"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LeadActivity, LeadActivityType } from "@/lib/types";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { activityLabel } from "./labels";

const ACTIVITY_TYPES: LeadActivityType[] = ["CALL", "MESSAGE", "MEETING", "TRIAL_DAY", "STAGE_CHANGE", "NOTE"];

const schema = z.object({
  type: z.enum(["CALL", "MESSAGE", "MEETING", "TRIAL_DAY", "STAGE_CHANGE", "NOTE"]),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LeadActivityForm({ slug, leadId }: { slug: string; leadId: string }) {
  const t = useTranslations("crm");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: "NOTE", note: "" } });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<LeadActivity>(`/app/leads/${leadId}/activities`, {
        type: values.type,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      reset({ type: "NOTE", note: "" });
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <form className="space-y-3" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      {serverError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
        <Select label={t("typeLabel")} {...register("type")}>
          {ACTIVITY_TYPES.map((value) => (
            <option key={value} value={value}>
              {activityLabel(t, value)}
            </option>
          ))}
        </Select>
        <Textarea label={t("noteLabelOptional")} rows={2} placeholder={t("additionalInfoPlaceholder")} {...register("note")} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isSubmitting || mutation.isPending}>
          {t("add")}
        </Button>
      </div>
    </form>
  );
}
