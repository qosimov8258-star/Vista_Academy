"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { receivesEmployeeNotifications } from "@/lib/permissions";
import type { InboxMessage } from "@/lib/types";
import { Spinner } from "@/components/ios/spinner";
import { useEmployeeInbox } from "./use-inbox";
import { useTr } from "@/i18n/tr";

/**
 * Majburiy xabar oynasi: o'qilmagan majburiy xabar bo'lsa, ekran ustida
 * yopilmaydigan oyna chiqadi — «O'qidim» bosilmaguncha kabinetdan
 * foydalanib bo'lmaydi. Bir nechta bo'lsa, eng eskisidan boshlab navbat bilan.
 * Ranglar `palette` dan: xodim panelida iOS ranglari va tizim rangi, ota-ona
 * kabinetida esa kabinet tokenlari (qorong'i rejim ham). Kabinet tokenlari
 * uning qobig'ida yashaydi — shuning uchun u yerda `portal={false}`.
 */
export interface MandatoryPalette {
  sheet: string;
  card: string;
  ink: string;
  muted: string;
  accent: string;
}

const PANEL_PALETTE: MandatoryPalette = { sheet: "#f2f2f7", card: "#ffffff", ink: "#1c1c1e", muted: "#8e8e93", accent: "var(--color-primary)" };

export function MandatoryMessageModal({
  messages,
  onAcknowledge,
  pendingId,
  palette = PANEL_PALETTE,
  portal = true,
}: {
  messages: InboxMessage[];
  onAcknowledge: (id: string) => void;
  pendingId: string | null;
  palette?: MandatoryPalette;
  portal?: boolean;
}) {
  const tr = useTr();
  const queue = messages.filter((m) => m.isMandatory && !m.readAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const current = queue[0];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (current) buttonRef.current?.focus({ preventScroll: true });
  }, [current]);

  if (!mounted || !current) return null;
  const pending = pendingId === current.id;
  const modal = (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mandatory-title"
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[38px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.45)] sm:w-[480px] sm:rounded-[38px]"
        style={{ backgroundColor: palette.sheet }}
      >
        <div className="flex flex-col items-center gap-2 px-6 pb-3 pt-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#ff3b30] text-white">
            <BadgeCheck className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#ff3b30]">
            {tr("Muhim xabar")}
            {queue.length > 1 && <span style={{ color: palette.muted }}> · {tr("yana {0} ta", queue.length - 1)}</span>}
          </p>
          <h2 id="mandatory-title" className="break-words text-[20px] font-bold leading-tight" style={{ color: palette.ink }}>
            {current.title}
          </h2>
          <p className="text-[13px]" style={{ color: palette.muted }}>
            {current.from} · {new Date(current.createdAt).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <p className="whitespace-pre-line break-words rounded-[18px] px-4 py-3.5 text-[15.5px] leading-relaxed" style={{ backgroundColor: palette.card, color: palette.ink }}>
            {current.body}
          </p>
        </div>
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <button
            ref={buttonRef}
            type="button"
            disabled={pending}
            onClick={() => onAcknowledge(current.id)}
            className="flex h-12 w-full items-center justify-center rounded-full text-[16px] font-semibold text-white transition-transform active:scale-[0.96] disabled:opacity-60"
            style={{ backgroundColor: palette.accent }}
          >
            {pending ? <Spinner className="h-5 w-5 text-white" /> : tr("O'qidim va tanishdim")}
          </button>
        </div>
      </div>
    </div>
  );
  return portal ? createPortal(modal, document.body) : modal;
}

/** Xodim paneli (tarbiyachi, oshpaz) uchun — dashboard qobig'ida turadi */
export function EmployeeMandatoryGate({ slug }: { slug: string }) {
  const { user } = useAuth();
  const enabled = receivesEmployeeNotifications(user?.role);
  const queryClient = useQueryClient();
  const inbox = useEmployeeInbox(slug, enabled);
  const read = useMutation({
    mutationFn: (id: string) => api.patch(`/app/broadcasts/inbox/${id}/read`, {}),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<InboxMessage[]>(["broadcast-inbox", slug], (list) => list?.map((m) => (m.id === id ? { ...m, readAt: new Date().toISOString() } : m)));
    },
  });
  if (!enabled || !inbox.data) return null;
  return <MandatoryMessageModal messages={inbox.data} onAcknowledge={(id) => read.mutate(id)} pendingId={read.isPending ? (read.variables ?? null) : null} />;
}
