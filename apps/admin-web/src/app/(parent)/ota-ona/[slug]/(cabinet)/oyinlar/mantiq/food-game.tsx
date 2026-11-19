"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import styles from "../oyinlar.module.css";
import type { GameItem } from "../data";
import type { LogicGame, LogicLevel } from "./games";
import { buildFoodRounds, type FoodRound } from "./rounds";
import { LogicStage, useBoardBox, useLogicRun, type LogicRun } from "./stage";
import { useTr } from "@/i18n/tr";

/**
 * «Kim nima yeydi?» — tepada jonivor, pastda ovqatlar. To'g'risi bosilsa —
 * yashil halqa; noto'g'ri bo'lsa — rasm chayqaladi, yana tanlash mumkin.
 */

const foodImages = (round: FoodRound) => [round.animal, ...round.options].map((item) => item.image);

export function FoodGame({ slug, game, level }: { slug: string; game: LogicGame; level: LogicLevel }) {
  const tr = useTr();
  const run = useLogicRun({ game, level, build: buildFoodRounds, images: foodImages });
  const [setBoard, box] = useBoardBox();

  return (
    <LogicStage slug={slug} run={run} prompt={tr("Bu jonivor nima yeydi?")}>
      <div ref={setBoard} className="mx-4 mb-[max(16px,env(safe-area-inset-bottom))] mt-2 flex min-h-0 flex-1 items-center justify-center">
        {box && run.round && <FoodBoard key={run.key} round={run.round} run={run} box={box} />}
      </div>
    </LogicStage>
  );
}

function FoodBoard({ round, run, box }: { round: FoodRound; run: LogicRun; box: { w: number; h: number } }) {
  const tr = useTr();
  const [shaking, setShaking] = useState<string | null>(null);
  const shakeTimer = useRef<number | null>(null);
  const solved = run.phase !== "play";

  // Tepada jonivor, pastda ovqatlar: 2 va 3 — bir qatorda, 4 — 2×2
  const count = round.options.length;
  const cols = count === 4 ? 2 : count;
  const rows = count === 4 ? 2 : 1;
  const gap = 14;
  const between = 36;
  const heroSize = Math.max(90, Math.min(176, Math.floor(box.w * 0.44), Math.floor(box.h * 0.34)));
  const size = Math.max(
    64,
    Math.min(
      150,
      Math.floor((box.w - gap * (cols - 1)) / cols),
      Math.floor((box.h - heroSize - between - gap * (rows - 1)) / rows),
    ),
  );

  const choose = (item: GameItem) => {
    if (run.locked) return;
    if (item.id === round.food.id) {
      run.succeed(item.image);
      return;
    }
    run.fail();
    setShaking(item.id);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShaking(null), 450);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center" style={{ gap: between }}>
      <span className={styles.tile} style={{ width: heroSize, height: heroSize }}>
        <img src={round.animal.image} alt={tr(round.animal.name)} draggable={false} />
      </span>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)`, gridAutoRows: `${size}px`, gap }}>
        {round.options.map((item, i) => {
          const isRight = solved && item.id === round.food.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(item)}
              disabled={run.locked}
              aria-label={tr(item.name)}
              className={clsx(styles.choice, isRight && [styles.right, styles.matched], shaking === item.id && styles.shake)}
              style={{ width: size, height: size, animationDelay: `${0.25 + i * 0.07}s` }}
            >
              <img src={item.image} alt="" draggable={false} />
              <span className={styles.check} aria-hidden="true">
                <Check className="h-[62%] w-[62%]" strokeWidth={3.4} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
