"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckIcon, CopyIcon } from "./icons";
import { ROW_SEPARATOR } from "./tokens";
import { useTr } from "@/i18n/tr";

/** Bir martalik ko'rsatiladigan qiymat (login/parol) — o'ngda nusxalash tugmasi. `GROUP_BLOCK` ichida. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard ruxsati yo'q — qiymat ekranda ko'rinib turadi
    }
  };
  return (
    <div className="group/row relative flex min-h-[52px] items-center gap-3 pl-4 pr-2">
      <span className="w-[72px] shrink-0 text-[15px] text-[var(--color-text)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[15px] text-[var(--color-text)]">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={tr("Nusxalash")}
        className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#767680]/[0.12]", copied ? "text-[#34c759]" : "text-[var(--color-primary)]")}
      >
        {copied ? <CheckIcon className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <CopyIcon className="h-[18px] w-[18px]" />}
      </button>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}
