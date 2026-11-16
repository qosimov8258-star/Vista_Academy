"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "../parent.module.css";
import { useTr } from "@/i18n/tr";

/**
 * Pastdan chiqadigan oyna (iOS sheet) — bosh sahifadagi tezkor amallar uchun.
 * Kabinet qobig'iga (`.shell`) portal qilinadi: sahifa o'tish animatsiyasidagi
 * `transform` `position: fixed` ni buzmasin va mavzu ranglari saqlansin.
 * Esc, fon yoki ✕ bilan yopiladi; ochiq turganda sahifa aylanmaydi.
 */
export function HomeSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const tr = useTr();
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost((anchor.current?.closest(`.${styles.shell}`) as HTMLElement | null) ?? document.body);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <>
      <span ref={anchor} hidden />
      {host &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
            <button type="button" aria-label={tr("Yopish")} onClick={onClose} className={`${styles.fadeIn} absolute inset-0 cursor-default bg-black/40`} />
            <div
              className={`${styles.sheetIn} relative w-full max-w-[520px] rounded-t-[28px] bg-[var(--p-card)] px-4 pt-2.5 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.3)]`}
              style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}
            >
              <span className="mx-auto block h-[5px] w-9 rounded-full bg-[var(--p-chevron)]" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3 pb-3.5 pt-3">
                <h2 className="min-w-0 truncate text-[19px] font-bold tracking-[-0.02em] text-[var(--p-ink)]">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={tr("Yopish")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--p-sunken)] text-[var(--p-muted)] active:scale-95"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                </button>
              </div>
              {children}
            </div>
          </div>,
          host,
        )}
    </>
  );
}
