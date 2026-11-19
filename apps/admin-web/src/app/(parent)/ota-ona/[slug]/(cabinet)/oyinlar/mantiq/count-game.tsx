"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { flyImage } from "./fly";
import type { LogicGame, LogicLevel } from "./games";
import { buildCountRounds, type CountRound } from "./rounds";
import { LogicStage, useBoardBox, useLogicRun, type LogicRun } from "./stage";
import { useTr } from "@/i18n/tr";

/**
 * «Nechta?» — maydonda bir xil rasmlar aralash turadi. Bola ularni bittalab
 * bosib sanaydi: bosilgan rasmda tartib raqami chiqadi va har safar bir nota
 * baland yangraydi (do, re, mi…) — har narsani bir martadan sanashni
 * o'rganadi. Keyin pastdagi raqamni bosadi: raqam «?» katakchasiga uchib
 * boradi, noto'g'ri bo'lsa chayqalib qaytadi. Sanamasdan ham javob berish
 * mumkin — sanash yordam, majburiy emas.
 */

const countImages = (round: CountRound) => [round.item.image];

/** Maydon 5 ustun × 3 qator katak */
const COLS = 5;
const ROWS = 3;

export function CountGame({ slug, game, level }: { slug: string; game: LogicGame; level: LogicLevel }) {
  const tr = useTr();
  const run = useLogicRun({ game, level, build: buildCountRounds, images: countImages });
  const [setBoard, box] = useBoardBox();
  const round = run.round;

  return (
    <LogicStage slug={slug} run={run} prompt={round ? tr("{0}: nechta?", tr(round.item.name)) : ""}>
      <div ref={setBoard} className="mx-4 mb-[max(16px,env(safe-area-inset-bottom))] mt-1 flex min-h-0 flex-1 items-center justify-center">
        {box && round && <CountBoard key={run.key} round={round} run={run} box={box} />}
      </div>
    </LogicStage>
  );
}

function CountBoard({ round, run, box }: { round: CountRound; run: LogicRun; box: { w: number; h: number } }) {
  const tr = useTr();
  /** Sanalgan kataklar — bosilish tartibida */
  const [counted, setCounted] = useState<number[]>([]);
  const [away, setAway] = useState<number | null>(null);
  const [filled, setFilled] = useState<number | null>(null);
  const spot = useRef<HTMLSpanElement>(null);
  const digits = useRef(new Map<number, HTMLSpanElement>());

  // O'lchamlar: maydon, uning ostida hisob, javob katakchasi va raqamlar
  const fieldW = Math.min(box.w, 400);
  // Maydon — qolgan joyning hammasi (hisob, javob va raqamlar ~236px), 120–260px oralig'ida
  const fieldH = Math.round(Math.max(120, Math.min(260, box.h - 236)));
  const itemSize = Math.round(Math.min(72, Math.min(fieldW / COLS, fieldH / ROWS) * 0.84));
  const optionGap = 12;
  const n = round.options.length;
  const option = Math.max(64, Math.min(92, Math.floor((box.w - optionGap * (n - 1)) / n)));

  const tap = (cell: number) => {
    if (run.locked || counted.includes(cell)) return;
    const next = [...counted, cell];
    setCounted(next);
    run.countTick(next.length);
  };

  const choose = async (value: number) => {
    const from = digits.current.get(value);
    if (run.locked || !from || !spot.current) return;
    const alive = run.guard();
    const right = value === round.count;
    run.setBusy(true);
    setAway(value);
    await flyImage({
      from,
      to: spot.current,
      text: String(value),
      right,
      arrived: () => {
        if (!alive()) return;
        if (right) {
          setFilled(value);
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
    <div className="flex w-full flex-col items-center gap-3">
      {/* Maydon — rasmlar tartibsiz uyumdek; bosilganida raqam chiqadi */}
      <div
        className="relative rounded-[24px]"
        style={{ width: fieldW, height: fieldH, background: "color-mix(in srgb, var(--g) 12%, var(--p-card))" }}
        role="group"
        aria-label={tr("{0} ta rasm", round.count)}
      >
        {round.cells.map((cell, i) => {
          const col = cell % COLS;
          const row = Math.floor(cell / COLS);
          // Biroz siljish — qator-qator emas, aralash ko'rinsin (har safar bir xil, sakramaydi)
          const jx = ((cell * 37) % 13) - 6;
          const jy = ((cell * 53) % 11) - 5;
          const order = counted.indexOf(cell);
          return (
            <button
              key={cell}
              type="button"
              onClick={() => tap(cell)}
              disabled={run.locked}
              aria-label={order >= 0 ? `${tr(round.item.name)} · ${order + 1}` : tr(round.item.name)}
              aria-pressed={order >= 0}
              className={clsx(styles.counter, order >= 0 && styles.counted)}
              style={{
                width: itemSize,
                height: itemSize,
                left: `calc(${((col + 0.5) / COLS) * 100}% + ${jx}px - ${itemSize / 2}px)`,
                top: `calc(${((row + 0.5) / ROWS) * 100}% + ${jy}px - ${itemSize / 2}px)`,
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <img src={round.item.image} alt="" draggable={false} />
              {order >= 0 && (
                <span className={clsx(parentStyles.roundedFont, styles.countBadge)} aria-hidden="true">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hisob va qaytadan sanash */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-[16px] font-bold tabular-nums text-[var(--p-ink)]" aria-live="polite">
          {tr("Sanadingiz: {0}", counted.length)}
        </span>
        <button
          type="button"
          onClick={() => setCounted([])}
          disabled={run.locked || counted.length === 0}
          className={clsx(styles.chip, "flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold text-[var(--p-ink)] disabled:opacity-40")}
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
          {tr("Qaytadan sanash")}
        </button>
      </div>

      {/* Javob: rasm = ? */}
      <div className="flex items-center justify-center gap-3">
        <img src={round.item.image} alt="" draggable={false} className="h-12 w-12 object-contain" />
        <span className={clsx(parentStyles.roundedFont, "text-[30px] text-[var(--p-ink)]/60")}>=</span>
        <span
          className={clsx(styles.slot, styles.textSlot)}
          data-filled={filled !== null ? "" : undefined}
          style={{ width: 76, height: 76, fontSize: 44 }}
        >
          <span ref={spot} className={parentStyles.roundedFont}>
            {filled ?? "?"}
          </span>
        </span>
      </div>

      {/* Raqamlar */}
      <div className="mt-1 flex items-center justify-center" style={{ gap: optionGap }}>
        {round.options.map((value, i) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            disabled={run.locked}
            aria-label={String(value)}
            className={styles.choice}
            style={{ width: option, height: option, animationDelay: `${0.25 + i * 0.07}s`, visibility: away === value ? "hidden" : undefined }}
          >
            <span
              ref={(node) => {
                if (node) digits.current.set(value, node);
                else digits.current.delete(value);
              }}
              className={clsx(parentStyles.roundedFont, "text-[var(--p-ink)]")}
              style={{ fontSize: Math.round(option * 0.52), lineHeight: 1 }}
            >
              {value}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
