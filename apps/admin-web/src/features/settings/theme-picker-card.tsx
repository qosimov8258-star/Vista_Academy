"use client";

import { useState } from "react";
import clsx from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, GlobeIcon } from "@/components/ios/icons";
import { Palette as PaletteIcon } from "lucide-react";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { applyLocale } from "@/components/ui/language-switcher";
import { locales, type Locale } from "@/i18n/config";
import { THEMES, useTheme } from "@/lib/theme";
import { RowIcon, SettingsGroup, SettingsRow, usePlainSettingsIcons } from "./settings-ui";
import { useTr } from "@/i18n/tr";

/**
 * Sozlamalar → Ko'rinish: tizim rangi va til. Rang bosilishi bilan butun
 * panel shu rangga o'tadi va hisobga yoziladi — barcha qurilmalarda bir xil.
 */
export function ThemePickerCard() {
  const tr = useTr();
  const { theme, setTheme, saving, error } = useTheme();
  const current = THEMES.find((t) => t.key === theme) ?? THEMES[0];
  // Namuna va ranglar ikonkadan keyingi matn chizig'idan boshlanadi
  const indent = usePlainSettingsIcons() ? "sm:ml-[36px]" : "sm:ml-[44px]";

  return (
    <SettingsGroup
      title={tr("Ko'rinish")}
      footer={
        error ? (
          <span className="text-[var(--color-danger)]">{tr(error)}</span>
        ) : (
          tr("Rang hisobingizda saqlanadi — telefon va kompyuterda bir xil bo'ladi.")
        )
      }
    >
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-3.5">
          <RowIcon icon={PaletteIcon} />
          <span className="min-w-0 flex-1 text-[15.5px] text-[var(--color-text)]">{tr("Tizim rangi")}</span>
          <span className="text-[15px] text-[var(--color-text-muted)]">{saving ? "Saqlanmoqda…" : current.label}</span>
        </div>

        {/* Jonli namuna — yon panel va tugma tanlangan rangda */}
        <div className={`mt-3.5 flex items-center gap-3 rounded-[18px] bg-[var(--accent-rail)] p-3 transition-colors duration-300 ${indent}`} aria-hidden="true">
          <span className="flex flex-col gap-1.5 pl-1">
            <span className="h-1.5 w-7 rounded-full bg-white/20" />
            <span className="h-1.5 w-10 rounded-full bg-white/20" />
            <span className="h-1.5 w-8 rounded-full bg-white/20" />
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-orb-from)] to-[var(--accent-orb-to)] transition-colors duration-300">
            <CheckIcon className="h-4 w-4 text-[var(--accent-orb-ink)]" />
          </span>
          <span className="ml-auto h-8 w-24 rounded-full bg-[var(--color-primary)] transition-colors duration-300" />
        </div>

        <div className={`mt-3.5 grid grid-cols-8 gap-2 sm:flex sm:flex-wrap sm:gap-3 ${indent}`} role="radiogroup" aria-label={tr("Tizim rangi")}>
          {THEMES.map((t) => {
            const active = t.key === theme;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={tr(t.label)}
                title={tr(t.label)}
                onClick={() => void setTheme(t.key)}
                className={clsx(
                  "relative flex aspect-square w-full max-w-[44px] cursor-pointer items-center justify-center justify-self-center rounded-full transition-transform duration-200 active:scale-90 sm:h-10 sm:w-10",
                  active ? "ring-2 ring-offset-2 ring-offset-[var(--color-surface)]" : "hover:scale-110",
                )}
                style={{
                  background: `linear-gradient(145deg, ${t.swatch} 0%, ${t.dark} 130%)`,
                  // Faol rangning halqasi o'z rangida
                  ...(active ? ({ "--tw-ring-color": t.swatch } as React.CSSProperties) : {}),
                }}
              >
                {active && <CheckIcon className="h-4 w-4 text-white" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      </div>
      <LanguageRow />
    </SettingsGroup>
  );
}

/**
 * Til qatori: bosilsa pastdan tillar ro'yxati ochiladi (tanlangani ✓ bilan).
 * Avval qator ichida ochiladigan menyu edi — u kartaning `overflow-hidden`
 * chegarasida kesilib, tarbiyachi telefonda tilni tanlay olmasdi.
 */
function LanguageRow() {
  const tr = useTr();
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<Locale | null>(null);

  const choose = (next: Locale) => {
    if (next === locale) {
      setOpen(false);
      return;
    }
    setSwitching(next);
    applyLocale(next);
  };

  return (
    <>
      <SettingsRow icon={GlobeIcon} label={tr("Til")} value={t(`languages.${locale}`)} onClick={() => setOpen(true)} />
      <IosSheet open={open} onClose={() => !switching && setOpen(false)} title={tr("Til")} cancelLabel="Orqaga">
        <SheetSection>
          <div role="radiogroup" aria-label={tr("Til")}>
            {locales.map((code) => {
              const active = code === (switching ?? locale);
              return (
                <div key={code} className="group/row relative">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!!switching}
                    onClick={() => choose(code)}
                    className={clsx("flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-60", ROW_PRESS)}
                  >
                    <span className="min-w-0 flex-1 truncate text-[16px] text-[var(--color-text)]">{t(`languages.${code}`)}</span>
                    {active && <CheckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
                  </button>
                  <span className={ROW_SEPARATOR} aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </SheetSection>
      </IosSheet>
    </>
  );
}
