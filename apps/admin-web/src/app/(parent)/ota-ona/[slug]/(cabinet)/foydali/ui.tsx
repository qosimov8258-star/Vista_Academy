"use client";

import { useId, useState, type CSSProperties } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeftIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import type { Tale } from "./content";
import { setTextSize, useTextSize } from "./store";

/** CSS o'zgaruvchilari (`--x`) bilan to'ldirilgan uslub */
type FxStyle = CSSProperties & Record<`--${string}`, string | number>;

/** Bo'lim ranglari — yorug' va qorong'i rejimda ham o'qiladigan tokenlar */
export const TONES = {
  lilac: { soft: "bg-[var(--p-lilac)]/14", ink: "text-[var(--p-lilac-ink)]", solid: "bg-[var(--p-lilac)]" },
  mint: { soft: "bg-[var(--p-mint)]/14", ink: "text-[var(--p-mint)]", solid: "bg-[var(--p-mint)]" },
  sky: { soft: "bg-[var(--p-sky)]/14", ink: "text-[var(--p-sky-ink)]", solid: "bg-[var(--p-sky)]" },
  sun: { soft: "bg-[var(--p-sun)]/16", ink: "text-[var(--p-sun-ink)]", solid: "bg-[var(--p-sun)]" },
  coral: { soft: "bg-[var(--p-coral)]/14", ink: "text-[var(--p-coral)]", solid: "bg-[var(--p-coral)]" },
} as const;
export type Tone = keyof typeof TONES;
/** Ro'yxatlarda kartalar navbat bilan shu ranglarni oladi */
export const TONE_CYCLE: Tone[] = ["lilac", "sun", "coral", "sky", "mint"];

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

