"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import { locales, localeCookieName, type Locale } from "@/i18n/config";
import { GlobeIcon, ChevronDownIcon } from "@/components/ui/icons";

export function LanguageSwitcher({ collapsed = false, dropUp = false }: { collapsed?: boolean; dropUp?: boolean }) {
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
          "flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold text-[var(--color-text-muted)] outline-none transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)] disabled:opacity-60",
          collapsed ? "w-9" : "px-3",
        )}
      >
        <GlobeIcon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="uppercase">{locale}</span>}
        {!collapsed && <ChevronDownIcon className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />}
      </button>

      {open && (
        <div
          className={clsx(
            "absolute z-50 w-40 overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-white p-1.5 shadow-[var(--shadow-modal,0_20px_40px_rgba(0,0,0,0.12))]",
            collapsed && dropUp && "bottom-0 left-full ml-2",
            collapsed && !dropUp && "top-0 left-full ml-2",
            !collapsed && dropUp && "bottom-full left-0 mb-2",
            !collapsed && !dropUp && "top-full right-0 mt-2",
          )}
        >
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => changeLocale(code)}
              className={clsx(
                "flex w-full items-center rounded-[10px] px-3 py-2 text-left text-[14px] font-medium transition-colors hover:bg-[var(--color-tint,rgba(0,0,0,0.04))]",
                code === locale ? "text-[var(--color-primary)]" : "text-[var(--color-text)]",
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
