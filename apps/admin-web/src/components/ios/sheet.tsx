"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { GROUP_BLOCK, ROW_SEPARATOR, SECTION_TITLE } from "./tokens";
import { Spinner } from "./spinner";
import styles from "./ios.module.css";
import { useTr } from "@/i18n/tr";

/** Ochiq varaqlar to'plami — Esc faqat eng ustkisini yopadi */
const openStack: string[] = [];

const CLOSE_MS = 420;

/**
 * iOS varag'i — barcha modal/dialoglar shu. Telefonda pastdan chiqadi
 * (tepada tortqich), sm dan markazda 560px. Sarlavha qatori 3 ustunli:
 * chapda "Bekor qilish", o'rtada nom, o'ngda ixtiyoriy amal ("Saqlash").
 * `footer` — bosh barmoq yetadigan pastki keng tugma(lar).
 *
 * Yopilish animatsiyasi davomida mazmun oxirgi holatida "muzlatiladi" —
 * chaqiruvchi ma'lumotni darhol tozalasa ham sarlavha sakramaydi.
 */
export function IosSheet({
  open,
  onClose,
  title,
  cancelLabel = "Bekor qilish",
  action,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  cancelLabel?: string;
  /** O'ng tomondagi matnli tugma (masalan "Saqlash") */
  action?: { label: string; onClick: () => void; ready?: boolean; loading?: boolean };
  footer?: ReactNode;
  children: ReactNode;
}) {
  const tr = useTr();
  const id = useId();
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const snapshot = useRef<{ title: ReactNode; children: ReactNode; footer: ReactNode; action: typeof action } | null>(null);
  if (open) snapshot.current = { title, children, footer, action };
  const view = open ? { title, children, footer, action } : snapshot.current;

  // Ochilish/yopilish: avval DOM'ga qo'yiladi, keyingi kadrda animatsiya
  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setRendered(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Esc — faqat eng ustki varaq; fokus varaqqa o'tadi va yopilganda qaytadi
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    openStack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openStack[openStack.length - 1] === id) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const index = openStack.lastIndexOf(id);
      if (index >= 0) openStack.splice(index, 1);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, id]);

  if (!rendered || !view || typeof document === "undefined") return null;

  const act = view.action;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className={clsx(styles.overlay, "absolute inset-0 bg-black/40 backdrop-blur-[3px]")}
        data-open={visible}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        data-open={visible}
        className={clsx(
          styles.sheet,
          "relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[38px] bg-[#f2f2f7] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.45)] outline-none sm:w-[560px] sm:rounded-[44px]",
        )}
      >
        {/* Tortqich (faqat telefonda) */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
          <span className="h-[5px] w-9 rounded-full bg-[#3c3c43]/30" />
        </div>

        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-3 pt-2 sm:pt-5">
          <button
            type="button"
            onClick={onClose}
            className="justify-self-start rounded-full py-1 text-[17px] text-[var(--color-primary)] transition-opacity active:opacity-50"
          >
            {tr(cancelLabel)}
          </button>
          <h2 id={`${id}-title`} className="max-w-[56vw] truncate text-center text-[17px] font-semibold text-[var(--color-text)] sm:max-w-[300px]">
            {view.title}
          </h2>
          {act ? (
            <button
              type="button"
              onClick={act.onClick}
              disabled={act.loading}
              aria-busy={act.loading || undefined}
              className={clsx(
                "justify-self-end rounded-full py-1 text-[17px] font-semibold text-[var(--color-primary)] transition-opacity active:opacity-50",
                act.ready === false && "opacity-45",
              )}
            >
              {act.loading ? <Spinner className="h-5 w-5" /> : tr(act.label)}
            </button>
          ) : (
            <span />
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          {view.children}
          {view.footer && <div className="space-y-2.5 pt-1">{view.footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Varaq ichidagi bo'lim: sarlavha + oq blok */
export function SheetSection({ title, footer, children }: { title?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title && <h3 className={SECTION_TITLE}>{title}</h3>}
      <div className={GROUP_BLOCK}>{children}</div>
      {footer && <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">{footer}</p>}
    </section>
  );
}

/** Varaq qatori: chapda 108px yorliq, o'ngda qiymat (yoki ramkasiz input) */
export function SheetRow({ label, children, error }: { label: ReactNode; children: ReactNode; error?: boolean }) {
  return (
    <div className={clsx("group/row relative flex min-h-[48px] items-center gap-3 px-4", error && "bg-[#ff3b30]/[0.06]")}>
      <span className="w-[108px] shrink-0 py-3 text-[15px] text-[var(--color-text)]">{label}</span>
      <span className="min-w-0 flex-1 py-3 text-right text-[15px] text-[#8e8e93]">{children}</span>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/** Varaq pastidagi keng asosiy tugma (h-12, brend rang) */
export function SheetPrimaryButton({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const className =
    "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] text-[16px] font-semibold text-white shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--color-primary)_55%,transparent)] transition-transform active:scale-[0.96]";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
