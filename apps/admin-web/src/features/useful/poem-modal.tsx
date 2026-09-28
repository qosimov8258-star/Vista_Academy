"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { Group, Poem } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { splitIntoBlocks } from "./split-blocks";

const RECOMMENDED_LINE_LENGTH = 45;

function buildSchema(t: (key: string) => string, groupRequired: boolean) {
  return z
    .object({
      title: z.string().min(1, t("validation.titleRequired")).max(80, t("validation.max80")),
      author: z.string().max(80, t("validation.max80")).optional(),
      groupId: groupRequired ? z.string().min(1, t("validation.selectGroup")) : z.string().optional(),
      ageFrom: z.coerce.number().int().min(2).max(7),
      ageTo: z.coerce.number().int().min(2).max(7),
      text: z.string().min(1, t("validation.textRequired")).max(6000),
      status: z.enum(["PUBLISHED", "DRAFT"]),
    })
    .refine((v) => v.ageFrom <= v.ageTo, {
      message: t("validation.ageOrder"),
      path: ["ageTo"],
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function PoemModal({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  poem,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  /** O'qituvchi uchun guruh tanlash majburiy, boshqalar "Butun filial"ni ham tanlay oladi. */
  isTeacher: boolean;
  poem?: Poem | null;
}) {
  const t = useTranslations("useful");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!poem;
  const schema = useMemo(() => buildSchema(t, isTeacher), [t, isTeacher]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      title: poem?.title ?? "",
      author: poem?.author ?? "",
      groupId: poem?.groupId ?? "",
      ageFrom: poem?.ageFrom ?? 3,
      ageTo: poem?.ageTo ?? 6,
      text: poem ? poem.stanzas.map((stanza) => stanza.join("\n")).join("\n\n") : "",
      status: poem?.status ?? "PUBLISHED",
    },
  });

  const text = watch("text") ?? "";
  const preview = useMemo(() => splitIntoBlocks(text), [text]);
  const hasLongLine = preview.some((stanza) => stanza.some((line) => line.length > RECOMMENDED_LINE_LENGTH));

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        author: values.author ? values.author : null,
        groupId: values.groupId ? values.groupId : null,
        ageFrom: values.ageFrom,
        ageTo: values.ageTo,
        text: values.text,
        status: values.status,
      };
      return isEdit
        ? api.patch<Poem>(`/app/useful/poems/${poem!.id}`, payload)
        : api.post<Poem>("/app/useful/poems", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-poems", slug] });
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
    <Modal open={open} onClose={handleClose} title={isEdit ? t("editPoemTitle") : t("newPoemTitle")} widthClassName="max-w-3xl">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t("titleLabel")} placeholder={t("poemTitlePlaceholder")} error={errors.title?.message} {...register("title")} />
          <Input label={t("authorLabelOptional")} placeholder={t("authorPlaceholder")} error={errors.author?.message} {...register("author")} />

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

        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            label={t("textLabel")}
            hint={t("stanzaHint")}
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
                preview.map((stanza, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-[var(--color-text)]">
                    {stanza.map((line, j) => (
                      <span key={j}>
                        {line}
                        {j < stanza.length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                ))
              )}
            </div>
            {hasLongLine && (
              <p className="mt-1.5 text-[13px] text-[var(--color-warning)]">
                {t("longLineWarning", { length: RECOMMENDED_LINE_LENGTH })}
              </p>
            )}
          </div>
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
