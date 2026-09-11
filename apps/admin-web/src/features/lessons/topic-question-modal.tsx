"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { TopicQuestion } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
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
  question,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  topicId: string;
  /** Tahrirlash uchun — bo'lmasa yangi savol yaratiladi. */
  question?: TopicQuestion | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!question;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      question: question?.question ?? "",
      options: question?.options?.join("\n") ?? "",
      answer: question?.answer ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        question: values.question,
        options: parseOptions(values.options),
        answer: values.answer || undefined,
      };
      return isEdit
        ? api.patch<TopicQuestion>(`/app/lesson-topics/questions/${question!.id}`, payload)
        : api.post<TopicQuestion>(`/app/lesson-topics/${topicId}/questions`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-topic", slug, topicId] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const handleClose = () => {
    setServerError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Savolni tahrirlash" : "Yangi savol"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Textarea
          label="Savol matni"
          rows={2}
          placeholder="5 + 3 nechiga teng?"
          error={errors.question?.message}
          {...register("question")}
        />
        <Textarea
          label="Javob variantlari (ixtiyoriy)"
          rows={4}
          placeholder={"Har bir variant alohida qatorda:\n6\n7\n8\n9"}
          hint="Har qatorga bitta variant"
          {...register("options")}
        />
        <Input label="To'g'ri javob (ixtiyoriy)" placeholder="8" {...register("answer")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Saqlash" : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
