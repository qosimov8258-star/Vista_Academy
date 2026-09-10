"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/ui/icons";

/** Login/parol kabi bir martalik ko'rsatiladigan qiymatlar uchun — nusxalash tugmasi bilan. */
export function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard ruxsati yo'q bo'lsa — jim o'tiladi, qiymat ekranda ko'rinib turadi.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="truncate font-mono text-[15px] text-[var(--color-text)]">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/[0.18]"
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
        {copied ? "Nusxalandi" : "Nusxalash"}
      </button>
    </div>
  );
}
