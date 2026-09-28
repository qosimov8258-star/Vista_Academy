"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AgeGroup, Lead, LeadSource } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ageGroupLabel, sourceLabel } from "./labels";
import { validateUzbekPhone } from "@/lib/phone";

const AGE_GROUPS: AgeGroup[] = ["AGE_1_2", "AGE_2_3", "AGE_3_4", "AGE_4_5", "AGE_5_6", "AGE_6_7"];
const SOURCES: LeadSource[] = ["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "OTHER"];

export function CreateLeadModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const t = useTranslations("crm");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    childFullName: z.string().min(2, t("validation.fullNameMin")),
    childBirthDate: z.string().optional(),
    ageGroup: z.string().optional(),
    parentName: z.string().min(2, t("validation.fullNameMin")),
    parentPhone: z
      .string()
      .min(1, t("validation.phoneRequired"))
      .superRefine((value, ctx) => {
        const error = validateUzbekPhone(value);
        if (error === "prefix") {
          ctx.addIssue({ code: "custom", message: t("validation.phonePrefix") });
        } else if (error === "length") {
          ctx.addIssue({ code: "custom", message: t("validation.phoneLength") });
        } else if (error === "code") {
          ctx.addIssue({ code: "custom", message: t("validation.phoneCode") });
        }
      }),
    source: z.string().optional(),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Lead>("/app/leads", {
        ...values,
        childBirthDate: values.childBirthDate || undefined,
        ageGroup: values.ageGroup || undefined,
        source: values.source || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("newLeadTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="font-heading text-center text-[28px] font-extrabold tracking-tight text-[var(--color-primary)]">
          Vista Academy
        </h1>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input
          label={t("childFullNameLabel")}
          placeholder={t("childFullNamePlaceholder")}
          error={errors.childFullName?.message}
          {...register("childFullName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t("birthDateLabelOptional")} type="date" error={errors.childBirthDate?.message} {...register("childBirthDate")} />
          <Select label={t("ageGroupLabelOptional")} defaultValue="" {...register("ageGroup")}>
            <option value="">{t("notSelected")}</option>
            {AGE_GROUPS.map((value) => (
              <option key={value} value={value}>
                {ageGroupLabel(t, value)}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label={t("parentNameLabel")}
          placeholder={t("parentNamePlaceholder")}
          error={errors.parentName?.message}
          {...register("parentName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t("parentPhoneLabel")}
            type="tel"
            placeholder="+998901234567"
            maxLength={13}
            error={errors.parentPhone?.message}
            {...register("parentPhone")}
          />
          <Select label={t("sourceLabelOptional")} defaultValue="" {...register("source")}>
            <option value="">{t("notSelected")}</option>
            {SOURCES.map((value) => (
              <option key={value} value={value}>
                {sourceLabel(t, value)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {t("create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
