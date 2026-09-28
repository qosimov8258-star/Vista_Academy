"use client";

import clsx from "clsx";
import { Card } from "@/components/ui/card";
import { CheckIcon } from "@/components/ui/icons";
import { THEMES, useTheme } from "@/lib/theme";

/**
 * Sozlamalar → Tizim rangi. Bosilishi bilan butun panel (tugmalar, yon
 * panel, faol bo'limlar, qidiruv, ikonkalar) shu rangga o'tadi; tanlov
 * hisobda saqlanadi — barcha qurilmalarda bir xil.
 */
export function ThemePickerCard() {
  const { theme, setTheme, saving, error } = useTheme();
  const current = THEMES.find((t) => t.key === theme) ?? THEMES[0];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center">
        {/* Kichik jonli namuna — tanlangan rang qanday ko'rinishini ko'rsatadi */}
        <div
          className="relative flex h-[112px] w-full shrink-0 items-center gap-3 overflow-hidden rounded-[22px] bg-[var(--accent-rail)] p-4 transition-colors duration-300 md:w-[220px]"
          aria-hidden="true"
        >
          <span className="flex flex-col gap-2">
            <span className="h-2 w-8 rounded-full bg-white/15" />
            <span className="h-2 w-12 rounded-full bg-white/15" />
            <span className="h-2 w-10 rounded-full bg-white/15" />
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-orb-from)] to-[var(--accent-orb-to)] shadow-[0_8px_20px_-6px_var(--accent-bright)] transition-colors duration-300">
            <CheckIcon className="h-5 w-5 text-[var(--accent-orb-ink)]" />
          </span>
          <span className="ml-auto flex flex-col items-end gap-2">
            <span className="h-7 w-20 rounded-full bg-[var(--color-primary)] transition-colors duration-300" />
            <span className="h-2 w-14 rounded-full bg-[var(--accent-light)]/60" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">Tizim rangi</p>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            Tugmalar, yon panel, faol bo&apos;limlar va ikonkalar shu rangda bo&apos;ladi. Hozir: <span className="font-semibold text-[var(--color-text)]">{current.label}</span>
            <span className="mt-0.5 block text-[12.5px]">
              {saving ? "Saqlanmoqda…" : "Hisobingizda saqlanadi — barcha qurilmalarda bir xil."}
            </span>
          </p>
          {error && <p className="mt-2 text-[13px] text-[var(--color-danger)]">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-label="Tizim rangi">
            {THEMES.map((t) => {
              const active = t.key === theme;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => void setTheme(t.key)}
                  className={clsx(
                    "relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 active:scale-90",
                    active ? "ring-2 ring-offset-2 ring-offset-[var(--color-surface)]" : "hover:scale-110",
                  )}
                  style={{
                    background: `linear-gradient(145deg, ${t.swatch} 0%, ${t.dark} 130%)`,
                    // Faol rangning halqasi o'z rangida
                    ...(active ? ({ "--tw-ring-color": t.swatch } as React.CSSProperties) : {}),
                  }}
                >
                  {active && <CheckIcon className="h-5 w-5 text-white" strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
