"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";

export interface ToastState {
  type: "success" | "error";
  message: string;
}

/** Ekran burchagidan chiqadigan qisqa muddatli xabar — masalan "Saqlash" tasdiqlanganda. */
export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 2600);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4 sm:inset-x-auto sm:right-4 sm:justify-end">
      <div
        role="status"
        className={clsx(
          "animate-toast-in pointer-events-auto flex items-center gap-2 rounded-full py-2.5 pl-4 pr-3 text-[13.5px] font-medium text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35)]",
          toast.type === "success" ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]",
        )}
      >
        {toast.type === "success" && <CheckIcon className="h-4 w-4 shrink-0" />}
        <span>{toast.message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Xabarni yopish"
          className="ml-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-80 hover:opacity-100"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
