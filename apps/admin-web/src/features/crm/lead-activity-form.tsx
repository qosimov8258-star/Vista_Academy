"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { LeadActivity, LeadActivityType } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, TextArea } from "@/components/ios/form";
import { ACTIVITY_LABEL } from "./labels";
import { useTr } from "@/i18n/tr";

const TYPES = Object.keys(ACTIVITY_LABEL) as LeadActivityType[];

/**
 * Arizaga faoliyat qo'shish (qo'ng'iroq, xabar, uchrashuv…). Turi — 6 ta
 * kapsula (native select o'rniga), izoh ixtiyoriy.
 */
export function LeadActivitySheet({ open, onClose, slug, leadId }: { open: boolean; onClose: () => void; slug: string; leadId: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [type, setType] = useState<LeadActivityType>("NOTE");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post<LeadActivity>(`/app/leads/${leadId}/activities`, { type, note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      onClose();
    },
  });
  const { reset } = mutation;

  useEffect(() => {
    if (!open) return;
    setType("NOTE");
    setNote("");
    reset();
  }, [open, reset]);

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Faoliyat qo'shish")}
      footer={
        <SheetPrimaryButton onClick={() => mutation.mutate()} loading={mutation.isPending}>
          {tr("Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <section>
        <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">{tr("Turi")}</h3>
        <div role="radiogroup" aria-label={tr("Turi")} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={clsx(
                "h-11 truncate rounded-full px-3 text-[14.5px] font-semibold transition-colors",
                type === t ? "bg-[var(--color-primary)] text-white" : "bg-white text-[var(--color-text)]",
              )}
            >
              {tr(ACTIVITY_LABEL[t])}
            </button>
          ))}
        </div>
      </section>

      <FormSection>
        <FieldRow label={tr("Izoh (ixtiyoriy)")} htmlFor="activity-note" stacked>
          <TextArea id="activity-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Qo'shimcha ma'lumot")} />
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
