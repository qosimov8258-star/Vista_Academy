"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import { locales, localeCookieName, type Locale } from "@/i18n/config";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M2.8 10h14.4" />
      <path d="M10 2.8c2.2 2 3.3 4.5 3.3 7.2s-1.1 5.2-3.3 7.2c-2.2-2-3.3-4.5-3.3-7.2S7.8 4.8 10 2.8Z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

export function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const changeLocale = (next: Locale) => {
    setOpen(false);
    if (next === locale) return;
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000`;
    startTransition(() => router.refresh());
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-label={t("language")}
        aria-expanded={open}
        title={t("language")}
        className={clsx(
          "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold uppercase transition-colors disabled:opacity-60",
          light
            ? "border-white/50 text-white hover:bg-white/10"
            : "border-[var(--color-border)] text-[var(--color-text)]/80 hover:text-[var(--color-text)]",
        )}
      >
        <GlobeIcon className="h-[16px] w-[16px] shrink-0" />
        {locale}
        <ChevronDownIcon className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-white p-1.5 shadow-[var(--shadow-modal,0_20px_40px_rgba(0,0,0,0.12))]">
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => changeLocale(code)}
              className={clsx(
                "flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[14px] font-semibold transition-colors hover:bg-[var(--color-tint)]",
                code === locale ? "text-[var(--color-blue-dark)]" : "text-[var(--color-text)]",
              )}
            >
              {t(`languages.${code}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
