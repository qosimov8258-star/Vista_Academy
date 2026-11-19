"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import styles from "../oyinlar.module.css";
import { flyImage } from "./fly";
import type { LogicGame, LogicLevel } from "./games";
import { buildSizeRounds, type SizeRound } from "./rounds";
import { LogicStage, useBoardBox, useLogicRun, type LogicRun } from "./stage";
import { useTr } from "@/i18n/tr";

/**
 * «Kichikdan kattaga» — bir xil rasm har xil kattalikda, aralash turadi.
 * Bola eng kichigidan boshlab bosadi: bosilgan rasm pastdagi navbatdagi
 * raqamli katakchaga uchib boradi. To'g'ri bo'lsa — o'sha yerda qoladi,
 * noto'g'ri bo'lsa — katakchada chayqalib, joyiga qaytadi.
 */

const sizeImages = (round: SizeRound) => [round.item.image];

/** Bosiladigan joy telefonda ham kamida 44px — kichik rasmning bosish joyi atrofga kengayadi */
const MIN_TAP = 44;

export function SizeGame({ slug, game, level }: { slug: string; game: LogicGame; level: LogicLevel }) {
  const tr = useTr();
  const run = useLogicRun({ game, level, build: buildSizeRounds, images: sizeImages });
  const [setBoard, box] = useBoardBox();

  return (
    <LogicStage slug={slug} run={run} prompt={tr("Eng kichigidan boshlab bosing")}>
      <div ref={setBoard} className="mx-4 mb-[max(16px,env(safe-area-inset-bottom))] mt-2 flex min-h-0 flex-1 items-center justify-center">
        {box && run.round && <SizeBoard key={run.key} round={run.round} run={run} box={box} />}
      </div>
    </LogicStage>
  );
}

function SizeBoard({ round, run, box }: { round: SizeRound; run: LogicRun; box: { w: number; h: number } }) {
  const tr = useTr();
  /** Nechta katakcha to'ldi — navbatdagi kerakli o'lcham */
  const [next, setNext] = useState(0);
  /** Hozir uchib yurgan rasm (uyumda ko'rinmaydi) */
  const [away, setAway] = useState<number | null>(null);
  const images = useRef(new Map<number, HTMLImageElement>());
  const spots = useRef(new Map<number, HTMLSpanElement>());

  // Eng katta rasm o'lchami: ikkala qator (uyum va katakchalar) eniga ham, bo'yiga ham sig'adi.
  // Kattaliklar aniq nisbatda qoladi — kichigi ham kichik ko'rinsin
  const gap = 12;
  const between = 44;
  const n = round.scales.length;
  const ratios = round.scales.reduce((sum, scale) => sum + scale, 0);
  const biggest = Math.max(60, Math.min(150, Math.floor((box.h - between) / 2), Math.floor((box.w - gap * (n - 1)) / ratios)));
  const sizeOf = (rank: number) => Math.floor(biggest * round.scales[rank]);

  const choose = async (rank: number) => {
    const from = images.current.get(rank);
    const to = spots.current.get(next);
    if (run.locked || rank < next || !from || !to) return;
    const alive = run.guard();
    const right = rank === next;
    const last = rank + 1 === n;
    run.setBusy(true);
    setAway(rank);
    await flyImage({
      from,
      to,
      src: round.item.image,
      right,
      arrived: () => {
        if (!alive()) return;
        if (!right) {
          run.fail();
          return;
        }
        setNext(rank + 1);
        if (last) run.succeed(round.item.image);
        else run.step();
      },
    });
    if (!alive()) return;
    setAway(null);
    // Oxirgisi qo'ngach savol yechildi — keyingi savolgacha bosish yopiq qoladi
    if (!(right && last)) run.setBusy(false);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center" style={{ gap: between }}>
      {/* Aralash uyum */}
      <div className="flex items-end justify-center" style={{ gap, height: biggest }}>
        {round.order.map((rank, i) => {
          const size = sizeOf(rank);
          const gone = rank < next || away === rank;
          return (
            <button
              key={rank}
              type="button"
              onClick={() => choose(rank)}
              disabled={run.locked || rank < next}
              aria-label={tr("{0}-o'lcham", rank + 1)}
              className={clsx(styles.choice, styles.hit)}
              style={
                {
                  width: size,
                  height: size,
                  animationDelay: `${i * 0.07}s`,
                  visibility: gone ? "hidden" : undefined,
                  "--hit": `${Math.max(0, Math.ceil((MIN_TAP - size) / 2))}px`,
                } as React.CSSProperties
              }
            >
              <img
                ref={(node) => {
                  if (node) images.current.set(rank, node);
                  else images.current.delete(rank);
                }}
                src={round.item.image}
                alt=""
                draggable={false}
              />
            </button>
          );
        })}
      </div>

      {/* Katakchalar — kichikdan kattaga, raqamli */}
      <div className="flex items-end justify-center" style={{ gap, height: biggest }} aria-hidden="true">
        {round.scales.map((_, rank) => {
          const size = sizeOf(rank);
          const filled = rank < next;
          return (
            <span
              key={rank}
              className={clsx(styles.slot, "relative")}
              data-filled={filled ? "" : undefined}
              style={{ width: size, height: size, fontSize: Math.max(15, Math.round(size * 0.34)) }}
            >
              {filled ? <img src={round.item.image} alt="" draggable={false} /> : rank + 1}
              {/* Uchayotgan rasm shu joyga qo'nadi — katakchadagi rasm o'lchamida */}
              <span
                ref={(node) => {
                  if (node) spots.current.set(rank, node);
                  else spots.current.delete(rank);
                }}
                className="pointer-events-none absolute inset-[12%]"
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
