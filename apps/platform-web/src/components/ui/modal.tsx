"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import { IconButton } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  widthClassName?: string;
}

/**
 * iOS "sheet" uslubidagi oyna: fon qorayadi, panel esa pastdan yengil
 * ko'tarilib chiqadi. Blur/glass ishlatilmaydi — panel qattiq oq yuza.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  widthClassName = "max-w-lg",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Oyna ochilganda fokus ichkariga o'tsin — klaviatura orqasidagi
    // sahifada qolib ketmasin.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="animate-scrim-in absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`animate-sheet-in relative w-full outline-none ${widthClassName} max-h-[92vh] overflow-y-auto scrollbar-thin rounded-t-[24px] bg-[var(--color-surface)] shadow-[var(--shadow-modal)] sm:rounded-[22px]`}
      >
        {/* Telefonda sheet'ni pastga tortish mumkinligini bildiruvchi tutqich */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-[var(--color-border)]" />
        </div>
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-[17px] font-semibold text-[var(--color-text)]">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{description}</p>
            )}
          </div>
          <IconButton label="Yopish" onClick={onClose} className="-mr-1 shrink-0">
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="border-t border-[var(--color-separator)] px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
