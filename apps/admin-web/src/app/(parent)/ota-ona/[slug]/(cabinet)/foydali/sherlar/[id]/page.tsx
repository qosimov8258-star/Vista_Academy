"use client";

import { use, useMemo, useState } from "react";
import clsx from "clsx";
import styles from "../../../../parent.module.css";
import { usePoem, type Poem } from "../../content";
import { useLearned, useTextSize } from "../../store";
import { Chip, FoydaliHeader, LearnedButton, NotFoundCard, StarIcon, TextSizeControl, formatUzDate } from "../../ui";

/**
 * She'r sahifasi — yodlash uchun uch usul:
 * - O'qish: butun she'r, katta harflarda;
 * - Qatorma-qator: bitta qator katta ko'rinadi, oldingisi xira — bola bilan
 *   birga takrorlab boriladi;
 * - So'z o'yini: ba'zi so'zlar yashiriladi, bola ularni aytadi, ota-ona
 *   bosib tekshiradi.
 * Oxirida "Yodladik!" — belgi telefonda saqlanadi.
 */

type Mode = "read" | "lines" | "game";

const MODES: Array<{ key: Mode; label: string }> = [
  { key: "read", label: "O'qish" },
  { key: "lines", label: "Qatorma-qator" },
  { key: "game", label: "So'z o'yini" },
];

/** Matn o'lchamiga qarab she'r shrifti (px) */
const POEM_SIZES = [19, 22, 26] as const;

