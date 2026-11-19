"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import type { GameItem } from "../data";
import { flyImage } from "./fly";
import type { LogicGame, LogicLevel } from "./games";
import { buildSortRounds, sortBaskets, type Basket, type SortRound } from "./rounds";
import { LogicStage, useBoardBox, useLogicRun, type LogicRun } from "./stage";
import { useTr } from "@/i18n/tr";

/**
 * «Savatchaga ajrat» — o'rtada rasm, pastda ikki savatcha («Mevalar» va
 * «Sabzavotlar»). Savatcha bosilganda rasm unga uchib tushadi: to'g'ri
 * bo'lsa — ichiga kirib yo'qoladi va savatchadagi son oshadi, noto'g'ri
 * bo'lsa — savatchada chayqalib, joyiga qaytadi.
 */

const sortImages = (round: SortRound) => [round.item.image];

export function SortGame({ slug, game, level }: { slug: string; game: LogicGame; level: LogicLevel }) {
  const tr = useTr();
  const run = useLogicRun({ game, level, build: buildSortRounds, images: sortImages });
  const [setBoard, box] = useBoardBox();
  // Savatchadagi narsalar soni — yechilgan savollardan
  const done = run.rounds.slice(0, run.found.length);
  const counts: [number, number] = [done.filter((entry) => entry.side === 0).length, done.filter((entry) => entry.side === 1).length];

  return (
    <LogicStage slug={slug} run={run} prompt={tr("Qaysi savatchaga?")}>
      <div ref={setBoard} className="mx-4 mb-[max(16px,env(safe-area-inset-bottom))] mt-2 flex min-h-0 flex-1 items-center justify-center">
        {box && run.round && (
          <SortBoard key={run.key} round={run.round} baskets={sortBaskets(level.id)} counts={counts} run={run} box={box} />
        )}
      </div>
    </LogicStage>
  );
}

function SortBoard({
  round,
  baskets,
  counts,
  run,
  box,
}: {
  round: SortRound;
  baskets: [Basket, Basket];
  counts: [number, number];
  run: LogicRun;
  box: { w: number; h: number };
}) {
  const tr = useTr();
  const hero = useRef<HTMLImageElement>(null);
  const icons = useRef(new Map<number, HTMLImageElement>());
  /** Rasm uchib ketgan (yoki savatchaga tushgan) */
  const [away, setAway] = useState(false);
  const solved = run.phase !== "play";

  const gap = 14;
  const between = 36;
  const basketWidth = Math.max(120, Math.min(200, Math.floor((box.w - gap) / 2)));
  const basketHeight = Math.max(120, Math.min(Math.round(basketWidth * 1.05), Math.floor(box.h * 0.5)));
  const heroSize = Math.max(90, Math.min(176, Math.floor(box.w * 0.44), box.h - basketHeight - between));

  const choose = async (side: 0 | 1) => {
    const to = icons.current.get(side);
    if (run.locked || !hero.current || !to) return;
    const alive = run.guard();
    const right = side === round.side;
    run.setBusy(true);
    setAway(true);
    await flyImage({
      from: hero.current,
      to,
      src: round.item.image,
      right,
      vanish: true,
      arrived: () => {
        if (!alive()) return;
        if (right) run.succeed(round.item.image);
        else run.fail();
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
          src={round.item.image}
          alt={tr(round.item.name)}
          draggable={false}
          style={{ visibility: away ? "hidden" : undefined }}
        />
      </span>

      <div className="flex justify-center" style={{ gap }}>
        {baskets.map((basket, i) => {
          const side = i as 0 | 1;
          return (
            <BasketButton
              key={basket.name}
              name={tr(basket.name)}
              icon={basket.icon}
              iconRef={(node) => {
                if (node) icons.current.set(side, node);
                else icons.current.delete(side);
              }}
              count={counts[side]}
              width={basketWidth}
              height={basketHeight}
              right={solved && round.side === side}
              disabled={run.locked}
              onClick={() => choose(side)}
            />
          );
        })}
      </div>
    </div>
  );
}

function BasketButton({
  name,
  icon,
  iconRef,
  count,
  width,
  height,
  right,
  disabled,
  onClick,
}: {
  name: string;
  icon: GameItem;
  iconRef: (node: HTMLImageElement | null) => void;
  count: number;
  width: number;
  height: number;
  right: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const tr = useTr();
  const iconSize = Math.round(width * 0.4);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={name}
      className={clsx(styles.basket, right && styles.right)}
      style={{ width, height }}
    >
      <img ref={iconRef} src={icon.image} alt="" draggable={false} style={{ width: iconSize, height: iconSize }} />
      <span className={clsx(parentStyles.roundedFont, "px-2 text-center text-[17px] leading-tight text-[var(--p-ink)]")}>{name}</span>
      <span
        key={count}
        className={clsx(count > 0 && styles.slotIn, "rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums")}
        style={{ background: "color-mix(in srgb, var(--g) 18%, var(--p-card))", color: "var(--p-ink)" }}
      >
        {tr("{0} ta", count)}
      </span>
    </button>
  );
}
