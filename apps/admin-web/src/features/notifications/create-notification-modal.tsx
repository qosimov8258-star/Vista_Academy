"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getPaginated } from "@/lib/api";
import type { Child, NotificationEventType, NotificationLog } from "@/lib/types";
import { FieldRow, FormSection, TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { OptionPicker } from "@/features/lessons/option-picker";
import { CREATABLE_EVENTS, DANGER_BOX, EVENT_META, TEXTAREA } from "@/features/notifications/shared";
import { useTr } from "@/i18n/tr";

interface FormState {
  eventType: NotificationEventType;
  childId: string;
  recipientName: string;
  recipientContact: string;
  message: string;
}
const EMPTY: FormState = { eventType: "CUSTOM", childId: "", recipientName: "", recipientContact: "", message: "" };

/** Jurnalga qo'lda yozuv: kimga, nima haqida xabar berilishi kerak (tizim o'zi yubormaydi). */
export function CreateNotificationModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showMissing, setShowMissing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setShowMissing(false);
    setServerError(null);
  }, [open]);

  // API bir so'rovda ko'pi bilan 100 ta beradi (avval limit=200 400 qaytarib,
  // ro'yxat bo'sh qolardi) — 100 tadan sahifalab hammasi olinadi
  const childrenQuery = useQuery({
    queryKey: ["children-for-notification", slug],
    queryFn: async () => {
      const all: Child[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const res = await getPaginated<Child>(`/app/children?limit=100&page=${page}`);
        all.push(...res.data);
        if (all.length >= res.meta.total || res.data.length === 0) break;
      }
      return all;
    },
    enabled: open,
    staleTime: 60_000,
  });
  const children = childrenQuery.data ?? [];

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Bola tanlansa — asosiy vasiyning ismi va telefoni o'zi to'ladi
  const pickChild = (childId: string) => {
    const guardian = children.find((c) => c.id === childId)?.guardians?.[0]?.guardian;
    setForm((f) => ({
      ...f,
      childId,
      ...(guardian ? { recipientName: guardian.fullName, recipientContact: guardian.phone } : {}),
    }));
  };

  const errors = {
    recipientName: form.recipientName.trim().length < 2 ? "Qabul qiluvchi ismi kamida 2 belgi" : undefined,
    message: form.message.trim().length < 2 ? "Xabar matni kamida 2 belgi" : undefined,
  };
  const complete = !errors.recipientName && !errors.message;

  const mutation = useMutation({
    mutationFn: () =>
      api.post<NotificationLog>("/app/notifications", {
        eventType: form.eventType,
        childId: form.childId || undefined,
        recipientName: form.recipientName.trim(),
        recipientContact: form.recipientContact.trim() || undefined,
        message: form.message.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", slug] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const submit = () => {
    if (!complete) {
      setShowMissing(true);
      return;
    }
    mutation.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Yangi bildirishnoma yozuvi")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={mutation.isPending} dim={!complete}>
          {tr("Yaratish")}
        </SheetPrimaryButton>
      }
    >
      <form
        id={formId}
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {serverError && (
          <p role="alert" className={DANGER_BOX}>
            {tr(serverError)}
          </p>
        )}

        <FormSection title={tr("Hodisa turi")}>
          <div className="flex flex-wrap gap-2 px-4 py-3" role="radiogroup" aria-label={tr("Hodisa turi")}>
            {CREATABLE_EVENTS.map((type) => {
              const active = form.eventType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("eventType", type)}
                  className={clsx(
                    "h-9 rounded-full px-3.5 text-[13.5px] font-medium transition-[transform,background-color] active:scale-[0.96]",
                    active ? "bg-[var(--color-primary)] text-white" : "bg-[#767680]/[0.12] text-[var(--color-text)]",
                  )}
                >
                  {tr(EVENT_META[type].label)}
                </button>
              );
            })}
          </div>
        </FormSection>

        <FormSection footer={tr("Bola tanlansa — ota-onasining ismi va telefoni o'zi yoziladi")}>
          <FieldRow label={tr("Bola")}>
            <OptionPicker
              title={tr("Bola")}
              value={form.childId}
              onChange={pickChild}
              placeholder={tr("Tanlanmagan")}
              emptyOption={tr("Tanlanmagan")}
              options={children.map((c) => ({ id: c.id, label: tr(c.fullName), hint: c.group?.name ? tr(c.group.name) : undefined }))}
              loading={childrenQuery.isLoading}
            />
          </FieldRow>
          <FieldRow label={tr("Qabul qiluvchi")} htmlFor={`${formId}-name`} error={showMissing ? errors.recipientName : undefined}>
            <TextInput id={`${formId}-name`} value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder={tr("Karimova Aziza")} className="text-right" />
          </FieldRow>
          <FieldRow label={tr("Telefon")} htmlFor={`${formId}-phone`}>
            <TextInput id={`${formId}-phone`} type="tel" inputMode="tel" value={form.recipientContact} onChange={(e) => set("recipientContact", e.target.value)} placeholder={tr("Ixtiyoriy")} className="text-right tabular-nums" />
          </FieldRow>
        </FormSection>

        <FormSection title={tr("Xabar matni")}>
          <div className={clsx("px-4 py-3", showMissing && errors.message && "bg-[#ff3b30]/[0.06]")}>
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder={tr("Xurmatli ota-ona, ...")}
              aria-label={tr("Xabar matni")}
              className={TEXTAREA}
            />
            {showMissing && errors.message && <p className="pt-1 text-[12.5px] text-[#ff3b30]">{tr(errors.message)}</p>}
          </div>
        </FormSection>
      </form>
    </IosSheet>
  );
}
