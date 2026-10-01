"use client";

import clsx from "clsx";
import { CheckIcon, GlobeIcon } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { THEMES, useTheme } from "@/lib/theme";
import { RowIcon, SettingsGroup, SettingsRow, usePlainSettingsIcons } from "./settings-ui";
import { useTr } from "@/i18n/tr";

/** Palitra belgisi — "Tizim rangi" qatori uchun */
function PaletteIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6h2c2.3 0 4.1-1.9 4.1-4.1 0-4-3.8-7.3-8.5-7.3Z" />
      <circle cx="7.6" cy="12" r="1.1" fill="currentColor" />
      <circle cx="9.8" cy="7.9" r="1.1" fill="currentColor" />
      <circle cx="14.3" cy="7.9" r="1.1" fill="currentColor" />
    </svg>
  );
}

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
      <SettingsRow icon={GlobeIcon} label={tr("Til")} trailing={<LanguageSwitcher />} />
    </SettingsGroup>
  );
}
