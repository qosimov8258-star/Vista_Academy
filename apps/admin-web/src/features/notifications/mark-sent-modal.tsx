"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { NotificationChannel, NotificationLog } from "@/lib/types";
import { CheckIcon } from "@/components/ios/icons";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { CHANNEL_LABEL, CHANNEL_ORDER, DANGER_BOX } from "@/features/notifications/shared";
import { useTr } from "@/i18n/tr";

/** Yozuvni «Yuborildi» deb belgilash — xabar qaysi kanal orqali berilgani tanlanadi. */
export function MarkSentModal({
  open,
  onClose,
  slug,
  notification,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  notification: NotificationLog | null;
  /** Belgilangach (masalan tafsilot varag'ini ham yopish uchun) */
  onDone?: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<NotificationChannel>("PHONE_CALL");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannel("PHONE_CALL");
    setServerError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!notification) throw new Error("Bildirishnoma tanlanmagan");
      return api.patch<NotificationLog>(`/app/notifications/${notification.id}/mark-sent`, { channel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", slug] });
      onClose();
      onDone?.();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Yuborildi deb belgilash")}
      cancelLabel="Orqaga"
      footer={
        <SheetPrimaryButton loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {tr("Tasdiqlash")}
        </SheetPrimaryButton>
      }
    >
      {notification && (
        <p className="px-1 text-[13.5px] leading-snug text-[#8e8e93]">
          {tr("Qabul qiluvchiga")} <span className="font-medium text-[var(--color-text)]">{tr(notification.recipientName)}</span>{" "}
          {tr("haqiqatda qaysi kanal orqali xabar berdingiz? Tizim haqiqiy SMS/Telegram yubormaydi — bu faqat qayd etish uchun.")}
        </p>
      )}
      {serverError && (
        <p role="alert" className={DANGER_BOX}>
          {tr(serverError)}
        </p>
      )}
      <SheetSection title={tr("Kanal")}>
        <div role="radiogroup" aria-label={tr("Kanal")}>
          {CHANNEL_ORDER.map((value) => {
            const active = value === channel;
            return (
              <div key={value} className="group/row relative">
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChannel(value)}
                  className={clsx("flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}
                >
                  <span className="min-w-0 flex-1 text-[15px] text-[var(--color-text)]">{tr(CHANNEL_LABEL[value])}</span>
                  {active && <CheckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
                </button>
                <span className={ROW_SEPARATOR} aria-hidden="true" />
              </div>
            );
          })}
        </div>
      </SheetSection>
    </IosSheet>
  );
}
