"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { Group, Proverb } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function buildSchema(t: (key: string) => string, groupRequired: boolean) {
  return z.object({
    text: z.string().min(3, t("validation.min3")).max(160, t("validation.max160")),
    meaning: z.string().min(3, t("validation.min3")).max(400, t("validation.max400")),
    groupId: groupRequired ? z.string().min(1, t("validation.selectGroup")) : z.string().optional(),
    status: z.enum(["PUBLISHED", "DRAFT"]),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function ProverbModal({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  proverb,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  isTeacher: boolean;
  proverb?: Proverb | null;
}) {
  const t = useTranslations("useful");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!proverb;
  const schema = useMemo(() => buildSchema(t, isTeacher), [t, isTeacher]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      text: proverb?.text ?? "",
      meaning: proverb?.meaning ?? "",
      groupId: proverb?.groupId ?? "",
      status: proverb?.status ?? "PUBLISHED",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        text: values.text,
        meaning: values.meaning,
        groupId: values.groupId ? values.groupId : null,
        status: values.status,
      };
      return isEdit
        ? api.patch<Proverb>(`/app/useful/proverbs/${proverb!.id}`, payload)
        : api.post<Proverb>("/app/useful/proverbs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-proverbs", slug] });
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
    <Modal open={open} onClose={handleClose} title={isEdit ? t("editProverbTitle") : t("newProverbTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <Textarea label={t("proverbLabel")} rows={2} error={errors.text?.message} {...register("text")} />
        <Textarea
          label={t("meaningLabel")}
          rows={3}
          error={errors.meaning?.message}
          {...register("meaning")}
        />

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
