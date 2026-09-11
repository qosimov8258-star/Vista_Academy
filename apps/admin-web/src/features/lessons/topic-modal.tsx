"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LessonTopic } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  title: z.string().min(2, "Sarlavha kamida 2 belgi"),
  date: z.string().min(1, "Sanani tanlang"),
});

type FormValues = z.infer<typeof schema>;

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
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!topic;

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
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const handleClose = () => {
    setServerError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Mavzuni tahrirlash" : "Yangi mavzu"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="Mavzu sarlavhasi" placeholder="Sonlar va raqamlar" error={errors.title?.message} {...register("title")} />
        <Input label="Sana" type="date" error={errors.date?.message} {...register("date")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Saqlash" : "Yaratish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
