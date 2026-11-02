"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { IosButton } from "@/components/ios/button";
import { useTr } from "@/i18n/tr";

/** Guruh to'lgan: server rad etgach xodimdan so'raladi — ortiqcha bola ataylab qo'shiladi. */
export function GroupFullPrompt({
  message,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tr = useTr();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return (
    <div ref={ref} className="rounded-[14px] bg-[#ff9500]/[0.12] px-4 py-3">
      <p className="flex items-start gap-2 text-[14px] leading-snug text-[var(--color-text)]">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9500]" strokeWidth={2.4} />
        <span>{tr("{0}. Baribir qo'shilsinmi? Guruh sig'imi oshadi.", message)}</span>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <IosButton label={tr("Boshqa guruh")} variant="pill" onClick={onCancel} disabled={loading} />
        <IosButton label={tr(confirmLabel)} variant="primary" onClick={onConfirm} loading={loading} />
      </div>
    </div>
  );
}
