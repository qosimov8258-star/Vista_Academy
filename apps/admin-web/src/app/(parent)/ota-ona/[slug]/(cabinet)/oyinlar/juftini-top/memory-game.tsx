"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { nextLevel, starsFor, topicTone, type GameItem, type Level, type Topic } from "../data";
import { useGamesStore } from "../store";
import { buzz, sfx } from "../sound";
import { HoldToExit, KidStage, TONE } from "../ui";
import { WinOverlay } from "../win-overlay";
import { useTr } from "@/i18n/tr";

/**
 * «Juftini top» — xotira o'yini.
 *
 * Qoidalar:
 *  • Mavzudagi rasmlardan tasodifiy `pairs` tasi olinadi — har o'yin boshqacha.
 *  • Boshida (oson/o'rta darajada) hamma karta bir necha soniya ochiq turadi.
 *  • Bir vaqtda faqat 2 karta ochiladi. Bir xil bo'lsa — ochiq qoladi, rasm
 *    nomi pastda chiqadi (ota-ona bolaga aytib beradi); bo'lmasa — 1 soniyadan
 *    keyin yopiladi. Shu vaqt ichida boshqa karta bosilmaydi.
 *  • Urinish = ikkita karta ochish. Vaqt o'lchanmaydi — shoshiltirmaymiz.
 *  • Hamma juft topilsa — g'alaba: 1–3 yulduzcha (yutqazish yo'q), eng
 *    yaxshi natija qurilmada saqlanadi.
 */

type Card = { uid: number; item: GameItem };
type Phase = "loading" | "peek" | "play" | "won";

const FLIP_MS = 420;
const MISS_HOLD_MS = 1000;

function shuffle<T>(list: readonly T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function deal(topic: Topic, pairs: number): Card[] {
  const picked = shuffle(topic.items).slice(0, pairs);
  return shuffle([...picked, ...picked]).map((item, uid) => ({ uid, item }));
}

/** Rasmlar oldindan yuklanadi — karta ochilganda bo'sh joy ko'rinmasin */
function preload(items: GameItem[]): Promise<void> {
  const all = items.map(
    (item) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = item.image;
      }),
  );
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 4000));
  return Promise.race([Promise.all(all).then(() => undefined), timeout]);
}

