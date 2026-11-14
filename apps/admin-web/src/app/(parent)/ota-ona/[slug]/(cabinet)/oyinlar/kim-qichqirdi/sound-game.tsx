"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Play, RotateCcw, Volume2 } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { CONFUSABLE, SOUND_ANIMALS, nextSoundLevel, soundStarsFor, type SoundAnimal, type SoundLevel } from "../data";
import { useGamesStore } from "../store";
import { buzz, loadClip, playClip, sfx, stopClip, unlockAudio } from "../sound";
import { HoldToExit, KidStage, TONE } from "../ui";
import { WinOverlay } from "../win-overlay";
import { useTr } from "@/i18n/tr";

/**
 * «Kim qichqirdi?» — hayvon ovozini eshitib, egasini topish.
 *
 * Qoidalar:
 *  • O'yin katta «Boshlash» tugmasi bilan ochiladi — brauzer ovozni faqat
 *    bosishdan keyin yoqadi, bola uchun esa bu tushunarli «marosim».
 *  • Har savolda bitta hayvon ovozi yangraydi va 2/3/4 ta hayvon rasmi
 *    chiqadi. Ovozi o'xshash juftlar (xo'roz–tovuq, qo'y–echki) bitta
 *    savolda birga chiqmaydi. Hayvonlar takrorlanmaydi.
 *  • Karnayni bosib ovozni xohlagancha qayta eshitish mumkin.
 *  • Xato tanlansa — karta xiralashadi va ovoz yana yangraydi; to'g'risi
 *    topilmaguncha savol o'zgarmaydi (yutqazish yo'q).
 *  • To'g'ri — yashil halqa, pastda nomi, 1,5 soniyadan keyin keyingi savol.
 *  • Yulduzchalar birinchi urinishda topilgan savollar bo'yicha.
 */

type Round = { target: SoundAnimal; options: SoundAnimal[] };
type Phase = "ready" | "play" | "correct" | "won";

const NEXT_DELAY_MS = 1500;

