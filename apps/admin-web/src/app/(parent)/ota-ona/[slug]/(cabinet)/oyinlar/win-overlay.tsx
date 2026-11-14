"use client";

import { useMemo } from "react";
import clsx from "clsx";
import parentStyles from "../../parent.module.css";
import styles from "./oyinlar.module.css";
import { GameStar } from "./ui";
import { useTr } from "@/i18n/tr";

const CONFETTI_COLORS = ["var(--p-sun)", "var(--p-coral)", "var(--p-mint)", "var(--p-sky)", "var(--p-lilac)"];

/**
 * G'alaba oynasi — barcha o'yinlar uchun bitta: yulduzchalar, konfetti va
 * uchta yo'l (keyingi daraja, yana o'ynash, chiqish). Yutqazish yo'q —
 * eng kami bitta yulduz.
 */
export function WinOverlay({
  stars,
  subtitle,
  toneSolid,
  onAgain,
  onNext,
  onTopics,
  topicsLabel = "Boshqa mavzu",
}: {
  stars: 1 | 2 | 3;
  /** Tarjima qilingan izoh, masalan «3 ta juftni 4 urinishda topding» */
  subtitle: string;
  toneSolid: string;
  topicsLabel?: string;
  onAgain: () => void;
  onNext: (() => void) | null;
  onTopics: () => void;
}) {
  const tr = useTr();
  const title = stars === 3 ? "Zo'r!" : stars === 2 ? "Barakalla!" : "Yaxshi!";
  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const distance = 120 + (i % 5) * 26;
        return {
          "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
          "--dy": `${Math.round(Math.sin(angle) * distance - 40)}px`,
          "--rot": `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
          "--delay": `${(i % 4) * 0.04}s`,
        } as React.CSSProperties;
      }),
    [],
  );

  return (
    <div className={clsx(styles.winBackdrop, "absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-5")}>
      <div
        className={clsx(styles.winCard, "relative w-full max-w-[360px] rounded-[30px] bg-[var(--p-card)] px-6 pb-6 pt-7 text-center shadow-[var(--p-shadow)]")}
        role="dialog"
        aria-modal="true"
        aria-label={tr(title)}
      >
        <span className="pointer-events-none absolute left-1/2 top-12" aria-hidden="true">
          {confetti.map((style, i) => (
            <span key={i} className={parentStyles.confettiPiece} style={style} />
          ))}
        </span>
        <div className="flex items-end justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={parentStyles.starPop} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>
              <GameStar filled={i < stars} size={i === 1 ? 64 : 50} className={i === 1 ? "" : "mb-1"} />
            </span>
          ))}
        </div>
        <h2 className={clsx(parentStyles.roundedFont, "mt-3 text-[32px] font-extrabold leading-tight text-[var(--p-ink)]")}>
          {tr(title)}
        </h2>
        <p className="mt-1 text-[15px] leading-snug text-[var(--p-muted)]">{subtitle}</p>

        <div className="mt-6 space-y-2.5">
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="flex h-[52px] w-full items-center justify-center rounded-full text-[17px] font-bold text-white active:scale-[0.97]"
              style={{ background: toneSolid }}
            >
              {tr("Keyingi daraja")}
            </button>
          )}
          <button
            type="button"
            onClick={onAgain}
            className={clsx(
              "flex h-[52px] w-full items-center justify-center rounded-full text-[17px] font-bold active:scale-[0.97]",
              onNext ? "bg-[var(--p-sunken)] text-[var(--p-ink)]" : "text-white",
            )}
            style={onNext ? undefined : { background: toneSolid }}
          >
            {tr("Yana o'ynash")}
          </button>
          <button
            type="button"
            onClick={onTopics}
            className="flex h-11 w-full items-center justify-center rounded-full text-[15px] font-semibold text-[var(--p-muted)] active:scale-[0.97]"
          >
            {tr(topicsLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}
