"use client";

import { useState } from "react";
import clsx from "clsx";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { CheckIcon, CopyIcon } from "@/components/ios/icons";
import { IOS } from "@/components/ios/tokens";
import { TintNote } from "./shared";
import { useTr } from "@/i18n/tr";

/**
 * Agent tokeni faqat bir marta — yaratilganda yoki yangilanganda —
 * ko'rsatiladi. Bazada faqat hash'i saqlanadi, shuning uchun varaq yopilgach
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
    <IosSheet
      open={!!token}
      onClose={onClose}
      title={tr("Agent tokeni")}
      cancelLabel="Yopish"
      footer={<SheetPrimaryButton onClick={onClose}>{tr("Saqladim")}</SheetPrimaryButton>}
    >
      <SheetSection
        title={tr(deviceName)}
        footer={
          <>
            {tr("Obyektdagi hik-agent shu token bilan ulanadi. Uni agentning .env faylidagi AGENT_TOKENS ga qo'ying.")}
          </>
        }
      >
        <div className="flex items-center gap-2 py-1.5 pl-4 pr-2">
          <code className="min-w-0 flex-1 select-all break-all py-2 font-mono text-[14px] leading-snug text-[var(--color-text)]">{token}</code>
          <button
            type="button"
            onClick={copy}
            aria-label={tr("Nusxalash")}
            className={clsx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#767680]/[0.12]",
              copied ? "text-[#34c759]" : "text-[var(--color-primary)]",
            )}
          >
            {copied ? <CheckIcon className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <CopyIcon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </SheetSection>
      <TintNote color={IOS.orange}>
        {tr("Token boshqa ko'rsatilmaydi. Yo'qolsa — \"Yangi token\" bilan yangisini yarating (eskisi darhol bekor bo'ladi).")}
      </TintNote>
    </IosSheet>
  );
}
