"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Lead, LeadStage } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, TextArea } from "@/components/ios/form";
import { CheckRow } from "@/components/ios/check-row";
import { STAGE_COLOR, STAGE_LABEL } from "./labels";
import { useTr } from "@/i18n/tr";

const CHANGEABLE_STAGES = ["NEW", "TRIAL_DAY_SCHEDULED", "CONTRACT", "LOST"] as const;
type ChangeableStage = (typeof CHANGEABLE_STAGES)[number];

function isChangeableStage(stage: LeadStage): stage is ChangeableStage {
  return (CHANGEABLE_STAGES as readonly LeadStage[]).includes(stage);
}

/** Ariza bosqichini o'zgartirish. "Yo'qotildi" uchun sabab majburiy. */
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
  const tr = useTr();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<ChangeableStage>("NEW");
  const [lostReason, setLostReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch<Lead>(`/app/leads/${leadId}/stage`, {
        stage,
        lostReason: stage === "LOST" ? lostReason : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats", slug] });
      onClose();
    },
  });
  const { reset } = mutation;

  useEffect(() => {
    if (!open) return;
    setStage(isChangeableStage(currentStage) ? currentStage : "NEW");
    setLostReason("");
    setReasonError(null);
    reset();
  }, [open, currentStage, reset]);

  const submit = () => {
    if (stage === "LOST" && !lostReason.trim()) {
      setReasonError("Yo'qotilgan ariza uchun sabab kiritilishi shart");
      return;
    }
    mutation.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Bosqichni o'zgartirish")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={mutation.isPending}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <FormSection title={tr("Yangi bosqich")}>
        {CHANGEABLE_STAGES.map((s) => (
          <CheckRow
            key={s}
            label={tr(STAGE_LABEL[s])}
            checked={stage === s}
            onClick={() => {
              setStage(s);
              setReasonError(null);
            }}
            leading={<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STAGE_COLOR[s] }} aria-hidden="true" />}
          />
        ))}
      </FormSection>

      {stage === "LOST" && (
        <FormSection>
          <FieldRow label={tr("Yo'qotish sababi")} htmlFor="lost-reason" error={reasonError ?? undefined} stacked>
            <TextArea
              id="lost-reason"
              rows={3}
              value={lostReason}
              onChange={(e) => {
                setLostReason(e.target.value);
                setReasonError(null);
              }}
              placeholder={tr("Masalan: narx mos kelmadi")}
            />
          </FieldRow>
        </FormSection>
      )}

      {mutation.error && (
        <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
          {mutation.error instanceof ApiError ? tr(mutation.error.message) : tr("Kutilmagan xatolik yuz berdi")}
        </p>
      )}
    </IosSheet>
  );
}
