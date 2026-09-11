"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LessonGrade, LessonTopic } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

const schema = z.object({
  score: z.coerce.number().int().min(1).max(10),
  topicId: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function GradeChildModal({
  open,
  onClose,
  slug,
  groupId,
  date,
  childId,
  childName,
  grade,
  topics,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groupId: string;
  date: string;
  childId: string;
  childName: string;
  grade: LessonGrade | null;
  topics: LessonTopic[];
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      score: grade?.score ?? 8,
      topicId: grade?.topicId ?? "",
      note: grade?.note ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<LessonGrade>("/app/lesson-grades", {
        childId,
        groupId,
        date,
        score: values.score,
        topicId: values.topicId || undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-grades", slug, groupId, date] });
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
    <Modal open={open} onClose={handleClose} title={`Baholash — ${childName}`}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Baho (1–10)" {...register("score")}>
          {SCORES.map((score) => (
            <option key={score} value={score}>
              {score}
            </option>
          ))}
        </Select>

        <Select label="Mavzu bilan bog'lash (ixtiyoriy)" defaultValue="" {...register("topicId")}>
          <option value="">Bog'lanmagan</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </Select>

        <Textarea label="Izoh (ixtiyoriy)" rows={2} placeholder="Bugungi ishtiroki haqida..." {...register("note")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
