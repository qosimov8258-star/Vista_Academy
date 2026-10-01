"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "@/components/ui/icons";
import { useTr } from "@/i18n/tr";

/**
 * Agent tokeni faqat bir marta — yaratilganda yoki yangilanganda —
 * ko'rsatiladi. Bazada faqat hash'i saqlanadi, shuning uchun oyna yopilgach
 * uni qayta ko'rib bo'lmaydi (yo'qolsa — "Yangi token").
 */
export function AgentTokenModal({ token, deviceName, onClose }: { token: string | null; deviceName: string; onClose: () => void }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard ruxsati yo'q — foydalanuvchi matnni qo'lda belgilab oladi
    }
  };

  return (
    <Modal open={!!token} onClose={onClose} title={tr("Agent tokeni")}>
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          <b className="text-[var(--color-text)]">{tr(deviceName)}</b> {tr("uchun obyektdagi")}{" "}<code>hik-agent</code> {tr("shu token bilan ulanadi. Uni agentning")}{" "}<code>.env</code> {tr("faylidagi")}{" "}<code>AGENT_TOKENS</code> {tr("ga qo'ying.")}
        </p>
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface-sunken)] p-3">
          <code className="min-w-0 flex-1 select-all break-all font-mono text-[13px] text-[var(--color-text)]">{tr(token)}</code>
          <button
            type="button"
            onClick={copy}
            aria-label={tr("Nusxalash")}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--color-text)]"
          >
            <CopyIcon className="h-4 w-4" />
          </button>
        </div>
        {copied && <p className="text-[13px] text-[var(--color-success)]">{tr("Nusxalandi")}</p>}
        <div role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3 py-2.5 text-[13px] text-[var(--color-warning)]">
          {tr("Token boshqa ko'rsatilmaydi. Yo'qolsa — \"Yangi token\" bilan yangisini yarating (eskisi darhol bekor bo'ladi).")}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>{tr("Saqladim")}</Button>
        </div>
      </div>
    </Modal>
  );
}
