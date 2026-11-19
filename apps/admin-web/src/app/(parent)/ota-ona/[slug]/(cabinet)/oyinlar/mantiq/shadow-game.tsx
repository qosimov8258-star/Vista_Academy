"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import styles from "../oyinlar.module.css";
import type { GameItem } from "../data";
import { flyImage } from "./fly";
import type { LogicGame, LogicLevel } from "./games";
import { buildShadowRounds, type ShadowRound } from "./rounds";
import { LogicStage, useBoardBox, useLogicRun, type LogicRun } from "./stage";
import { useTr } from "@/i18n/tr";

/**
 * «Soyasini top» — tepada rangli rasm, pastda soyalar. Soya bosilganda
 * rangli rasm o'sha soyaning ichiga uchib kiradi: to'g'ri bo'lsa — soya
 * rangga kiradi, noto'g'ri bo'lsa — rasm chayqalib, joyiga qaytadi.
 */

const shadowImages = (round: ShadowRound) => [round.target, ...round.options].map((item) => item.image);

export function ShadowGame({ slug, game, level }: { slug: string; game: LogicGame; level: LogicLevel }) {
  const tr = useTr();
  const run = useLogicRun({ game, level, build: buildShadowRounds, images: shadowImages });
  const [setBoard, box] = useBoardBox();

  return (
    <LogicStage slug={slug} run={run} prompt={tr("Soyasini toping")}>
      <div ref={setBoard} className="mx-4 mb-[max(16px,env(safe-area-inset-bottom))] mt-2 flex min-h-0 flex-1 items-center justify-center">
        {box && run.round && <ShadowBoard key={run.key} round={run.round} run={run} box={box} />}
      </div>
    </LogicStage>
  );
}

function ShadowBoard({ round, run, box }: { round: ShadowRound; run: LogicRun; box: { w: number; h: number } }) {
  const tr = useTr();
  const hero = useRef<HTMLImageElement>(null);
  const shadows = useRef(new Map<string, HTMLImageElement>());
  /** Rangli rasm uchib ketgan (yoki soyaga kirgan) */
  const [away, setAway] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  // Tepada katta rasm, pastda soyalar: 2 va 3 — bir qatorda, 4 — 2×2
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

  const choose = async (item: GameItem) => {
    const to = shadows.current.get(item.id);
    if (run.locked || !hero.current || !to) return;
    const alive = run.guard();
    const right = item.id === round.target.id;
    run.setBusy(true);
    setAway(true);
    await flyImage({
      from: hero.current,
      to,
      src: round.target.image,
      right,
      arrived: () => {
        if (!alive()) return;
        if (right) {
          setRevealed(item.id);
          run.succeed(round.target.image);
        } else {
          run.fail();
        }
      },
    });
    if (!alive() || right) return;
    setAway(false);
    run.setBusy(false);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center" style={{ gap: between }}>
      <span className={styles.tile} style={{ width: heroSize, height: heroSize }}>
        <img
          ref={hero}
          src={round.target.image}
          alt={tr(round.target.name)}
          draggable={false}
          style={{ visibility: away ? "hidden" : undefined }}
        />
      </span>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)`, gridAutoRows: `${size}px`, gap }}>
        {round.options.map((item, i) => {
          const isRight = revealed === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(item)}
              disabled={run.locked}
              aria-label={tr("{0}-soya", i + 1)}
              className={clsx(styles.choice, styles.silhouette, isRight && [styles.revealed, styles.right, styles.matched])}
              style={{ width: size, height: size, animationDelay: `${0.25 + i * 0.07}s` }}
            >
              <img
                ref={(node) => {
                  if (node) shadows.current.set(item.id, node);
                  else shadows.current.delete(item.id);
                }}
                src={item.image}
                alt=""
                draggable={false}
              />
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
