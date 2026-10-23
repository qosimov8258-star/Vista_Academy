"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { FieldRow, FormSection } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { OptionPicker } from "@/features/lessons/option-picker";
import { DANGER_BOX, SUCCESS_BOX, TEXTAREA } from "@/features/notifications/shared";
import { useTr } from "@/i18n/tr";

/** Ommaviy xabar: butun filial yoki bitta guruh ota-onalariga (jurnalga yoziladi). */
export function BroadcastModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
  }, [open]);

  const groups = useQuery({ queryKey: ["groups", slug], queryFn: () => api.get<Group[]>("/app/groups"), enabled: open });

  const send = useMutation({
    mutationFn: () => api.post<{ recipients: number; skipped: number }>("/app/desk/broadcast", { groupId: groupId || undefined, message: message.trim() }),
    onSuccess: (res) => {
      setError(null);
      setResult(tr("{0} ta ota-onaga yozildi{1}", res.recipients, res.skipped > 0 ? tr(" ({0} tasida telefon yoki ruxsat yo'q)", res.skipped) : ""));
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["notifications", slug] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });
  const ready = message.trim().length >= 3;

  return (
    <IosSheet
      open={open}
      onClose={() => !send.isPending && onClose()}
      title={tr("Ommaviy xabar")}
      cancelLabel="Yopish"
      footer={
        <SheetPrimaryButton
          loading={send.isPending}
          dim={!ready}
          onClick={() => {
            if (!ready) return;
            setResult(null);
            setError(null);
            send.mutate();
          }}
        >
          {tr("Yuborish")}
        </SheetPrimaryButton>
      }
    >
      {error && (
        <p role="alert" className={DANGER_BOX}>
          {tr(error)}
        </p>
      )}
      {result && (
        <p role="status" className={SUCCESS_BOX}>
          {tr(result)}
        </p>
      )}
      <FormSection>
        <FieldRow label={tr("Kimga")}>
          <OptionPicker
            title={tr("Kimga")}
            value={groupId}
            onChange={setGroupId}
            placeholder={tr("Butun filial (hamma ota-ona)")}
            emptyOption={tr("Butun filial (hamma ota-ona)")}
            options={(groups.data ?? []).map((g) => ({ id: g.id, label: `${tr(g.name)} ${tr("guruhi")}` }))}
            loading={groups.isLoading}
          />
        </FieldRow>
      </FormSection>
      <FormSection title={tr("Xabar")} footer={`${message.length}/500`}>
        <div className="px-4 py-3">
          <textarea
            rows={5}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={tr("Masalan: Ertaga bog'cha dam olish kuni.")}
            aria-label={tr("Xabar")}
            className={TEXTAREA}
          />
        </div>
      </FormSection>
    </IosSheet>
  );
}
