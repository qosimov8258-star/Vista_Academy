"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, TextArea } from "@/components/ios/form";
import { useTr } from "@/i18n/tr";

const DATE_INPUT =
  "w-full bg-transparent py-3 text-right text-[15px] tabular-nums text-[var(--color-text)] outline-none [&::-webkit-date-and-time-value]:text-right";

/** Keyingi bog'lanish, sinov kuni, shartnoma sanasi va izohi */
export function EditLeadDetailsModal({
  open,
  onClose,
  slug,
  leadId,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  leadId: string;
  lead: Lead;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [followUpDate, setFollowUpDate] = useState("");
  const [trialDate, setTrialDate] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [contractNote, setContractNote] = useState("");

  const mutation = useMutation({
    // Bo'sh qoldirilgan maydon `null` bilan yuboriladi (`undefined` emas) —
    // `undefined` kalitlari JSON'ga chiqmaydi va backend uni "o'zgarmasin"
    // deb tushunadi, `null` esa "tozala" deb. Aks holda bir marta sana
    // kiritilgach uni hech qachon tozalab bo'lmas edi.
    mutationFn: () =>
      api.patch<Lead>(`/app/leads/${leadId}/details`, {
        followUpDate: followUpDate || null,
        trialDate: trialDate || null,
        contractDate: contractDate || null,
        contractNote: contractNote || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      onClose();
    },
  });
  const { reset } = mutation;

  useEffect(() => {
    if (!open) return;
    setFollowUpDate(lead.followUpDate?.slice(0, 10) ?? "");
    setTrialDate(lead.trialDate?.slice(0, 10) ?? "");
    setContractDate(lead.contractDate?.slice(0, 10) ?? "");
    setContractNote(lead.contractNote ?? "");
    reset();
  }, [open, lead, reset]);

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Tafsilotlarni tahrirlash")}
      footer={
        <SheetPrimaryButton onClick={() => mutation.mutate()} loading={mutation.isPending}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <FormSection title={tr("Sanalar")} footer={tr("Sanani o'chirsangiz, «Belgilanmagan» bo'lib qoladi.")}>
        <FieldRow label={tr("Keyingi bog'lanish")} htmlFor="lead-follow">
          <input id="lead-follow" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={DATE_INPUT} />
        </FieldRow>
        <FieldRow label={tr("Sinov kuni")} htmlFor="lead-trial">
          <input id="lead-trial" type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} className={DATE_INPUT} />
        </FieldRow>
        <FieldRow label={tr("Shartnoma sanasi")} htmlFor="lead-contract">
          <input id="lead-contract" type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={DATE_INPUT} />
        </FieldRow>
      </FormSection>

      <FormSection>
        <FieldRow label={tr("Shartnoma izohi")} htmlFor="lead-note" stacked>
          <TextArea id="lead-note" rows={3} value={contractNote} onChange={(e) => setContractNote(e.target.value)} placeholder={tr("Shartlar, oylik to'lov, izoh...")} />
        </FieldRow>
      </FormSection>

      {mutation.error && (
        <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
          {mutation.error instanceof ApiError ? tr(mutation.error.message) : tr("Kutilmagan xatolik yuz berdi")}
        </p>
      )}
    </IosSheet>
  );
}
