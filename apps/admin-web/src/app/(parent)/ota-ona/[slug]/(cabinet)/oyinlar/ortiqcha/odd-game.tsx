"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, RotateCcw } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { soundStarsFor } from "../data";
import { useGamesStore } from "../store";
import { buzz, sfx } from "../sound";
import { KidStage, ProgressTray, StageButton, StageHeader } from "../ui";
import { WinOverlay } from "../win-overlay";
import { buildOddRounds, nextOddLevel, type OddCard, type OddLevel, type OddRound } from "./odd-data";
import { useTr } from "@/i18n/tr";

/**
 * «Ortiqchasini top» — to'rtta rasmdan boshqalariga o'xshamaganini topish.
 *
 * Qoidalar:
 *  • Har savolda 2×2 katta karta: uchtasi bitta guruhdan, bittasi boshqa.
 *  • Xato tanlansa — karta xiralashadi, ostida nega u ortiqcha emasligi
 *    yoziladi («Olma — meva»); to'g'risi topilmaguncha savol o'zgarmaydi.
 *  • To'g'ri — yashil halqa va izoh: «Mashina — transport. Qolganlari —
 *    mevalar». Ota-ona uni bolaga o'qib beradi — o'yinning asosiy foydasi
 *    shu: bola guruhlash va nima uchunligini aytishni o'rganadi.
 *  • Yulduzchalar birinchi urinishda topilgan savollar bo'yicha.
 */

type Phase = "play" | "correct" | "won";

/** To'g'ri javobdan keyin izohni o'qib olishga vaqt */
const NEXT_DELAY_MS = 2600;

