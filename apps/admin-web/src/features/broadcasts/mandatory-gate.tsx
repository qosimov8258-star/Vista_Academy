"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { BadgeCheck, Check, Clock, Mail } from "lucide-react";
import styles from "./message-popup.module.css";
import { MessageBanner } from "./message-banner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { receivesEmployeeNotifications } from "@/lib/permissions";
import type { InboxMessage } from "@/lib/types";
import { Spinner } from "@/components/ios/spinner";
import { useEmployeeInbox } from "./use-inbox";
import { useTr } from "@/i18n/tr";

/**
 * Xabar oynasi — ikki rejim:
 * - `mandatory`: o'qilmagan majburiy xabar ekran ustida yopilmaydigan oyna
 *   bo'lib chiqadi — «O'qidim» bosilmaguncha kabinetdan foydalanib bo'lmaydi;
 * - `new`: oddiy yangi (o'qilmagan) xabar ham kabinetga kirganda (yoki ochiq
 *   turganda kelsa) ekranga chiqadi — «O'qidim» yoki «Keyinroq»; «Keyinroq»
 *   bosilgani shu tab davomida qayta chiqmaydi (qo'ng'iroqchada turaveradi).
 * Bir nechta bo'lsa, eng eskisidan boshlab navbat bilan; majburiylari oldin.
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

/** iOS bildirishnomasidagidek vaqt: «hozir», «5 daq oldin», bugun — soat, aks holda sana */
function timeAgo(iso: string, tr: (key: string, ...args: (string | number)[]) => string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return tr("hozir");
  if (min < 60) return tr("{0} daq oldin", min);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "2-digit" });
}

