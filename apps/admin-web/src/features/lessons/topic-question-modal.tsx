"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LessonTopic, TopicQuestion } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  topicId: z.string().optional(),
  question: z.string().min(2, "Savol matnini kiriting"),
  options: z.string().optional(),
  answer: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** "a\nb\nc" -> ["a","b","c"], bo'sh qatorlar tashlab ketiladi. */
function parseOptions(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function TopicQuestionModal({
  open,
  onClose,
  slug,
  topicId,
  topics,
  question,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  /** Mavzu oldindan belgilangan bo'lsa (mavzu qatoridan ochilganda) — tanlov ko'rsatilmaydi. */
  topicId?: string;
  /** `topicId` berilmaganda — foydalanuvchi savolni qaysi mavzuga qo'shishini shu ro'yxatdan tanlaydi. */
  topics?: LessonTopic[];
  /** Tahrirlash uchun — bo'lmasa yangi savol yaratiladi. */
  question?: TopicQuestion | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!question;
  const needsTopicPicker = !isEdit && !topicId;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      topicId: topicId ?? topics?.[0]?.id ?? "",
      question: question?.question ?? "",
      options: question?.options?.join("\n") ?? "",
      answer: question?.answer ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const targetTopicId = topicId ?? values.topicId;
      const payload = {
        question: values.question,
        options: parseOptions(values.options),
        answer: values.answer || undefined,
      };
      return isEdit
        ? api.patch<TopicQuestion>(`/app/lesson-topics/questions/${question!.id}`, payload)
        : api.post<TopicQuestion>(`/app/lesson-topics/${targetTopicId}/questions`, payload);
    },
    onSuccess: (_result, values) => {
      const targetTopicId = topicId ?? values.topicId;
      queryClient.invalidateQueries({ queryKey: ["lesson-topic", slug, targetTopicId] });
      queryClient.invalidateQueries({ queryKey: ["lesson-topics", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const handleClose = () => {
    setServerError(null);
    onClose();
  };

  const noTopicsAvailable = needsTopicPicker && (!topics || topics.length === 0);

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Savolni tahrirlash" : tr("Yangi savol")}>
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          if (needsTopicPicker && !values.topicId) {
            setServerError(tr("Mavzuni tanlang"));
            return;
          }
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}
        {noTopicsAvailable ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {tr("Hozircha mavzu yo'q — avval mavzu qo'shing, so'ng savolni unga biriktiring.")}
          </p>
        ) : (
          <>
            {needsTopicPicker && (
              <Select label={tr("Mavzu")} {...register("topicId")}>
                {topics!.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {tr(topic.title)}
                  </option>
                ))}
              </Select>
            )}
            <Textarea
              label={tr("Savol matni")}
              rows={2}
              placeholder={tr("5 + 3 nechiga teng?")}
              error={errors.question?.message}
              {...register("question")}
            />
            <Textarea
              label={tr("Javob variantlari (ixtiyoriy)")}
              rows={4}
              placeholder={"Har bir variant alohida qatorda:\n6\n7\n8\n9"}
              hint={tr("Har qatorga bitta variant")}
              {...register("options")}
            />
            <Input label={tr("To'g'ri javob (ixtiyoriy)")} placeholder="8" {...register("answer")} />
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {noTopicsAvailable ? "Yopish" : "Bekor qilish"}
          </Button>
          {!noTopicsAvailable && (
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {isEdit ? "Saqlash" : tr("Qo'shish")}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