export function MemoryGame({
  slug,
  topic,
  level,
}: {
  slug: string;
  topic: Topic;
  level: Level;
}) {
  const tr = useTr();
  const router = useRouter();
  const store = useGamesStore();
  const tone = TONE[topicTone(topic)];
  const topicsHref = `/ota-ona/${slug}/oyinlar/juftini-top`;

  const [round, setRound] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<GameItem[]>([]);
  const [moves, setMoves] = useState(0);
  const [missed, setMissed] = useState<number[]>([]);
  const [justFound, setJustFound] = useState<{ item: GameItem; key: number } | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3>(1);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const soundOn = useRef(store.sound);
  soundOn.current = store.sound;

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const play = useCallback((name: keyof typeof sfx) => {
    if (soundOn.current) sfx[name]();
  }, []);

  // Yangi o'yin: kartalar tarqatiladi, rasmlar yuklanadi, keyin ko'rsatib olinadi
  useEffect(() => {
    let cancelled = false;
    const cards = deal(topic, level.pairs);
    setDeck(cards);
    setOpen([]);
    setFound([]);
    setMoves(0);
    setMissed([]);
    setJustFound(null);
    setPhase("loading");
    busy.current = false;
    void preload(cards.map((card) => card.item)).then(() => {
      if (cancelled) return;
      if (level.peekMs > 0) {
        setPhase("peek");
        later(() => setPhase("play"), level.peekMs);
      } else {
        setPhase("play");
      }
    });
    const pending = timers.current;
    return () => {
      cancelled = true;
      pending.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [topic, level, round, later]);

  const foundIds = useMemo(() => new Set(found.map((item) => item.id)), [found]);

  const flip = (index: number) => {
    const card = deck[index];
    if (phase !== "play" || busy.current || !card) return;
    if (open.includes(index) || foundIds.has(card.item.id)) return;
    play("flip");
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;

    busy.current = true;
    const [a, b] = next;
    const moveCount = moves + 1;
    setMoves(moveCount);

    if (deck[a].item.id === deck[b].item.id) {
      later(() => {
        const item = deck[a].item;
        const nextFound = [...found, item];
        setFound(nextFound);
        setOpen([]);
        setJustFound({ item, key: moveCount });
        play("match");
        buzz(30);
        busy.current = false;
        if (nextFound.length === level.pairs) {
          const earned = starsFor(level.pairs, moveCount);
          setStars(earned);
          store.saveMemoryResult(topic.id, level.id, earned);
          later(() => {
            setPhase("won");
            play("win");
            buzz(80);
          }, 700);
        }
      }, FLIP_MS);
    } else {
      later(() => {
        setMissed([a, b]);
        play("miss");
      }, FLIP_MS);
      later(() => {
        setOpen([]);
        setMissed([]);
        busy.current = false;
      }, FLIP_MS + MISS_HOLD_MS);
    }
  };

  // Taxta o'lchami: ekranga sig'adigan eng katta kvadrat karta. Yotiq ekranda
  // (kompyuter, planshet) ustun va qatorlar almashadi.
  // Taxta portal ichida — portal paydo bo'lgach o'lchanadi (callback ref)
  const [board, setBoard] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = board;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [board]);

  const layout = useMemo(() => {
    if (!box) return null;
    const gap = box.w < 420 ? 10 : 14;
    const fit = (cols: number, rows: number) => {
      const size = Math.min((box.w - gap * (cols - 1)) / cols, (box.h - gap * (rows - 1)) / rows, 170);
      return { cols, rows, size: Math.max(40, Math.floor(size)), gap };
    };
    const tall = fit(level.cols, level.rows);
    const wide = fit(level.rows, level.cols);
    return wide.size > tall.size ? wide : tall;
  }, [box, level]);

  const following = nextLevel(level);
  const exit = () => router.push(topicsHref);

  return (
    <KidStage label={tr("Juftini top")}>
      {/* Tepada: chiqish, mavzu nomi, tovush va qaytadan boshlash */}
      <header className="flex items-center gap-3 px-4 pt-3">
        <HoldToExit onExit={exit} />
        <div className="min-w-0 flex-1 text-center">
          <p className={clsx(parentStyles.roundedFont, "truncate text-[19px] font-extrabold leading-tight text-[var(--p-ink)]")}>
            {tr(topic.title)}
          </p>
          <p className="truncate text-[12.5px] font-semibold text-[var(--p-muted)]">
            {tr(level.title)} · {tr("{0} urinish", moves)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => store.setSound(!store.sound)}
          aria-label={store.sound ? tr("Ovozni o'chirish") : tr("Ovozni yoqish")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-card)] text-[var(--p-muted)] shadow-[var(--p-shadow)] active:scale-95"
        >
          {store.sound ? <Volume2 className="h-5 w-5" strokeWidth={2.2} /> : <VolumeX className="h-5 w-5" strokeWidth={2.2} />}
        </button>
        <button
          type="button"
          onClick={() => setRound((value) => value + 1)}
          aria-label={tr("Qaytadan boshlash")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-card)] text-[var(--p-muted)] shadow-[var(--p-shadow)] active:scale-95"
        >
          <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </header>

      {/* Topilgan juftlar — raqamsiz, rasm bilan to'lib boradi */}
      {/* 8 ta joy ham 375px ga chetlarga tegmay sig'adi */}
      <div
        className={clsx("mt-4 flex justify-center px-4", level.pairs > 6 ? "gap-1.5" : "gap-2")}
        aria-label={tr("{0} / {1} juft topildi", found.length, level.pairs)}
      >
        {Array.from({ length: level.pairs }, (_, i) => {
          const item = found[i];
          return (
            <span
              key={i}
              className={clsx("flex items-center justify-center rounded-full", level.pairs > 6 ? "h-8 w-8" : "h-9 w-9")}
              style={{ background: item ? tone.soft : "var(--p-sunken)" }}
            >
              {item && (
                <img
                  src={item.image}
                  alt=""
                  draggable={false}
                  className={clsx(styles.slotIn, "object-contain", level.pairs > 6 ? "h-6 w-6" : "h-7 w-7")}
                />
              )}
            </span>
          );
        })}
      </div>

      {/* Kartalar taxtasi */}
      <div ref={setBoard} className="relative mx-4 my-4 flex min-h-0 flex-1 items-center justify-center">
        {layout && deck.length > 0 && (
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${layout.cols}, ${layout.size}px)`,
              gridAutoRows: `${layout.size}px`,
              gap: layout.gap,
            }}
          >
            {deck.map((card, index) => {
              const matched = foundIds.has(card.item.id);
              const up = phase === "peek" || phase === "won" || matched || open.includes(index);
              return (
                <button
                  key={`${round}-${card.uid}`}
                  type="button"
                  onClick={() => flip(index)}
                  disabled={phase !== "play" || matched}
                  aria-label={up ? tr(card.item.name) : tr("Yopiq karta")}
                  className={clsx(
                    styles.card,
                    up && styles.up,
                    matched && styles.matched,
                    matched && justFound?.item.id === card.item.id && styles.found,
                    missed.includes(index) && styles.miss,
                  )}
                  style={{ width: layout.size, height: layout.size }}
                >
                  <span className={styles.inner}>
                    <span className={clsx(styles.face, styles.back)} style={{ background: tone.solid }}>
                      <CardBackMark size={layout.size} />
                    </span>
                    <span className={clsx(styles.face, styles.front)}>
                      <img src={card.item.image} alt="" draggable={false} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {phase === "loading" && (
          <p className="absolute text-[15px] font-semibold text-[var(--p-muted)]">{tr("Kartalar tarqatilmoqda…")}</p>
        )}
      </div>

      {/* Pastda: topilgan rasm nomi yoki holat izohi. Joy oldindan ajratilgan — taxta sakramaydi */}
      <div className="flex h-[76px] items-start justify-center px-4 pb-3">
        {justFound && phase !== "won" ? (
          <div
            key={justFound.key}
            className={clsx(styles.bubble, "flex items-center gap-2.5 rounded-full bg-[var(--p-card)] py-2 pl-2 pr-5 shadow-[var(--p-shadow)]")}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: tone.soft }}>
              <img src={justFound.item.image} alt="" draggable={false} className="h-8 w-8 object-contain" />
            </span>
            <span className={clsx(parentStyles.roundedFont, "text-[22px] font-extrabold text-[var(--p-ink)]")}>
              {tr(justFound.item.name)}!
            </span>
          </div>
        ) : phase === "peek" ? (
          <p className={clsx(parentStyles.roundedFont, "pt-3 text-[17px] font-bold text-[var(--p-muted)]")}>
            {tr("Rasmlarni eslab qoling…")}
          </p>
        ) : phase === "play" && found.length === 0 && open.length === 0 && moves === 0 ? (
          <p className={clsx(parentStyles.roundedFont, "pt-3 text-[17px] font-bold text-[var(--p-muted)]")}>
            {tr("Kartani bosing!")}
          </p>
        ) : null}
      </div>

      {phase === "won" && (
        <WinOverlay
          stars={stars}
          subtitle={tr("{0} ta juftni {1} urinishda topding", level.pairs, moves)}
          toneSolid={tone.solid}
          onAgain={() => setRound((value) => value + 1)}
          onNext={
            following
              ? () => {
                  store.setLevel(following.id);
                  router.replace(`${topicsHref}/${topic.id}?daraja=${following.id}`);
                }
              : null
          }
          onTopics={exit}
        />
      )}
    </KidStage>
  );
}

/** Karta orqasi: oq yulduzcha va nuqtalar — hamma kartada bir xil */
function CardBackMark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size * 0.62} height={size * 0.62} aria-hidden="true">
      <circle cx="18" cy="20" r="4" fill="white" opacity="0.35" />
      <circle cx="84" cy="78" r="5" fill="white" opacity="0.3" />
      <circle cx="80" cy="18" r="3" fill="white" opacity="0.4" />
      <circle cx="20" cy="82" r="3" fill="white" opacity="0.35" />
      <path
        d="M50 22l8.3 16.8 18.5 2.7-13.4 13 3.2 18.4L50 64.2l-16.6 8.7 3.2-18.4-13.4-13 18.5-2.7Z"
        fill="white"
        opacity="0.92"
        stroke="white"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
