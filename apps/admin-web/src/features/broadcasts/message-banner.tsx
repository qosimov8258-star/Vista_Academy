"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Mail } from "lucide-react";
import type { InboxMessage } from "@/lib/types";
import type { MandatoryPalette } from "./mandatory-gate";
import styles from "./message-popup.module.css";
import { useTr } from "@/i18n/tr";

/** Banner o'zi yopilguncha (tegilmasa) — iOS'dagidek qisqa, lekin o'qib ulgurish uchun yetarli */
const AUTO_HIDE_MS = 8000;

/**
 * Yangi xabar — iPhone'ga push kelgandagidek: ekran tepasidan kichik shisha
 * banner tushadi, kabinet xiralashmaydi. Bosilsa — xabar to'liq ochiladi
 * (`onOpen`); tepaga surilsa yoki 8 soniya tegilmasa — yopiladi (`onDismiss`,
 * xabar o'qilmagan bo'lib qoladi). Bir nechta bo'lsa — navbat bilan, ostida
 * qatlamlar ko'rinadi.
 */
export function MessageBanner({
  queue,
  palette,
  portal = true,
  timeLabel,
  onOpen,
  onDismiss,
}: {
  queue: InboxMessage[];
  palette: MandatoryPalette;
  portal?: boolean;
  timeLabel: (iso: string) => string;
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const tr = useTr();
  const current = queue[0];
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [hover, setHover] = useState(false);
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);
  useEffect(() => setMounted(true), []);

  // Yangi xabar kelganda holat boshidan
  useEffect(() => {
    setLeaving(false);
    setDragY(0);
  }, [current?.id]);

  const dismiss = () => {
    if (!current || leaving) return;
    setLeaving(true);
    window.setTimeout(() => onDismiss(current.id), 280);
  };

  // O'zi yopilishi — sichqoncha ustida yoki surilayotganda to'xtaydi
  useEffect(() => {
    if (!current || leaving || hover || drag.current) return;
    const t = window.setTimeout(dismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, leaving, hover]);

  if (!mounted || !current) return null;
  const glassBg = `color-mix(in srgb, ${palette.card} 82%, transparent)`;

  const banner = (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-2" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
      <div
        key={current.id}
        role="status"
        aria-live="polite"
        className={clsx("pointer-events-auto relative w-full max-w-[420px] touch-none select-none", leaving ? styles.bannerOut : styles.bannerIn)}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: drag.current ? "none" : undefined }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onPointerDown={(e) => {
          drag.current = { startY: e.clientY, moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dy = e.clientY - drag.current.startY;
          if (Math.abs(dy) > 4) drag.current.moved = true;
          // Faqat tepaga suriladi; pastga — ozgina «rezina»
          setDragY(dy < 0 ? dy : Math.min(dy * 0.2, 12));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          if (dragY < -28) dismiss();
          else {
            setDragY(0);
            if (!d.moved) onOpen(current.id);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragY(0);
        }}
      >
        {/* Navbatdagi xabarlar — banner ostidagi qatlamlar */}
        {queue.length > 1 && (
          <>
            {queue.length > 2 && (
              <span aria-hidden="true" className={clsx(styles.glass, "absolute inset-x-6 -bottom-[13px] h-[10px] rounded-b-[14px]")} style={{ backgroundColor: glassBg, opacity: 0.55 }} />
            )}
            <span aria-hidden="true" className={clsx(styles.glass, "absolute inset-x-3 -bottom-[7px] h-[10px] rounded-b-[16px]")} style={{ backgroundColor: glassBg, opacity: 0.85 }} />
          </>
        )}
        <div className={clsx(styles.glass, "relative flex cursor-pointer gap-3 rounded-[22px] px-3.5 py-3")} style={{ backgroundColor: glassBg }}>
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center self-center rounded-[9px] text-white" style={{ backgroundColor: palette.accent }}>
            <Mail className="h-[21px] w-[21px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-semibold uppercase tracking-[0.02em]" style={{ color: palette.muted }}>
                {tr(current.from)}
              </p>
              <span className="shrink-0 text-[13px] tabular-nums" style={{ color: palette.muted }}>
                {timeLabel(current.createdAt)}
              </span>
            </div>
            <p className="truncate text-[15px] font-semibold leading-snug" style={{ color: palette.ink }}>
              {current.title}
            </p>
            <p className="line-clamp-2 break-words text-[15px] leading-[1.33]" style={{ color: palette.ink }}>
              {current.body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
  return portal ? createPortal(banner, document.body) : banner;
}