/** "2026-09-08" → "8-sentabr" (vaqt mintaqasiga bog'liq emas) */
export function formatUzDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day}-${MONTHS[(month ?? 1) - 1]}`;
}

export function FoydaliHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  right,
}: {
  backHref?: string;
  backLabel?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="pt-5">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--p-card)] py-1.5 pl-2 pr-3.5 text-[13.5px] font-semibold text-[var(--p-muted)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.97]"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className={clsx("flex items-end justify-between gap-3", backHref && "mt-4")}>
        <div className="min-w-0">
          <h1
            className={`${styles.roundedFont} text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]`}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--p-muted)]">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Chip({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
        tone ? clsx(TONES[tone].soft, TONES[tone].ink) : "bg-[var(--p-sunken)] text-[var(--p-muted)]",
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-[var(--p-muted)]">{children}</h2>
  );
}

/** Matn o'lchami: ikki tugma — kichikroq va kattaroq "A" */
export function TextSizeControl() {
  const size = useTextSize();
  const button =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full font-extrabold text-[var(--p-ink)] transition-colors active:bg-[var(--p-sunken)] disabled:cursor-default disabled:opacity-30";
  return (
    <div
      role="group"
      aria-label="Matn o'lchami"
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--p-card)] p-1 shadow-[var(--p-shadow)]"
    >
      <button
        type="button"
        aria-label="Matnni kichraytirish"
        disabled={size === 0}
        onClick={() => setTextSize(size === 2 ? 1 : 0)}
        className={clsx(button, "text-[13px]")}
      >
        A
      </button>
      <span className="h-5 w-px bg-[var(--p-line)]" />
      <button
        type="button"
        aria-label="Matnni kattalashtirish"
        disabled={size === 2}
        onClick={() => setTextSize(size === 0 ? 1 : 2)}
        className={clsx(button, "text-[19px]")}
      >
        A
      </button>
    </div>
  );
}

const CONFETTI_COLORS = ["#ffb703", "#ff7a66", "#3fbf9b", "#56b4f5", "#a78bfa", "#ff8fc0"];

/** Tugma atrofida bir marta otiladigan konfetti */
function Confetti() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const distance = 64 + (i % 3) * 26;
        const style: FxStyle = {
          "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
          "--dy": `${Math.round(Math.sin(angle) * distance * 0.75 - 18)}px`,
          "--rot": `${(i % 2 ? 1 : -1) * (160 + i * 17)}deg`,
          "--delay": `${(i % 4) * 0.03}s`,
        };
        return <span key={i} className={styles.confettiPiece} style={style} />;
      })}
    </span>
  );
}

/**
 * "Yodladik!" tugmasi. Belgilanganda konfetti otiladi — bola uchun kichik
 * bayram. Qayta bosilsa belgi olib tashlanadi.
 */
export function LearnedButton({
  learned,
  onToggle,
  idleLabel,
  doneLabel,
  hint,
}: {
  learned: boolean;
  /** Yangi holatni qaytaradi: true — endi belgilangan */
  onToggle: () => boolean;
  idleLabel: string;
  doneLabel: string;
  hint?: string;
}) {
  const [burst, setBurst] = useState(0);
  return (
    <div className="relative mt-5">
      <button
        type="button"
        aria-pressed={learned}
        onClick={() => {
          if (onToggle()) setBurst((n) => n + 1);
        }}
        className={clsx(
          "relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-4 text-[16.5px] font-extrabold transition-[background-color,transform] duration-200 active:scale-[0.98]",
          learned
            ? "bg-[var(--p-mint)] text-white shadow-[0_10px_24px_-10px_rgba(63,191,155,0.8)]"
            : "bg-[var(--p-sun)] text-[#4a3200] shadow-[0_10px_24px_-10px_rgba(255,183,3,0.9)]",
        )}
      >
        <StarIcon
          filled={learned}
          // key: holat almashganda "sakrash" animatsiyasi boshidan ishlasin
          key={learned ? "on" : "off"}
          className={clsx("h-5 w-5", learned && styles.starPop)}
        />
        {learned ? doneLabel : idleLabel}
      </button>
      {burst > 0 && <Confetti key={burst} />}
      {hint && <p className="mt-2 text-center text-[12.5px] text-[var(--p-muted)]">{hint}</p>}
    </div>
  );
}

export function NotFoundCard({ backHref, backLabel, text }: { backHref: string; backLabel: string; text: string }) {
  return (
    <div className="mt-6 rounded-[var(--p-radius)] bg-[var(--p-card)] p-6 text-center shadow-[var(--p-shadow)]">
      <p className={`${styles.roundedFont} text-[20px] font-extrabold text-[var(--p-ink)]`}>Topilmadi</p>
      <p className="mt-1 text-[14px] text-[var(--p-muted)]">{text}</p>
      <Link
        href={backHref}
        className="mt-4 inline-flex rounded-full bg-[var(--p-sunken)] px-5 py-2.5 text-[14px] font-bold text-[var(--p-ink)]"
      >
        {backLabel}
      </Link>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Ikonkalar — bo'limlar uchun o'zimizning chizmalar, bog'cha uslubida
 * ------------------------------------------------------------------------ */

type IconProps = { className?: string };

export function StarIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Ochiq kitob va tepasida yulduzcha — she'rlar */
export function PoemIcon({ className }: IconProps) {
  const book =
    "M4 10.5C4 9.7 4.7 9 5.5 9c3.6 0 6.6.9 10.5 3.2C19.9 9.9 22.9 9 26.5 9c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5-3.5 0-6.5.8-10.5 3-4-2.2-7-3-10.5-3-.8 0-1.5-.7-1.5-1.5v-13z";
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d={book} fill="currentColor" opacity="0.18" />
      <path d={book} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 12.2V27" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 15h4.5M8 18.5h4.5M19.5 15H24M19.5 18.5H24"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path d="M16 1.8l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="currentColor" />
    </svg>
  );
}

/** Qo'shtirnoqli gap pufagi — maqollar */
export function ProverbIcon({ className }: IconProps) {
  const bubble = "M6 6h20a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H14l-6 5v-5H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z";
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d={bubble} fill="currentColor" opacity="0.18" />
      <path d={bubble} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path
        d="M12.4 17.6c-1.5 0-2.5-1-2.5-2.5 0-2 1.4-3.5 3.3-4.1M20.4 17.6c-1.5 0-2.5-1-2.5-2.5 0-2 1.4-3.5 3.3-4.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Hilol va qasr — ertaklar */
export function TaleIcon({ className }: IconProps) {
  const castle = "M5 28V15.5l2.5-2 2.5 2V18h3v-6l3-2.5 3 2.5v6h3v-2.5l2.5-2 2.5 2V28z";
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M25 2.5a5.5 5.5 0 1 0 4.8 8.2 4.6 4.6 0 1 1-4.8-8.2z" fill="currentColor" />
      <path d={castle} fill="currentColor" opacity="0.18" />
      <path d={castle} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 28v-3.5a2 2 0 0 1 4 0V28" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function RiddleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12.5 12.5a3.6 3.6 0 1 1 5.4 3.1c-1.2.7-1.9 1.4-1.9 2.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="22.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function SongIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M12 23V8l14-3v15" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <ellipse cx="8.5" cy="23.5" rx="3.8" ry="3" fill="currentColor" opacity="0.8" />
      <ellipse cx="22.5" cy="20.5" rx="3.8" ry="3" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export function TongueTwisterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M4 16h3.5l2-5 3 10 3-12 3 12 3-10 2 5H28" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Kartalar burchagidagi suzib turadigan yulduzchalar */
export function SparkleDeco({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={clsx(styles.float, className)} aria-hidden="true">
      <path d="M40 6c1.2 7.6 3.6 10 11 11.2-7.4 1.2-9.8 3.6-11 11.2-1.2-7.6-3.6-10-11-11.2 7.4-1.2 9.8-3.6 11-11.2z" fill="#ffc94a" />
      <path d="M18 30c.8 4.8 2.3 6.3 7 7-4.7.7-6.2 2.2-7 7-.8-4.8-2.3-6.3-7-7 4.7-.7 6.2-2.2 7-7z" fill="#a78bfa" opacity="0.85" />
      <circle cx="50" cy="44" r="3" fill="#ff8fa3" />
      <circle cx="30" cy="12" r="2" fill="#56b4f5" />
    </svg>
  );
}

/**
 * Ertak muqovasi. "sholgom" — tepaligidan yarim sug'urilgan, kulib turgan
 * sholg'om; "tun" — oy va yulduzli manzara (yangi ertaklar uchun sukut).
 */
export function TaleCover({ kind, className }: { kind: Tale["cover"]; className?: string }) {
  // Bir sahifada bir nechta muqova bo'lsa gradient identifikatorlari to'qnashmasin
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `cv${uid}${name}`;

  if (kind === "sholgom") {
    return (
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
        <defs>
          <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfe3ff" />
            <stop offset="1" stopColor="#fff3d6" />
          </linearGradient>
          <radialGradient id={id("bulb")} cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#fffaff" />
            <stop offset="0.5" stopColor="#f3dcf6" />
            <stop offset="0.8" stopColor="#d49be0" />
            <stop offset="1" stopColor="#a45cb8" />
          </radialGradient>
          <linearGradient id={id("leaf")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fd36e" />
            <stop offset="1" stopColor="#3f9e46" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill={`url(#${id("sky")})`} />
        <circle cx="268" cy="40" r="30" fill="#ffd166" opacity="0.25" />
        <circle cx="268" cy="40" r="19" fill="#ffd166" />
        <g fill="#ffffff" opacity="0.95">
          <ellipse cx="70" cy="44" rx="32" ry="10" />
          <circle cx="58" cy="37" r="11" />
          <circle cx="77" cy="33" r="14" />
        </g>
        <path d="M0 136 Q70 116 150 128 T320 122 V180 H0Z" fill="#8fd18a" />
        <path d="M0 152 Q90 138 170 150 T320 146 V180 H0Z" fill="#76c46f" />
        <g fill={`url(#${id("leaf")})`}>
          <path d="M160 74 C150 50 132 36 118 34 C122 50 138 66 158 78Z" />
          <path d="M160 74 C160 46 170 26 184 18 C188 38 176 60 162 78Z" />
          <path d="M162 76 C176 56 196 48 210 50 C202 66 184 76 164 80Z" />
        </g>
        <path
          d="M160 72 C196 72 214 98 206 122 C200 140 178 148 166 164 C164 168 156 168 154 164 C142 148 120 140 114 122 C106 98 124 72 160 72Z"
          fill={`url(#${id("bulb")})`}
        />
        <path d="M160 166 C159 171 158 176 160 180" stroke="#a45cb8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Yuzcha — bolalarga yoqsin */}
        <circle cx="148" cy="112" r="3.2" fill="#5b2a66" />
        <circle cx="172" cy="112" r="3.2" fill="#5b2a66" />
        <path d="M152 122 Q160 129 168 122" stroke="#5b2a66" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="142" cy="120" r="4.2" fill="#ff8fa3" opacity="0.5" />
        <circle cx="178" cy="120" r="4.2" fill="#ff8fa3" opacity="0.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id("night")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b3f8f" />
          <stop offset="1" stopColor="#8a78d6" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${id("night")})`} />
      <path d="M232 26a26 26 0 1 0 22 40 22 22 0 1 1-22-40z" fill="#ffe9a8" />
      <g fill="#ffe9a8">
        <circle cx="60" cy="40" r="2" />
        <circle cx="110" cy="24" r="1.6" />
        <circle cx="160" cy="52" r="2.2" />
        <circle cx="290" cy="96" r="1.8" />
        <circle cx="36" cy="92" r="1.5" />
      </g>
      <path d="M0 142 Q80 124 160 136 T320 130 V180 H0Z" fill="#4a3f8f" />
    </svg>
  );
}
