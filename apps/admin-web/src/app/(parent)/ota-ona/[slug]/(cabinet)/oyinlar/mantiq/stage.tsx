"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { soundStarsFor, type LevelId } from "../data";
import { useGamesStore } from "../store";
import { buzz, countNote, sfx } from "../sound";
import { KidStage, ProgressTray, StageButton, StageHeader } from "../ui";
import { WinOverlay } from "../win-overlay";
import { nextLogicLevel, type LogicGame, type LogicLevel } from "./games";
import { useTr } from "@/i18n/tr";

/**
 * Mantiqiy o'yinlarning umumiy qismi: savollar navbati (`useLogicRun`) va
 * sahna (`LogicStage`) — tepada chiqish, daraja va savol raqami, topilganlar
 * patnisi, savol matni, maqtov; oxirida g'alaba oynasi. Har o'yin faqat o'z
 * taxtasini chizadi.
 *
 * Yulduzchalar boshqa o'yinlardagidek — birinchi urinishda topilgan savollar
 * ulushi bo'yicha. Xato qilsa ham o'yin davom etadi, yutqazish yo'q.
 */

type Phase = "play" | "correct" | "won";

const PRAISE = ["Barakalla!", "Zo'r!", "To'g'ri!", "Ofarin!", "Juda yaxshi!"];

/** To'g'ri javobdan keyin keyingi savolgacha */
const NEXT_DELAY_MS = 1100;

type Message = { ok: boolean; text: string; key: number };

export function useLogicRun<R>({
  game,
  level,
  build,
  images,
}: {
  game: LogicGame;
  level: LogicLevel;
  /** Savollarni tuzadi — modul darajasidagi funksiya bo'lsin */
  build: (level: LevelId, count: number) => R[];
  /** Savoldagi rasmlar — oldindan yuklab qo'yiladi */
  images: (round: R) => string[];
}) {
  const store = useGamesStore();
  const [play, setPlay] = useState(0);
  const [rounds, setRounds] = useState<R[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("play");
  const [missed, setMissed] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [stars, setStars] = useState<1 | 2 | 3>(1);
  const [message, setMessage] = useState<Message | null>(null);
  /** Rasm uchib yurganda bosish yopiq */
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);
  /** Har yangi savol va o'yinda oshadi — eski uchishning natijasi tashlab yuboriladi */
  const token = useRef(0);
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
    const next = build(level.id, level.rounds);
    token.current += 1;
    setRounds(next);
    setIndex(0);
    setPhase("play");
    setMissed(false);
    setFirstTry(0);
    setFound([]);
    setMessage(null);
    setBusy(false);
    next.forEach((round) =>
      images(round).forEach((src) => {
        const img = new Image();
        img.src = src;
      }),
    );
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    // build/images — modul funksiyalari; yangi o'yin faqat daraja yoki «qaytadan» bilan
  }, [level, play]);

  /** Savol to'g'ri yechildi: rasm patnisga tushadi, keyin keyingi savol yoki g'alaba */
  const succeed = (image: string) => {
    const nextFirstTry = missed ? firstTry : firstTry + 1;
    setFirstTry(nextFirstTry);
    setFound((list) => [...list, image]);
    setPhase("correct");
    setMessage({ ok: true, text: PRAISE[Math.floor(Math.random() * PRAISE.length)], key: Date.now() });
    effect("match");
    buzz(30);
    later(() => {
      if (index + 1 >= rounds.length) {
        const earned = soundStarsFor(nextFirstTry, rounds.length);
        setStars(earned);
        store.saveLogicResult(game.id, level.id, earned);
        setPhase("won");
        effect("win");
        buzz(80);
        return;
      }
      token.current += 1;
      setIndex(index + 1);
      setMissed(false);
      setMessage(null);
      setBusy(false);
      setPhase("play");
    }, NEXT_DELAY_MS);
  };

  /** Bir qadam to'g'ri, lekin savol hali tugamadi («Kichikdan kattaga») */
  const step = () => {
    setMessage({ ok: true, text: PRAISE[Math.floor(Math.random() * PRAISE.length)], key: Date.now() });
    effect("match");
    buzz(20);
  };

  /** «Nechta?»: n-chi narsa sanaldi — ko'tariluvchi nota */
  const countTick = (n: number) => {
    if (effectsOn.current) countNote(n);
    buzz(10);
  };

  const fail = () => {
    setMissed(true);
    setMessage({ ok: false, text: "Yana bir urinib ko'r", key: Date.now() });
    effect("miss");
    buzz(15);
  };

  /** Uchish tugaguncha shu savol o'zgarmaganmi */
  const guard = () => {
    const current = token.current;
    return () => current === token.current;
  };

  return {
    game,
    level,
    round: rounds[index] as R | undefined,
    rounds,
    index,
    phase,
    found,
    firstTry,
    stars,
    message,
    /** Bosish mumkin emas: rasm uchyapti yoki savol yechildi */
    locked: busy || phase !== "play",
    setBusy,
    succeed,
    step,
    countTick,
    fail,
    guard,
    /** Qaysi o'yin va savol — taxta shu kalit bilan qayta chiziladi */
    key: `${play}-${index}`,
    restart: () => setPlay((value) => value + 1),
  };
}

export type LogicRun = Omit<ReturnType<typeof useLogicRun<unknown>>, "round">;

/** Taxta o'lchami — kartalar ekranga sig'adigan eng katta qilib chiziladi */
export function useBoardBox() {
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
  return [setBoard, box] as const;
}

export function LogicStage({
  slug,
  run,
  prompt,
  children,
}: {
  slug: string;
  run: LogicRun;
  /** Tarjima qilingan savol matni */
  prompt: string;
  children: React.ReactNode;
}) {
  const tr = useTr();
  const router = useRouter();
  const store = useGamesStore();
  const { game, level } = run;
  const homeHref = `/ota-ona/${slug}/oyinlar/${game.id}`;
  const following = nextLogicLevel(game, level);
  const exit = () => router.push(homeHref);

  return (
    <KidStage label={tr(game.title)} tone={game.tone}>
      <StageHeader
        title={tr(game.title)}
        subtitle={`${tr(level.title)} · ${Math.min(run.index + 1, level.rounds)}/${level.rounds}`}
        onExit={exit}
      >
        <StageButton label={tr("Qaytadan boshlash")} onClick={run.restart}>
          <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
        </StageButton>
      </StageHeader>

      <ProgressTray total={level.rounds} images={run.found} label={tr("{0} / {1} topildi", run.found.length, level.rounds)} />

      <p className={clsx(parentStyles.roundedFont, "mt-5 px-6 text-center text-[24px] leading-tight text-[var(--p-ink)]")}>{prompt}</p>
      {/* Maqtov yoki «yana urinib ko'r» — har safar qaytadan sakrab chiqadi */}
      <p className="mt-1 flex h-7 items-center justify-center px-6 text-center" aria-live="polite">
        {run.message && (
          <span
            key={run.message.key}
            className={clsx(styles.slotIn, "text-[17px] font-extrabold")}
            style={{ color: run.message.ok ? "color-mix(in srgb, var(--p-mint) 80%, var(--p-ink))" : "color-mix(in srgb, var(--p-ink) 60%, transparent)" }}
          >
            {tr(run.message.text)}
          </span>
        )}
      </p>

      {children}

      {run.phase === "won" && (
        <WinOverlay
          stars={run.stars}
          subtitle={tr("{0} ta savoldan {1} tasini birinchi urinishda topding", level.rounds, run.firstTry)}
          onAgain={run.restart}
          onNext={
            following
              ? () => {
                  store.setLogicLevel(game.id, following.id);
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