function shuffle<T>(list: readonly T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const confusable = (a: string, b: string) => CONFUSABLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

function buildRounds(level: SoundLevel): Round[] {
  return shuffle(SOUND_ANIMALS)
    .slice(0, level.rounds)
    .map((target) => {
      const options: SoundAnimal[] = [target];
      for (const animal of shuffle(SOUND_ANIMALS)) {
        if (options.length >= level.choices) break;
        if (options.some((picked) => picked.id === animal.id || confusable(picked.id, animal.id))) continue;
        options.push(animal);
      }
      return { target, options: shuffle(options) };
    });
}

export function SoundGame({ slug, level }: { slug: string; level: SoundLevel }) {
  const tr = useTr();
  const router = useRouter();
  const store = useGamesStore();
  const tone = TONE.sun;
  const homeHref = `/ota-ona/${slug}/oyinlar/kim-qichqirdi`;

  const [game, setGame] = useState(0);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [wrong, setWrong] = useState<string[]>([]);
  const [shaking, setShaking] = useState<string | null>(null);
  const [found, setFound] = useState<SoundAnimal[]>([]);
  const [firstTry, setFirstTry] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stars, setStars] = useState<1 | 2 | 3>(1);
  const timers = useRef<number[]>([]);
  const playToken = useRef(0);
  const effectsOn = useRef(store.sound);
  effectsOn.current = store.sound;

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const effect = useCallback((name: "match" | "miss" | "win") => {
    if (effectsOn.current) sfx[name]();
  }, []);

  // Yangi o'yin: savollar tuziladi, ovoz va rasmlar oldindan yuklanadi
  useEffect(() => {
    const next = buildRounds(level);
    setRounds(next);
    setIndex(0);
    setWrong([]);
    setFound([]);
    setFirstTry(0);
    setPhase("ready");
    next.forEach((round) => void loadClip(round.target.sound));
    SOUND_ANIMALS.forEach((animal) => {
      const img = new Image();
      img.src = animal.image;
    });
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      playToken.current++;
      stopClip();
    };
  }, [level, game]);

  const round = rounds[index];

  const playTarget = useCallback(async (target: SoundAnimal) => {
    const token = ++playToken.current;
    setPlaying(true);
    await playClip(target.sound);
    if (playToken.current === token) setPlaying(false);
  }, []);

  const start = () => {
    unlockAudio();
    setPhase("play");
    if (round) void playTarget(round.target);
  };

  const replay = () => {
    if (!round || (phase !== "play" && phase !== "correct")) return;
    unlockAudio();
    void playTarget(round.target);
  };

  const choose = (animal: SoundAnimal) => {
    if (!round || phase !== "play" || wrong.includes(animal.id)) return;
    if (animal.id === round.target.id) {
      const nextFound = [...found, animal];
      const nextFirstTry = wrong.length === 0 ? firstTry + 1 : firstTry;
      setFound(nextFound);
      setFirstTry(nextFirstTry);
      setPhase("correct");
      effect("match");
      buzz(30);
      later(() => {
        if (index + 1 >= rounds.length) {
          const earned = soundStarsFor(nextFirstTry, rounds.length);
          setStars(earned);
          store.saveSoundResult(level.id, earned);
          setPhase("won");
          effect("win");
          buzz(80);
          return;
        }
        const nextRound = rounds[index + 1];
        setIndex(index + 1);
        setWrong([]);
        setPhase("play");
        later(() => void playTarget(nextRound.target), 450);
      }, NEXT_DELAY_MS);
    } else {
      setWrong([...wrong, animal.id]);
      setShaking(animal.id);
      effect("miss");
      buzz(15);
      later(() => setShaking(null), 450);
      // Yana eshitib ko'rsin
      later(() => void playTarget(round.target), 650);
    }
  };

  // Javob kartalari o'lchami: 2 va 3 tasi bir qatorda, 4 tasi 2×2
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
    const cols = level.choices === 4 ? 2 : level.choices;
    const rows = level.choices === 4 ? 2 : 1;
    const size = Math.min((box.w - gap * (cols - 1)) / cols, (box.h - gap * (rows - 1)) / rows, 210);
    return { cols, size: Math.max(60, Math.floor(size)), gap };
  }, [box, level.choices]);

  const following = nextSoundLevel(level);
  const exit = () => {
    stopClip();
    router.push(homeHref);
  };

  return (
    <KidStage label={tr("Kim qichqirdi?")}>
      <header className="flex items-center gap-3 px-4 pt-3">
        <HoldToExit onExit={exit} />
        <div className="min-w-0 flex-1 text-center">
          <p className={clsx(parentStyles.roundedFont, "truncate text-[19px] font-extrabold leading-tight text-[var(--p-ink)]")}>
            {tr("Kim qichqirdi?")}
          </p>
          <p className="truncate text-[12.5px] font-semibold text-[var(--p-muted)]">
            {tr(level.title)} · {Math.min(index + 1, level.rounds)}/{level.rounds}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGame((value) => value + 1)}
          aria-label={tr("Qaytadan boshlash")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-card)] text-[var(--p-muted)] shadow-[var(--p-shadow)] active:scale-95"
        >
          <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </header>

      {/* Topilgan hayvonlar */}
      <div className="mt-4 flex justify-center gap-1.5 px-4" aria-label={tr("{0} / {1} topildi", found.length, level.rounds)}>
        {Array.from({ length: level.rounds }, (_, i) => {
          const animal = found[i];
          return (
            <span
              key={i}
              className={clsx("flex items-center justify-center rounded-full", level.rounds > 6 ? "h-8 w-8" : "h-9 w-9")}
              style={{ background: animal ? tone.soft : "var(--p-sunken)" }}
            >
              {animal && <img src={animal.image} alt="" draggable={false} className={clsx(styles.slotIn, "h-[72%] w-[72%] object-contain")} />}
            </span>
          );
        })}
      </div>

      {phase === "ready" ? (
        // Boshlash — katta tugma
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <button
            type="button"
            onClick={start}
            disabled={rounds.length === 0}
            aria-label={tr("Boshlash")}
            className={clsx(styles.breathe, "flex h-40 w-40 items-center justify-center rounded-full text-white shadow-[var(--p-shadow)]")}
            style={{ background: tone.solid }}
          >
            <Play className="ml-2 h-20 w-20" strokeWidth={2} fill="currentColor" />
          </button>
          <div>
            <p className={clsx(parentStyles.roundedFont, "text-[24px] font-extrabold text-[var(--p-ink)]")}>
              {tr("Ovozni eshit va hayvonni top!")}
            </p>
            <p className="mx-auto mt-2 max-w-[280px] text-[13.5px] leading-snug text-[var(--p-muted)]">
              {tr("Telefon ovozi yoqilganini tekshiring.")}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Karnay — bosilsa ovoz qayta yangraydi */}
          <div className="flex flex-col items-center pt-5">
            <button
              type="button"
              onClick={replay}
              aria-label={tr("Ovozni qayta eshitish")}
              className={clsx(
                styles.speaker,
                playing && styles.speaking,
                "flex h-[104px] w-[104px] items-center justify-center rounded-full text-white shadow-[var(--p-shadow)] active:scale-95",
              )}
              style={{ background: tone.solid }}
            >
              <Volume2 className="h-12 w-12" strokeWidth={2.2} />
            </button>
            <p className={clsx(parentStyles.roundedFont, "mt-3 h-6 text-[16px] font-bold text-[var(--p-muted)]")}>
              {phase === "correct" ? "" : playing ? tr("Tinglang…") : tr("Kim qichqirdi?")}
            </p>
          </div>

          {/* Javoblar */}
          <div ref={setBoard} className="mx-4 my-4 flex min-h-0 flex-1 items-center justify-center">
            {layout && round && (
              <div
                key={`${game}-${index}`}
                className="grid"
                style={{ gridTemplateColumns: `repeat(${layout.cols}, ${layout.size}px)`, gridAutoRows: `${layout.size}px`, gap: layout.gap }}
              >
                {round.options.map((animal, i) => {
                  const isWrong = wrong.includes(animal.id);
                  const isRight = phase !== "play" && animal.id === round.target.id;
                  return (
                    <button
                      key={animal.id}
                      type="button"
                      onClick={() => choose(animal)}
                      disabled={phase !== "play" || isWrong}
                      aria-label={tr(animal.name)}
                      className={clsx(
                        styles.choice,
                        isWrong && styles.wrong,
                        isRight && styles.right,
                        shaking === animal.id && styles.shake,
                      )}
                      style={{ width: layout.size, height: layout.size, animationDelay: `${i * 0.07}s` }}
                    >
                      <img src={animal.image} alt="" draggable={false} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Topilganda nomi */}
          <div className="flex h-[76px] items-start justify-center px-4 pb-3">
            {phase === "correct" && round && (
              <div
                key={`${game}-${index}`}
                className={clsx(styles.bubble, "flex items-center gap-2.5 rounded-full bg-[var(--p-card)] py-2 pl-2 pr-5 shadow-[var(--p-shadow)]")}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: tone.soft }}>
                  <img src={round.target.image} alt="" draggable={false} className="h-8 w-8 object-contain" />
                </span>
                <span className={clsx(parentStyles.roundedFont, "text-[22px] font-extrabold text-[var(--p-ink)]")}>
                  {tr(round.target.name)}!
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {phase === "won" && (
        <WinOverlay
          stars={stars}
          subtitle={tr("{0} ta hayvondan {1} tasini birinchi urinishda topding", level.rounds, firstTry)}
          toneSolid={tone.solid}
          onAgain={() => setGame((value) => value + 1)}
          onNext={
            following
              ? () => {
                  store.setSoundLevel(following.id);
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
