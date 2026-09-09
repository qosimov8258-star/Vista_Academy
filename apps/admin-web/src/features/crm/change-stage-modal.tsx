"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Lead, LeadStage } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STAGE_LABEL } from "./labels";

const CHANGEABLE_STAGES = ["NEW", "TRIAL_DAY_SCHEDULED", "CONTRACT", "LOST"] as const;
type ChangeableStage = (typeof CHANGEABLE_STAGES)[number];

const schema = z.object({
  stage: z.enum(["NEW", "TRIAL_DAY_SCHEDULED", "CONTRACT", "LOST"]),
  lostReason: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function isChangeableStage(stage: LeadStage): stage is ChangeableStage {
  return (CHANGEABLE_STAGES as readonly LeadStage[]).includes(stage);
}

export function ChangeStageModal({
  open,
  onClose,
  slug,
  leadId,
  currentStage,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  leadId: string;
  currentStage: LeadStage;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      stage: isChangeableStage(currentStage) ? currentStage : "NEW",
      lostReason: "",
    },
  });

  const stage = watch("stage");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch<Lead>(`/app/leads/${leadId}/stage`, {
        stage: values.stage,
        lostReason: values.stage === "LOST" ? values.lostReason : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Bosqichni o'zgartirish">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          if (values.stage === "LOST" && !values.lostReason?.trim()) {
            setError("lostReason", { message: "Yo'qotilgan ariza uchun sabab kiritilishi shart" });
            return;
          }
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Yangi bosqich" error={errors.stage?.message} {...register("stage")}>
          {CHANGEABLE_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </Select>
        {stage === "LOST" && (
          <Textarea
            label="Yo'qotish sababi"
            rows={3}
            placeholder="Masalan: narx mos kelmadi"
            error={errors.lostReason?.message}
            {...register("lostReason")}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
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
