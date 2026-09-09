"use client";

import type { ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

/**
 * Ortga qaytarib bo'lmaydigan amaldan oldingi tasdiq. Ilgari bunday
 * komponent yo'q edi va bitta joyda brauzerning `confirm()` i ishlatilgan —
 * u sahifa uslubiga umuman mos kelmaydi va matnni uzbekchalashtirib
 * bo'lmaydi.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone = "default",
  loading,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} widthClassName="max-w-md">
      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]">
            {error}
          </div>
        )}
        <div className="text-[15px] leading-relaxed text-[var(--color-text-muted)]">{description}</div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
