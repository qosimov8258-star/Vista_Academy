"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Proverb, UsefulStatus } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { useTr } from "@/i18n/tr";
import { FormError, GroupPickerRow, PublishRow, ReadingCard, TextBlock, publishFooter } from "./useful-parts";

/** Maqol — ota-onalar ko'radigan ko'rinishda */
export function ProverbReading({ text, meaning }: { text: string; meaning: string }) {
  const tr = useTr();
  return (
    <ReadingCard>
      <p className="text-center text-[19px] font-semibold leading-snug text-[var(--color-text)]">«{tr(text)}»</p>
      <div className="rounded-[14px] bg-[#ff9500]/[0.1] px-4 py-3">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#ff9500]">{tr("Ma'nosi")}</p>
        <p className="mt-1 text-[15.5px] leading-relaxed text-[var(--color-text)]">{tr(meaning)}</p>
      </div>
    </ReadingCard>
  );
}

/** Yangi maqol / tahrirlash — iOS varag'i */
export function ProverbSheet({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  proverb,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  isTeacher: boolean;
  proverb: Proverb | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const isEdit = !!proverb;

  const [text, setText] = useState("");
  const [meaning, setMeaning] = useState("");
  const [groupId, setGroupId] = useState("");
  const [status, setStatus] = useState<UsefulStatus>("PUBLISHED");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(proverb?.text ?? "");
    setMeaning(proverb?.meaning ?? "");
    setGroupId(proverb?.groupId ?? "");
    setStatus(proverb?.status ?? "PUBLISHED");
    setTried(false);
  }, [open, proverb]);

  // Tarbiyachining bitta guruhi bo'lsa — o'zi tanlanadi
  const onlyGroupId = isTeacher && groups.length === 1 ? groups[0].id : "";
  useEffect(() => {
    if (open && onlyGroupId) setGroupId((current) => current || onlyGroupId);
  }, [open, onlyGroupId]);

  const errors = {
    text: text.trim().length < 3 ? "Kamida 3 belgi" : undefined,
    meaning: meaning.trim().length < 3 ? "Kamida 3 belgi" : undefined,
    group: isTeacher && !groupId ? "Guruhni tanlang" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  const save = useMutation({
    mutationFn: () => {
      const payload = { text: text.trim(), meaning: meaning.trim(), groupId: groupId || null, status };
      return isEdit ? api.patch<Proverb>(`/app/useful/proverbs/${proverb!.id}`, payload) : api.post<Proverb>("/app/useful/proverbs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-proverbs", slug] });
      onClose();
    },
  });
  const { reset } = save;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const submit = () => {
    setTried(true);
    if (valid && !save.isPending) save.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !save.isPending && onClose()}
      title={tr(isEdit ? "Maqolni tahrirlash" : "Yangi maqol")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!valid}>
          {tr(isEdit ? "Saqlash" : "Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <FormSection title={tr("Maqol")}>
        <TextBlock value={text} onChange={setText} placeholder="Bilim — baxt kaliti" maxLength={160} minRows={2} error={show("text")} ariaLabel="Maqol" />
      </FormSection>

      <FormSection title={tr("Ma'nosi")} footer={tr("Bolaga qanday tushuntirasiz — sodda so'zlar bilan.")}>
        <TextBlock
          value={meaning}
          onChange={setMeaning}
          placeholder="Ko'p o'qigan odam ko'p narsani biladi va hayotda omadli bo'ladi."
          maxLength={400}
          minRows={3}
          error={show("meaning")}
          ariaLabel="Ma'nosi"
        />
      </FormSection>

      <FormSection title={tr("Kimga")} footer={tr(publishFooter(status))}>
        <GroupPickerRow groups={groups} value={groupId} onChange={setGroupId} allowWholeBranch={!isTeacher} error={show("group")} />
        <PublishRow status={status} onChange={setStatus} />
      </FormSection>

      <FormError message={save.error ? (save.error instanceof ApiError ? save.error.message : "Kutilmagan xatolik yuz berdi") : null} />
    </IosSheet>
  );
}