export function OddGame({ slug, level }: { slug: string; level: OddLevel }) {
  const tr = useTr();
  const router = useRouter();
  const store = useGamesStore();
  const homeHref = `/ota-ona/${slug}/oyinlar/ortiqcha`;

  const [game, setGame] = useState(0);
  const [rounds, setRounds] = useState<OddRound[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("play");
  const [wrong, setWrong] = useState<string[]>([]);
  const [lastWrong, setLastWrong] = useState<OddCard | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [firstTry, setFirstTry] = useState(0);
  const [stars, setStars] = useState<1 | 2 | 3>(1);
  const timers = useRef<number[]>([]);
  const effectsOn = useRef(store.sound);
  effectsOn.current = store.sound;

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const effect = useCallback((name: "match" | "miss" | "win") => {
    if (effectsOn.current) sfx[name]();
  }, []);

  // Yangi o'yin: savollar tuziladi, rasmlar oldindan yuklanadi
  useEffect(() => {
    const next = buildOddRounds(level);
    setRounds(next);
    setIndex(0);
    setWrong([]);
    setLastWrong(null);
    setFound([]);
    setFirstTry(0);
    setPhase("play");
    next.forEach((round) =>
      round.cards.forEach((card) => {
        const img = new Image();
        img.src = card.item.image;
      }),
    );
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [level, game]);

  const round = rounds[index];

  const choose = (card: OddCard) => {
    if (!round || phase !== "play" || wrong.includes(card.item.image)) return;
    if (card === round.odd) {
      const nextFirstTry = wrong.length === 0 ? firstTry + 1 : firstTry;
      setFound([...found, card.item.image]);
      setFirstTry(nextFirstTry);
      setLastWrong(null);
      setPhase("correct");
      effect("match");
      buzz(30);
      later(() => {
        if (index + 1 >= rounds.length) {
          const earned = soundStarsFor(nextFirstTry, rounds.length);
          setStars(earned);
          store.saveOddResult(level.id, earned);
          setPhase("won");
          effect("win");
          buzz(80);
          return;
        }
        setIndex(index + 1);
        setWrong([]);
        setPhase("play");
      }, NEXT_DELAY_MS);
    } else {
      setWrong([...wrong, card.item.image]);
      setLastWrong(card);
      setShaking(card.item.image);
      effect("miss");
      buzz(15);
      later(() => setShaking(null), 450);
    }
  };

  // Kartalar 2×2, ekranga sig'adigan eng katta o'lcham
  const [board, setBoard] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (!board) return;
    const measure = () => setBox({ w: board.clientWidth, h: board.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, [board]);
  const layout = useMemo(() => {
    if (!box) return null;
    const gap = 14;
    const size = Math.min((box.w - gap) / 2, (box.h - gap) / 2, 210);
    return { size: Math.max(60, Math.floor(size)), gap };
  }, [box]);

  const following = nextOddLevel(level);
  const exit = () => router.push(homeHref);

  return (
    <KidStage label={tr("Ortiqchasini top")} tone="lilac">
      <StageHeader
        title={tr("Ortiqchasini top")}
        subtitle={`${tr(level.title)} · ${Math.min(index + 1, level.rounds)}/${level.rounds}`}
        onExit={exit}
      >
        <StageButton label={tr("Qaytadan boshlash")} onClick={() => setGame((value) => value + 1)}>
          <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
        </StageButton>
      </StageHeader>

      {/* Topilgan ortiqchalar */}
      <ProgressTray total={level.rounds} images={found} label={tr("{0} / {1} topildi", found.length, level.rounds)} />

      <p className={clsx(parentStyles.roundedFont, "mt-6 px-6 text-center text-[24px] leading-tight text-[var(--p-ink)]")}>
        {tr("Qaysi biri ortiqcha?")}
      </p>
      {/* Xato bo'lsa — nega u ortiqcha emas */}
      <p className="mt-1.5 h-6 px-6 text-center text-[15px] font-semibold text-[var(--p-ink)]/60" aria-live="polite">
        {phase === "play" && lastWrong
          ? tr("{0} — {1}. Yana qidiring!", tr(lastWrong.item.name), tr(lastWrong.set.kind))
          : phase === "play"
            ? tr("Uchtasi bir guruhdan, bittasi — boshqa")
            : ""}
      </p>

      {/* Kartalar */}
      <div ref={setBoard} className="mx-4 mb-2 mt-3 flex min-h-0 flex-1 items-center justify-center">
        {layout && round && (
          <div
            key={`${game}-${index}`}
            className="grid"
            style={{ gridTemplateColumns: `repeat(2, ${layout.size}px)`, gridAutoRows: `${layout.size}px`, gap: layout.gap }}
          >
            {round.cards.map((card, i) => {
              const isWrong = wrong.includes(card.item.image);
              const isRight = phase !== "play" && card === round.odd;
              return (
                <button
                  key={card.item.image}
                  type="button"
                  onClick={() => choose(card)}
                  disabled={phase !== "play" || isWrong}
                  aria-label={tr(card.item.name)}
                  className={clsx(
                    styles.choice,
                    isWrong && styles.wrong,
                    isRight && styles.right,
                    isRight && styles.matched,
                    shaking === card.item.image && styles.shake,
                  )}
                  style={{ width: layout.size, height: layout.size, animationDelay: `${i * 0.07}s` }}
                >
                  <img src={card.item.image} alt="" draggable={false} />
                  <span className={styles.check} aria-hidden="true">
                    <Check className="h-[62%] w-[62%]" strokeWidth={3.4} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* To'g'ri topilganda — nega ortiqcha. Uzun nom ikki qatorga tushsa ham
          sig'adi: joy balandligi o'zgarmaydi, kartalar to'ri shunga moslashadi */}
      <div className="flex h-[118px] items-center justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
        {phase === "correct" && round && (
          <div key={`${game}-${index}`} className={clsx(styles.bubble, styles.chip, "flex max-w-full items-center gap-3 rounded-[28px] py-2.5 pl-2.5 pr-5")}>
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--g) 22%, transparent)" }}
            >
              <img src={round.odd.item.image} alt="" draggable={false} className="h-10 w-10 object-contain" />
            </span>
            <span className="min-w-0">
              <span className={clsx(parentStyles.roundedFont, "block text-balance text-[19px] leading-[1.15] text-[var(--p-ink)]")}>
                {tr(round.odd.item.name)} — {tr(round.odd.set.kind)}
              </span>
              <span className="mt-0.5 block text-[14px] font-semibold leading-snug text-[var(--p-ink)]/60">
                {tr("Qolganlari — {0}", tr(round.base.plural))}
              </span>
            </span>
          </div>
        )}
      </div>

      {phase === "won" && (
        <WinOverlay
          stars={stars}
          subtitle={tr("{0} ta savoldan {1} tasini birinchi urinishda topding", level.rounds, firstTry)}
          onAgain={() => setGame((value) => value + 1)}
          onNext={
            following
              ? () => {
                  store.setOddLevel(following.id);
                  router.replace(`${homeHref}/oyna?daraja=${following.id}`);
                }
              : null
          }
          onTopics={exit}
          topicsLabel="O'yindan chiqish"
        />
      )}
    </KidStage>
  );
}