export function MandatoryMessageModal({
  messages,
  onAcknowledge,
  pendingId,
  palette = PANEL_PALETTE,
  portal = true,
  mode = "mandatory",
  hidden = [],
  onLater,
  onlyId,
}: {
  messages: InboxMessage[];
  onAcknowledge: (id: string) => void;
  pendingId: string | null;
  palette?: MandatoryPalette;
  portal?: boolean;
  mode?: "mandatory" | "new";
  /** `new` rejimida «Keyinroq» bosilgan xabarlar */
  hidden?: string[];
  onLater?: (id: string) => void;
  /** `new` rejimida faqat shu xabar (bannerdan ochilgani) */
  onlyId?: string;
}) {
  const tr = useTr();
  const isNew = mode === "new";
  const queue = messages
    .filter((m) => !m.readAt && (isNew ? !m.isMandatory && !hidden.includes(m.id) && (!onlyId || m.id === onlyId) : m.isMandatory))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const current = queue[0];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (current) buttonRef.current?.focus({ preventScroll: true });
  }, [current]);

  useEffect(() => {
    if (!isNew || !current || !onLater) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onLater(current.id);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNew, current, onLater]);

  if (!mounted || !current) return null;
  const pending = pendingId === current.id;
  const tint = isNew ? palette.accent : "#ff3b30";
  // Shisha: karta rangi yarim shaffof (ota-ona kabinetining qorong'i rejimida ham mos)
  const glassBg = `color-mix(in srgb, ${palette.card} 80%, transparent)`;
  const later = isNew && onLater ? () => onLater(current.id) : undefined;
  const modal = (
    <div
      className={clsx(styles.backdrop, "fixed inset-0 z-[90] flex justify-center overflow-y-auto px-2 pb-6 sm:items-center sm:px-6")}
      style={{ paddingTop: "max(56px, calc(env(safe-area-inset-top) + 20px))" }}
      // Oddiy xabarni fonni bosib ham «keyinroq»ga qoldirish mumkin; majburiysi — yo'q
      onClick={later ? (e) => e.target === e.currentTarget && later() : undefined}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="message-popup-title" className="w-full max-w-[420px] sm:-mt-10">
        {/* Bildirishnoma kartasi; orqada — navbatdagi xabarlar qatlamlari */}
        <div key={current.id} className={clsx(styles.drop, "relative")}>
          {queue.length > 1 && (
            <>
              {queue.length > 2 && (
                <span aria-hidden="true" className={clsx(styles.glass, "absolute inset-x-6 -bottom-[14px] h-[10px] rounded-b-[14px]")} style={{ backgroundColor: glassBg, opacity: 0.55 }} />
              )}
              <span aria-hidden="true" className={clsx(styles.glass, "absolute inset-x-3 -bottom-[7px] h-[10px] rounded-b-[16px]")} style={{ backgroundColor: glassBg, opacity: 0.8 }} />
            </>
          )}
          <div className={clsx(styles.glass, "relative rounded-[22px] px-3.5 pb-3.5 pt-3")} style={{ backgroundColor: glassBg }}>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] text-white" style={{ backgroundColor: tint }}>
                {isNew ? <Mail className="h-[21px] w-[21px]" strokeWidth={2.2} /> : <BadgeCheck className="h-[21px] w-[21px]" strokeWidth={2.2} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold uppercase tracking-[0.02em]" style={{ color: tint }}>
                    {tr(isNew ? "Yangi xabar" : "Muhim xabar")}
                  </p>
                  <span className="shrink-0 text-[13px] tabular-nums" style={{ color: palette.muted }}>
                    {timeAgo(current.createdAt, tr)}
                  </span>
                </div>
                <h2 id="message-popup-title" className="mt-0.5 break-words text-[15px] font-semibold leading-snug" style={{ color: palette.ink }}>
                  {current.title}
                </h2>
                <p className="mt-0.5 max-h-[45dvh] overflow-y-auto whitespace-pre-line break-words text-[15px] leading-[1.38]" style={{ color: palette.ink }}>
                  {current.body}
                </p>
                <p className="mt-1.5 truncate text-[13px]" style={{ color: palette.muted }}>
                  {tr(current.from)}
                  {queue.length > 1 && ` · ${tr("yana {0} ta", queue.length - 1)}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Amallar — iOS'dagidek alohida shisha ro'yxat */}
        <div
          key={`${current.id}-a`}
          className={clsx(styles.glass, styles.actions, "mt-3.5 overflow-hidden rounded-[16px]", queue.length > 1 && "mt-6")}
          style={{ backgroundColor: glassBg }}
        >
          <button
            ref={buttonRef}
            type="button"
            disabled={pending}
            onClick={() => onAcknowledge(current.id)}
            className="flex h-[50px] w-full items-center justify-between gap-3 px-4 text-left text-[17px] font-semibold outline-none transition-colors active:bg-black/[0.06] disabled:opacity-60"
            style={{ color: tint }}
          >
            <span>{tr(isNew ? "O'qidim" : "O'qidim va tanishdim")}</span>
            {pending ? <Spinner className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />}
          </button>
          {later && (
            <button
              type="button"
              disabled={pending}
              onClick={later}
              className="flex h-[50px] w-full items-center justify-between gap-3 border-t px-4 text-left text-[17px] outline-none transition-colors active:bg-black/[0.06] disabled:opacity-60"
              style={{ color: palette.ink, borderColor: "color-mix(in srgb, currentColor 12%, transparent)" }}
            >
              <span>{tr("Keyinroq")}</span>
              <Clock className="h-5 w-5" strokeWidth={2.2} style={{ color: palette.muted }} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
  return portal ? createPortal(modal, document.body) : modal;
}

const LATER_KEY = "broadcast-later";

/** «Keyinroq» bosilgan xabarlar — shu tab davomida (sessionStorage) */
export function useLaterMessages() {
  const [later, setLater] = useState<string[]>([]);
  useEffect(() => {
    try {
      setLater(JSON.parse(sessionStorage.getItem(LATER_KEY) ?? "[]"));
    } catch {
      setLater([]);
    }
  }, []);
  const add = (id: string) =>
    setLater((prev) => {
      const next = [...new Set([...prev, id])];
      try {
        sessionStorage.setItem(LATER_KEY, JSON.stringify(next));
      } catch {
        // xotira yopiq bo'lsa — shu sahifa davomida eslab qoladi
      }
      return next;
    });
  return { later, add };
}

/**
 * Kabinetdagi xabar oynalari: avval o'qilmagan majburiylar (yopilmaydi),
 * ular tugagach — o'qilmagan yangi xabarlar («O'qidim» / «Keyinroq»).
 */
export function MessageGate({
  messages,
  onRead,
  pendingId,
  palette,
  portal,
}: {
  messages: InboxMessage[];
  onRead: (id: string) => void;
  pendingId: string | null;
  palette?: MandatoryPalette;
  portal?: boolean;
}) {
  const tr = useTr();
  const { later, add } = useLaterMessages();
  // Bannerdan ochilgan xabar va «O'qidim» bosilganlari (server javobi kelguncha banner qaytmasin)
  const [openId, setOpenId] = useState<string | null>(null);
  const [acked, setAcked] = useState<string[]>([]);
  const mandatoryPending = messages.some((m) => m.isMandatory && !m.readAt);
  if (mandatoryPending) {
    return <MandatoryMessageModal messages={messages} onAcknowledge={onRead} pendingId={pendingId} palette={palette} portal={portal} />;
  }
  const open = openId ? messages.find((m) => m.id === openId && !m.readAt && !acked.includes(m.id)) : undefined;
  if (open) {
    return (
      <MandatoryMessageModal
        messages={messages}
        onlyId={open.id}
        mode="new"
        palette={palette}
        portal={portal}
        pendingId={pendingId}
        onAcknowledge={(id) => {
          setAcked((l) => [...l, id]);
          setOpenId(null);
          onRead(id);
        }}
        onLater={(id) => {
          add(id);
          setOpenId(null);
        }}
      />
    );
  }
  const queue = messages
    .filter((m) => !m.readAt && !m.isMandatory && !later.includes(m.id) && !acked.includes(m.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <MessageBanner
      queue={queue}
      palette={palette ?? PANEL_PALETTE}
      portal={portal}
      timeLabel={(iso) => timeAgo(iso, tr)}
      onOpen={setOpenId}
      onDismiss={add}
    />
  );
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
  return <MessageGate messages={inbox.data} onRead={(id) => read.mutate(id)} pendingId={read.isPending ? (read.variables ?? null) : null} />;
}
