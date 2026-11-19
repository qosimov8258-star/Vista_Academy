"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { flyImage } from "./fly";
import type { LogicGame, LogicLevel } from "./games";
import { buildLetterRounds, type LetterRound } from "./rounds";
import { LogicStage, useBoardBox, useLogicRun, type LogicRun } from "./stage";
import { useTr } from "@/i18n/tr";

/**
 * «Qaysi harf?» — rasm va ostida birinchi harfi tushib qolgan so'z
 * («?lma»). Bola harfni bosadi: harf bo'sh joyga uchib boradi, to'g'ri
 * bo'lsa so'z to'ladi («Olma»), noto'g'ri bo'lsa chayqalib qaytadi.
 * So'zlar o'zbekcha qoladi — o'yin o'zbek alifbosini o'rgatadi; ota-ona
 * so'zni birinchi tovushini cho'zib o'qib beradi («O-o-olma»).
 */

const letterImages = (round: LetterRound) => [round.item.image];

export function LetterGame({ slug, game, level }: { slug: string; game: LogicGame; level: LogicLevel }) {
  const tr = useTr();
  const run = useLogicRun({ game, level, build: buildLetterRounds, images: letterImages });
  const [setBoard, box] = useBoardBox();

  return (
    <LogicStage slug={slug} run={run} prompt={tr("Bu so'z qaysi harfdan boshlanadi?")}>
      <div ref={setBoard} className="mx-4 mb-[max(16px,env(safe-area-inset-bottom))] mt-1 flex min-h-0 flex-1 items-center justify-center">
        {box && run.round && <LetterBoard key={run.key} round={run.round} run={run} box={box} />}
      </div>
    </LogicStage>
  );
}

function LetterBoard({ round, run, box }: { round: LetterRound; run: LogicRun; box: { w: number; h: number } }) {
  const tr = useTr();
  const [away, setAway] = useState<string | null>(null);
  const [filled, setFilled] = useState<string | null>(null);
  const spot = useRef<HTMLSpanElement>(null);
  const letters = useRef(new Map<string, HTMLSpanElement>());

  // Rasm, so'z va harflar ekranga sig'adi: uzun so'z («O'rgimchak») kichikroq yoziladi
  const heroSize = Math.max(96, Math.min(170, Math.floor(box.w * 0.44), Math.floor(box.h * 0.27)));
  const wordSize = Math.max(30, Math.min(54, Math.floor((box.w - 24) / (round.rest.length * 0.62 + 2.2))));
  const optionGap = 12;
  const n = round.options.length;
  const option = Math.max(64, Math.min(90, Math.floor((box.w - optionGap * (n - 1)) / n)));
  // Ota-onaga: birinchi tovushni cho'zib o'qish — «O-o-olma», «Sh-sh-sher»
  const stretched = `${round.letter}-${round.letter.toLowerCase()}-${round.word.toLowerCase()}`;

  const choose = async (letter: string) => {
    const from = letters.current.get(letter);
    if (run.locked || !from || !spot.current) return;
    const alive = run.guard();
    const right = letter === round.letter;
    run.setBusy(true);
    setAway(letter);
    await flyImage({
      from,
      to: spot.current,
      text: letter,
      right,
      arrived: () => {
        if (!alive()) return;
        if (right) {
          setFilled(letter);
          run.succeed(round.item.image);
        } else {
          run.fail();
        }
      },
    });
    if (!alive() || right) return;
    setAway(null);
    run.setBusy(false);
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <span className={styles.tile} style={{ width: heroSize, height: heroSize }}>
        <img src={round.item.image} alt={round.word} draggable={false} />
      </span>

      {/* So'z: bo'sh katakcha + qolgan harflar */}
      <div className="flex items-center justify-center gap-1.5" aria-label={filled ? round.word : `?${round.rest}`}>
        <span
          className={clsx(styles.slot, styles.textSlot)}
          data-filled={filled ? "" : undefined}
          style={{ minWidth: Math.round(wordSize * 1.5), height: Math.round(wordSize * 1.45), padding: "0 8px", fontSize: wordSize }}
        >
          <span ref={spot} className={parentStyles.roundedFont}>
            {filled ?? "?"}
          </span>
        </span>
        <span className={clsx(parentStyles.roundedFont, "text-[var(--p-ink)]")} style={{ fontSize: wordSize, lineHeight: 1 }} aria-hidden="true">
          {round.rest}
        </span>
      </div>

      {/* Harflar */}
      <div className="flex items-center justify-center" style={{ gap: optionGap }}>
        {round.options.map((letter, i) => (
          <button
            key={letter}
            type="button"
            onClick={() => choose(letter)}
            disabled={run.locked}
            aria-label={tr("{0} harfi", letter)}
            className={styles.choice}
            style={{ width: option, height: option, animationDelay: `${0.25 + i * 0.07}s`, visibility: away === letter ? "hidden" : undefined }}
          >
            <span
              ref={(node) => {
                if (node) letters.current.set(letter, node);
                else letters.current.delete(letter);
              }}
              className={clsx(parentStyles.roundedFont, "text-[var(--p-ink)]")}
              style={{ fontSize: Math.round(option * (letter.length > 1 ? 0.4 : 0.5)), lineHeight: 1 }}
            >
              {letter}
            </span>
          </button>
        ))}
      </div>

      <p className="max-w-[340px] px-2 text-center text-[13.5px] leading-snug text-[var(--p-ink)]/60">
        {tr("Ota-onaga: so'zni ovoz chiqarib, birinchi tovushini cho'zib o'qing — «{0}»", stretched)}
      </p>
    </div>
  );
}