export default function PoemPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params);
  const base = `/ota-ona/${slug}/foydali`;
  const { data: poem } = usePoem(id);
  const { has, toggle } = useLearned();
  const size = useTextSize();
  const [mode, setMode] = useState<Mode>("read");

  if (!poem) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4">
        <FoydaliHeader backHref={`${base}/sherlar`} backLabel="She'rlar" title="She'r" />
        <NotFoundCard
          backHref={`${base}/sherlar`}
          backLabel="She'rlarga qaytish"
          text="Bu she'r o'chirilgan yoki hali qo'shilmagan."
        />
      </div>
    );
  }

  const fontSize = POEM_SIZES[size];
  const lineCount = poem.stanzas.reduce((n, stanza) => n + stanza.length, 0);
  const learned = has("poems", poem.id);

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader backHref={`${base}/sherlar`} backLabel="She'rlar" title={poem.title} right={<TextSizeControl />} />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {poem.author && <Chip tone="lilac">{poem.author}</Chip>}
        <Chip>
          {poem.ageFrom}–{poem.ageTo} yosh
        </Chip>
        <Chip>
          {poem.stanzas.length} band · {lineCount} qator
        </Chip>
        <Chip>{poem.groupName ?? "Barcha guruhlar"}</Chip>
      </div>

      <div role="radiogroup" aria-label="Yodlash usuli" className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-[var(--p-sunken)] p-1">
        {MODES.map((option) => {
          const active = option.key === mode;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(option.key)}
              className={clsx(
                "cursor-pointer rounded-full py-2.5 text-[13px] font-bold transition-colors",
                active ? "bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)]" : "text-[var(--p-muted)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {mode === "read" && <ReadView poem={poem} fontSize={fontSize} />}
      {mode === "lines" && <LineByLine poem={poem} fontSize={fontSize} />}
      {mode === "game" && <WordGame poem={poem} fontSize={fontSize} />}

      <LearnedButton
        learned={learned}
        onToggle={() => toggle("poems", poem.id)}
        idleLabel="Yodladik!"
        doneLabel="Yodlandi"
        hint={learned ? "Belgini olib tashlash uchun yana bosing" : "Bolangiz she'rni yoddan aytib bersa — belgilang"}
      />
      <p className="mt-6 text-center text-[12.5px] text-[var(--p-muted)]">
        {poem.addedBy} qo&apos;shgan · {formatUzDate(poem.addedAt)}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * O'qish
 * ------------------------------------------------------------------------ */

function ReadView({ poem, fontSize }: { poem: Poem; fontSize: number }) {
  return (
    <div className="relative mt-4 overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] px-5 py-8 shadow-[var(--p-shadow)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(167,139,250,0.16),transparent)]"
      />
      <div className={`${styles.roundedFont} relative text-center`} style={{ fontSize }}>
        {poem.stanzas.map((stanza, i) => (
          <div key={i}>
            {i > 0 && <StanzaDivider />}
            {stanza.map((line, j) => (
              <p key={j} className="font-semibold leading-[1.6] text-[var(--p-ink)]">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StanzaDivider() {
  return (
    <div aria-hidden="true" className="my-5 flex items-center justify-center gap-1.5 text-[var(--p-lilac)]">
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
      <StarIcon filled className="h-3.5 w-3.5 opacity-80" />
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Qatorma-qator
 * ------------------------------------------------------------------------ */

function LineByLine({ poem, fontSize }: { poem: Poem; fontSize: number }) {
  const lines = useMemo(
    () => poem.stanzas.flatMap((stanza, s) => stanza.map((text) => ({ text, stanza: s }))),
    [poem],
  );
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const current = lines[index];
  const previous = index > 0 ? lines[index - 1] : null;
  const last = index === lines.length - 1;

  if (finished || !current) {
    return (
      <div className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] px-5 py-8 text-center shadow-[var(--p-shadow)]">
        <span
          className={`${styles.starPop} mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--p-sun)]/20 text-[var(--p-sun-ink)]`}
        >
          <StarIcon filled className="h-9 w-9" />
        </span>
        <p className={`${styles.roundedFont} mt-3 text-[22px] font-extrabold text-[var(--p-ink)]`}>Barakalla!</p>
        <p className="mx-auto mt-1 max-w-[280px] text-[14px] leading-relaxed text-[var(--p-muted)]">
          She&apos;r oxirigacha o&apos;qildi. Endi bolangiz uni yoddan aytib ko&apos;rsin.
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setFinished(false);
          }}
          className="mt-5 cursor-pointer rounded-full bg-[var(--p-sunken)] px-5 py-3 text-[14.5px] font-bold text-[var(--p-ink)] transition-transform active:scale-[0.97]"
        >
          Yana boshidan
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]">
      <div className="flex items-center justify-between text-[12.5px] font-semibold text-[var(--p-muted)]">
        <span>{current.stanza + 1}-band</span>
        <span className="tabular-nums">
          {index + 1} / {lines.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--p-sunken)]">
        <div
          className="h-full rounded-full bg-[var(--p-lilac)] transition-[width] duration-300 ease-out"
          style={{ width: `${((index + 1) / lines.length) * 100}%` }}
        />
      </div>

      <div className={`${styles.roundedFont} flex min-h-[210px] flex-col items-center justify-center py-6 text-center`}>
        {previous && (
          <p className="mb-3 font-semibold text-[var(--p-muted)] opacity-70" style={{ fontSize: fontSize * 0.78 }}>
            {previous.text}
          </p>
        )}
        <p
          key={index}
          className={`${styles.lineIn} font-extrabold leading-snug text-[var(--p-ink)]`}
          style={{ fontSize: fontSize * 1.3 }}
        >
          {current.text}
        </p>
      </div>
      <p className="text-center text-[13px] text-[var(--p-muted)]">Qatorni bolangiz bilan 2–3 marta birga ayting</p>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="cursor-pointer rounded-full bg-[var(--p-sunken)] px-5 py-3.5 text-[15px] font-bold text-[var(--p-ink)] transition-transform active:scale-[0.97] disabled:cursor-default disabled:opacity-40"
        >
          Orqaga
        </button>
        <button
          type="button"
          onClick={() => (last ? setFinished(true) : setIndex((i) => i + 1))}
          className="cursor-pointer rounded-full bg-[var(--p-lilac)] py-3.5 text-[15px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(167,139,250,0.9)] transition-transform active:scale-[0.98]"
        >
          {last ? "Tugatish" : "Keyingi qator"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * So'z o'yini
 * ------------------------------------------------------------------------ */

type Level = "oson" | "orta" | "qiyin";

const LEVELS: Array<{ key: Level; label: string }> = [
  { key: "oson", label: "Oson" },
  { key: "orta", label: "O'rta" },
  { key: "qiyin", label: "Qiyin" },
];

interface Token {
  prefix: string;
  core: string;
  suffix: string;
  hidden: boolean;
}

const LETTER = /\p{L}/u;

/**
 * Qatorni so'zlarga ajratadi. Tinish belgilari ("«Uyg'on!»" dagi qo'shtirnoq
 * va undov) yashirilmaydi — faqat so'zning o'zi. O'zbekcha apostrof (o', g')
 * so'zning bir qismi, u ajratilmaydi.
 *   oson  — har qatorning oxirgi so'zi (qofiya — eslash oson);
 *   o'rta — har ikkinchi so'z;
 *   qiyin — birinchisidan boshqa hammasi.
 */
function tokenize(line: string, level: Level): Token[] {
  const tokens = line
    .split(" ")
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^([«"“(—–-]*)(.*?)([»"”),.!?:;—–-]*)$/u);
      return { prefix: match?.[1] ?? "", core: match?.[2] ?? raw, suffix: match?.[3] ?? "", hidden: false };
    });
  const words = tokens.map((token, i) => (LETTER.test(token.core) ? i : -1)).filter((i) => i >= 0);
  const hide = new Set<number>();
  if (level === "oson" && words.length > 0) hide.add(words[words.length - 1]);
  if (level === "orta") words.forEach((i, n) => n % 2 === 1 && hide.add(i));
  if (level === "qiyin") words.forEach((i, n) => n > 0 && hide.add(i));
  return tokens.map((token, i) => ({ ...token, hidden: hide.has(i) }));
}

function WordGame({ poem, fontSize }: { poem: Poem; fontSize: number }) {
  const [level, setLevel] = useState<Level>("oson");
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const stanzas = useMemo(() => poem.stanzas.map((stanza) => stanza.map((line) => tokenize(line, level))), [poem, level]);
  const hiddenKeys = useMemo(
    () =>
      stanzas.flatMap((stanza, s) =>
        stanza.flatMap((tokens, l) => tokens.flatMap((token, w) => (token.hidden ? [`${s}-${l}-${w}`] : []))),
      ),
    [stanzas],
  );
  const allOpen = hiddenKeys.length > 0 && hiddenKeys.every((key) => revealed.has(key));

  return (
    <div className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] px-4 py-5 shadow-[var(--p-shadow)]">
      <div role="radiogroup" aria-label="Qiyinlik" className="grid grid-cols-3 gap-1 rounded-full bg-[var(--p-sunken)] p-1">
        {LEVELS.map((option) => {
          const active = option.key === level;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setLevel(option.key);
                setRevealed(new Set());
              }}
              className={clsx(
                "cursor-pointer rounded-full py-2 text-[13px] font-bold transition-colors",
                active ? "bg-[var(--p-lilac)] text-white" : "text-[var(--p-muted)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[13px] leading-snug text-[var(--p-muted)]">Bolangiz yashirin so&apos;zni aytsin, keyin bosib tekshiring</p>
        <button
          type="button"
          onClick={() => setRevealed(allOpen ? new Set() : new Set(hiddenKeys))}
          className="shrink-0 cursor-pointer rounded-full bg-[var(--p-lilac)]/14 px-3 py-1.5 text-[12.5px] font-bold text-[var(--p-lilac-ink)]"
        >
          {allOpen ? "Yashirish" : "Hammasini ochish"}
        </button>
      </div>

      <div className={`${styles.roundedFont} mt-5 text-center`} style={{ fontSize }}>
        {stanzas.map((stanza, s) => (
          <div key={s} className={s > 0 ? "mt-5" : undefined}>
            {stanza.map((tokens, l) => (
              <p key={l} className="font-semibold leading-[1.9] text-[var(--p-ink)]">
                {tokens.map((token, w) => {
                  const key = `${s}-${l}-${w}`;
                  let word: React.ReactNode = token.core;
                  if (token.hidden && !revealed.has(key)) {
                    word = (
                      <button
                        type="button"
                        aria-label="Yashirin so'z — ochish uchun bosing"
                        onClick={() => setRevealed((prev) => new Set(prev).add(key))}
                        className="mx-[0.06em] inline-block h-[1.05em] translate-y-[0.14em] cursor-pointer rounded-[0.3em] border-b-[3px] border-dashed border-[var(--p-lilac)] bg-[var(--p-lilac)]/12 align-baseline transition-colors active:bg-[var(--p-lilac)]/25"
                        style={{ width: `${Math.max(1.6, token.core.length * 0.56)}em` }}
                      />
                    );
                  } else if (token.hidden) {
                    word = (
                      <span className={`${styles.reveal} rounded-[0.3em] bg-[var(--p-mint)]/14 px-[0.12em] text-[var(--p-mint)]`}>
                        {token.core}
                      </span>
                    );
                  }
                  return (
                    <span key={w}>
                      {w > 0 && " "}
                      {token.prefix}
                      {word}
                      {token.suffix}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        ))}
      </div>

      {allOpen && (
        <p className="mt-4 text-center text-[14.5px] font-bold text-[var(--p-mint)]">Hammasi topildi — barakalla!</p>
      )}
    </div>
  );
}
