"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/ui/icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
}

export function Modal({ open, onClose, title, children, widthClassName = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      {/* Xiralashgan fon — ostidagi sahifa yo'qolmaydi, faqat orqaga chekinadi */}
      <div className="animate-overlay-in absolute inset-0 bg-black/25 backdrop-blur-[20px]" onClick={onClose} />
      <div
        className={`animate-sheet-in relative w-full ${widthClassName} max-h-[90vh] overflow-y-auto scrollbar-thin rounded-[var(--radius-2xl)] bg-[var(--color-surface)] shadow-[var(--shadow-modal)]`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <h2 className="text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
            {title}
          </h2>
          {/* iOS uslubidagi dumaloq yopish tugmasi */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
            aria-label="Yopish"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
