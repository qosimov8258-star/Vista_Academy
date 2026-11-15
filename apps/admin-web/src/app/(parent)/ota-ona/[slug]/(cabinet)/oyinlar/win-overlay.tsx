"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { ArrowRight, RotateCcw } from "lucide-react";
import parentStyles from "../../parent.module.css";
import styles from "./oyinlar.module.css";
import { GameStar } from "./ui";
import { useTr } from "@/i18n/tr";

const CONFETTI_COLORS = ["var(--p-sun)", "var(--p-red)", "var(--p-mint)", "var(--p-sky)", "var(--p-lilac)", "#ffcc00"];

/**
 * G'alaba oynasi — barcha o'yinlar uchun bitta: tepadan konfetti yog'adi,
 * yulduzchalar birin-ketin «sakrab» chiqadi, ostida uchta yo'l (keyingi
 * daraja, yana o'ynash, chiqish). Yutqazish yo'q — eng kami bitta yulduz.
 * Ranglar sahnadagi mavzu rangidan (`--g`).
 */
export function WinOverlay({
  stars,
  subtitle,
  onAgain,
  onNext,
  onTopics,
  topicsLabel = "Boshqa mavzu",
}: {
  stars: 1 | 2 | 3;
  /** Tarjima qilingan izoh, masalan «3 ta juftni 4 urinishda topding» */
  subtitle: string;
  onAgain: () => void;
  onNext: (() => void) | null;
  onTopics: () => void;
  topicsLabel?: string;
}) {
  const tr = useTr();
  const title = stars === 3 ? "Zo'r!" : stars === 2 ? "Barakalla!" : "Yaxshi!";
  // Konfetti bo'laklari: joyi, tezligi va burilishi indeksdan — har safar bir xil, tasodifsiz
  const confetti = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        "--x": `${(i * 37) % 100}%`,
        "--d": `${2.2 + ((i * 13) % 14) / 10}s`,
        "--delay": `${((i * 7) % 12) / 10}s`,
        "--sway": `${((i % 7) - 3) * 14}px`,
        "--rot": `${(i % 2 ? 1 : -1) * (360 + i * 31)}deg`,
      })) as React.CSSProperties[],
    [],
  );

  return (
    <div className={clsx(styles.winBackdrop, "absolute inset-0 z-20 flex items-center justify-center bg-black/30 px-5 backdrop-blur-[3px]")}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {confetti.map((style, i) => (
          <span key={i} className={styles.confettiFall} style={style} />
        ))}
      </div>

      <div
        className={clsx(styles.winCard, "relative w-full max-w-[360px] overflow-hidden rounded-[32px] bg-[var(--p-card)] text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]")}
        role="dialog"
        aria-modal="true"
        aria-label={tr(title)}
      >
        {/* Tepa: mavzu rangidagi yoyilma, nur va yulduzlar */}
        <div
          className="relative px-6 pb-4 pt-8"
          style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--g) 30%, var(--p-card)) 0%, var(--p-card) 100%)" }}
        >
          <span
            aria-hidden="true"
            className={clsx(styles.glow, "pointer-events-none absolute left-1/2 top-3 h-[150px] w-[150px] -translate-x-1/2 rounded-full")}
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--p-sun) 45%, transparent) 0%, transparent 68%)" }}
          />
          <div className="relative flex items-end justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className={parentStyles.starPop} style={{ animationDelay: `${0.2 + i * 0.2}s` }}>
                <GameStar filled={i < stars} size={i === 1 ? 78 : 58} className={i === 1 ? "" : "mb-1.5"} />
              </span>
            ))}
          </div>
          <h2 className={clsx(parentStyles.roundedFont, "relative mt-3 text-[36px] leading-none text-[var(--p-ink)]")}>{tr(title)}</h2>
          <p className="relative mt-2.5 text-[15px] leading-snug text-[var(--p-ink)]/60">{subtitle}</p>
        </div>

        {/* Tugmalar — hajmli, bosilganda cho'kadi */}
        <div className="space-y-3 px-5 pb-5 pt-2">
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className={clsx(styles.btn3d, parentStyles.roundedFont, "flex h-14 w-full items-center justify-center gap-2 rounded-full text-[18px] text-white")}
              style={{ "--btn": "var(--g)" } as React.CSSProperties}
            >
              {tr("Keyingi daraja")}
              <ArrowRight className="h-5 w-5" strokeWidth={2.8} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onAgain}
            className={clsx(
              styles.btn3d,
              parentStyles.roundedFont,
              "flex h-14 w-full items-center justify-center gap-2 rounded-full text-[18px]",
              onNext ? "text-[var(--p-ink)]" : "text-white",
            )}
            style={{ "--btn": onNext ? "var(--p-sunken)" : "var(--g)" } as React.CSSProperties}
          >
            <RotateCcw className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
            {tr("Yana o'ynash")}
          </button>
          <button
            type="button"
            onClick={onTopics}
            className="flex h-11 w-full items-center justify-center rounded-full text-[15.5px] font-semibold text-[var(--p-ink)]/55 active:scale-[0.97]"
          >
            {tr(topicsLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}
