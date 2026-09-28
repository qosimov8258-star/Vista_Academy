"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LessonTopic } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TopicModal({
  open,
  onClose,
  slug,
  groupId,
  topic,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groupId: string;
  /** Tahrirlash uchun — bo'lmasa yangi mavzu yaratiladi. */
  topic?: LessonTopic | null;
}) {
  const t = useTranslations("lessons");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!topic;

  const schema = z.object({
    title: z.string().min(2, t("validation.titleMin")),
    date: z.string().min(1, t("validation.selectDate")),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      title: topic?.title ?? "",
      date: topic?.date ? topic.date.slice(0, 10) : "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { title: values.title, date: values.date };
      return isEdit
        ? api.patch<LessonTopic>(`/app/lesson-topics/${topic!.id}`, payload)
        : api.post<LessonTopic>("/app/lesson-topics", { groupId, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-topics", slug] });
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
    <Modal open={open} onClose={handleClose} title={isEdit ? t("editTopicTitle") : t("newTopicTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label={t("topicTitleLabel")} placeholder={t("topicTitlePlaceholder")} error={errors.title?.message} {...register("title")} />
        <Input label={t("dateLabel")} type="date" error={errors.date?.message} {...register("date")} />

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
