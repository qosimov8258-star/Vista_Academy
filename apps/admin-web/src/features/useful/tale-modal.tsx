"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { Group, Tale } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { splitIntoBlocks } from "./split-blocks";

function parseQuestions(raw: string | undefined): string[] {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSchema(t: (key: string) => string, groupRequired: boolean) {
  return z
    .object({
      title: z.string().min(1, t("validation.titleRequired")).max(80),
      origin: z.string().min(1, t("validation.originRequired")).max(120),
      text: z.string().min(1, t("validation.textRequired")).max(8000),
      moral: z.string().min(3, t("validation.min3")).max(300),
      questionsText: z.string().optional(),
      minutesText: z.string().optional(),
      cover: z.enum(["tun", "sholgom"]),
      groupId: groupRequired ? z.string().min(1, t("validation.selectGroup")) : z.string().optional(),
      ageFrom: z.coerce.number().int().min(2).max(7),
      ageTo: z.coerce.number().int().min(2).max(7),
      status: z.enum(["PUBLISHED", "DRAFT"]),
    })
    .refine((v) => v.ageFrom <= v.ageTo, { message: t("validation.ageOrder"), path: ["ageTo"] })
    .superRefine((v, ctx) => {
      const questions = parseQuestions(v.questionsText);
      if (questions.length > 8) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("validation.max8Questions"), path: ["questionsText"] });
      }
      if (questions.some((q) => q.length < 3 || q.length > 150)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.questionLength"),
          path: ["questionsText"],
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function TaleModal({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  tale,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  isTeacher: boolean;
  tale?: Tale | null;
}) {
  const t = useTranslations("useful");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!tale;
  const schema = useMemo(() => buildSchema(t, isTeacher), [t, isTeacher]);
  const COVERS = [
    { value: "tun", label: t("cover.night") },
    { value: "sholgom", label: t("cover.turnip") },
  ];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      title: tale?.title ?? "",
      origin: tale?.origin ?? "",
      text: tale ? tale.paragraphs.join("\n\n") : "",
      moral: tale?.moral ?? "",
      questionsText: tale?.questions.join("\n") ?? "",
      minutesText: tale?.minutes ? String(tale.minutes) : "",
      cover: (tale?.cover as "tun" | "sholgom") ?? "tun",
      groupId: tale?.groupId ?? "",
      ageFrom: tale?.ageFrom ?? 3,
      ageTo: tale?.ageTo ?? 7,
      status: tale?.status ?? "PUBLISHED",
    },
  });

  const text = watch("text") ?? "";
  const preview = useMemo(() => splitIntoBlocks(text).map((block) => block.join(" ")), [text]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        origin: values.origin,
        text: values.text,
        moral: values.moral,
        questions: parseQuestions(values.questionsText),
        minutes: values.minutesText ? Number(values.minutesText) : null,
        cover: values.cover,
        groupId: values.groupId ? values.groupId : null,
        ageFrom: values.ageFrom,
        ageTo: values.ageTo,
        status: values.status,
      };
      return isEdit
        ? api.patch<Tale>(`/app/useful/tales/${tale!.id}`, payload)
        : api.post<Tale>("/app/useful/tales", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-tales", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  const handleClose = () => {
    setServerError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? t("editTaleTitle") : t("newTaleTitle")} widthClassName="max-w-3xl">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t("titleLabel")} placeholder={t("talePlaceholder")} error={errors.title?.message} {...register("title")} />
          <Input
            label={t("originLabel")}
            placeholder={t("originPlaceholder")}
            error={errors.origin?.message}
            {...register("origin")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            label={t("textLabel")}
            hint={t("paragraphHint")}
            rows={10}
            error={errors.text?.message}
            {...register("text")}
          />
          <div>
            <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{t("previewLabel")}</span>
            <div className="h-full min-h-[220px] space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface-sunken)]/40 px-4 py-3.5">
              {preview.length === 0 ? (
                <p className="text-[13px] text-[var(--color-text-muted)]">{t("previewEmptyHint")}</p>
              ) : (
                preview.map((paragraph, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-[var(--color-text)]">
                    {paragraph}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        <Textarea label={t("moralLabel")} rows={2} error={errors.moral?.message} {...register("moral")} />
        <Textarea
          label={t("questionsLabelOptional")}
          hint={t("max8Hint")}
          rows={3}
          error={errors.questionsText?.message}
          {...register("questionsText")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("readingMinutesLabelOptional")}
            type="number"
            min={1}
            placeholder={t("readingMinutesPlaceholder")}
            error={errors.minutesText?.message}
            {...register("minutesText")}
          />
          <Select label={t("coverLabel")} error={errors.cover?.message} {...register("cover")}>
            {COVERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>

          <Select label={t("groupLabel")} error={errors.groupId?.message} {...register("groupId")}>
            {!isTeacher && <option value="">{t("wholeBranch")}</option>}
            {isTeacher && <option value="">{t("selectGroupOption")}</option>}
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Select label={t("showToParentsLabel")} error={errors.status?.message} {...register("status")}>
            <option value="PUBLISHED">{t("status.published")}</option>
            <option value="DRAFT">{t("status.draft")}</option>
          </Select>

          <Input label={t("ageFromLabel")} type="number" min={2} max={7} error={errors.ageFrom?.message} {...register("ageFrom")} />
          <Input label={t("ageToLabel")} type="number" min={2} max={7} error={errors.ageTo?.message} {...register("ageTo")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? t("save") : t("create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
