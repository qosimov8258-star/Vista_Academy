"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import styles from "../oyinlar.module.css";
import type { GameItem } from "../data";
import { flyImage } from "./fly";
import type { LogicGame, LogicLevel } from "./games";
import { buildPatternRounds, type PatternRound } from "./rounds";
import { LogicStage, useBoardBox, useLogicRun, type LogicRun } from "./stage";
import { useTr } from "@/i18n/tr";

/**
 * «Nima keyin keladi?» — qator (olma, sabzi, olma, sabzi, olma, «?»)
 * davom ettiriladi. Bosilgan javob «?» katakchasiga uchib boradi: to'g'ri
 * bo'lsa — o'sha yerda qoladi, noto'g'ri bo'lsa — chayqalib, joyiga qaytadi.
 */

const patternImages = (round: PatternRound) => [...round.shown, ...round.options].map((item) => item.image);

export function PatternGame({ slug, game, level }: { slug: string; game: LogicGame; level: LogicLevel }) {
  const tr = useTr();
  const run = useLogicRun({ game, level, build: buildPatternRounds, images: patternImages });
  const [setBoard, box] = useBoardBox();

  return (
    <LogicStage slug={slug} run={run} prompt={tr("Keyingisi qaysi?")}>
      <div ref={setBoard} className="mx-4 mb-[max(16px,env(safe-area-inset-bottom))] mt-2 flex min-h-0 flex-1 items-center justify-center">
        {box && run.round && <PatternBoard key={run.key} round={run.round} run={run} box={box} />}
      </div>
    </LogicStage>
  );
}

function PatternBoard({ round, run, box }: { round: PatternRound; run: LogicRun; box: { w: number; h: number } }) {
  const tr = useTr();
  const spot = useRef<HTMLSpanElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  /** Uchib ketgan (yoki katakchaga qo'ngan) javob */
  const [away, setAway] = useState<string | null>(null);
  const [filled, setFilled] = useState<GameItem | null>(null);

  // Qator — 6 katak bir qatorda; javoblar — pastda kattaroq
  const gap = box.w >= 420 ? 10 : 7;
  const cell = Math.max(38, Math.min(78, Math.floor((box.w - gap * 5) / 6)));
  const optionGap = 14;
  const count = round.options.length;
  const option = Math.max(64, Math.min(124, Math.floor((box.w - optionGap * (count - 1)) / count), Math.floor((box.h - cell - 48) * 0.8)));

  const choose = async (item: GameItem) => {
    const from = images.current.get(item.id);
    if (run.locked || !from || !spot.current) return;
    const alive = run.guard();
    const right = item.id === round.answer.id;
    run.setBusy(true);
    setAway(item.id);
    await flyImage({
      from,
      to: spot.current,
      src: item.image,
      right,
      arrived: () => {
        if (!alive()) return;
        if (right) {
          setFilled(item);
          run.succeed(item.image);
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
    <div className="flex w-full flex-col items-center justify-center" style={{ gap: 48 }}>
      {/* Qator */}
      <div className="flex items-center justify-center" style={{ gap }} aria-hidden="true">
        {round.shown.map((item, i) => (
          <span key={i} className={styles.tile} style={{ width: cell, height: cell, animationDelay: `${i * 0.06}s` }}>
            <img src={item.image} alt="" draggable={false} />
          </span>
        ))}
        <span
          className={clsx(styles.slot, "relative")}
          data-filled={filled ? "" : undefined}
          style={{ width: cell, height: cell, fontSize: Math.round(cell * 0.5) }}
        >
          {filled ? <img src={filled.image} alt="" draggable={false} /> : "?"}
          {/* Uchayotgan rasm shu joyga qo'nadi — katakchadagi rasm o'lchamida */}
          <span ref={spot} className="pointer-events-none absolute inset-[12%]" />
        </span>
      </div>

      {/* Javoblar */}
      <div className="flex items-center justify-center" style={{ gap: optionGap }}>
        {round.options.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => choose(item)}
            disabled={run.locked}
            aria-label={tr(item.name)}
            className={styles.choice}
            style={{ width: option, height: option, animationDelay: `${0.3 + i * 0.07}s`, visibility: away === item.id ? "hidden" : undefined }}
          >
            <img
              ref={(node) => {
                if (node) images.current.set(item.id, node);
                else images.current.delete(item.id);
              }}
              src={item.image}
              alt=""
              draggable={false}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
