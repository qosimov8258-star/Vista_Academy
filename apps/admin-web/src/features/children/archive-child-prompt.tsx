"use client";

import { useEffect, useRef } from "react";
import { Archive } from "lucide-react";
import { IosButton } from "@/components/ios/button";
import { Spinner } from "@/components/ios/spinner";
import { useTr } from "@/i18n/tr";

/**
 * Bolani arxivlashni tasdiqlash — varaq ichidagi ikkinchi bosqich (brauzer
 * `confirm()` emas). Arxivlangan bola guruhdan chiqariladi; to'lovlari,
 * davomati va boshqa ma'lumotlari o'chmaydi, «Bolalar → Arxiv»da turadi.
 */
export function ArchiveChildPrompt({
  childName,
  groupName,
  loading,
  onConfirm,
  onCancel,
}: {
  childName: string;
  groupName: string | null;
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
    <div ref={ref} role="alertdialog" aria-label={tr("Arxivlash")} className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3.5">
      <p className="flex items-start gap-2.5 text-[14.5px] leading-snug text-[var(--color-text)]">
        <Archive className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#ff3b30]" strokeWidth={2.2} />
        <span>
          <b className="font-semibold">{tr(childName)}</b>{" "}
          {groupName ? tr("«{0}» guruhidan chiqariladi va arxivga o'tadi.", tr(groupName)) : tr("arxivga o'tadi.")}{" "}
          <span className="text-[#8e8e93]">{tr("To'lovlari, davomati va boshqa ma'lumotlari saqlanadi. Keyin arxivdan qaytarish mumkin.")}</span>
        </span>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <IosButton label={tr("Qoldirish")} variant="pill" onClick={onCancel} disabled={loading} />
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#ff3b30] px-5 text-[15px] font-semibold text-white transition-transform active:scale-[0.96] disabled:opacity-60"
        >
          {loading && <Spinner className="h-4 w-4" />}
          {tr("Arxivlash")}
        </button>
      </div>
    </div>
  );
}
