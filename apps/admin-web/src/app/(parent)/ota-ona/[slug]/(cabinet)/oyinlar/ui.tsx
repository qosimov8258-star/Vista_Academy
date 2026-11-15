"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import type { IconProps } from "@/components/ui/icons";
import parentStyles from "../../parent.module.css";
import styles from "./oyinlar.module.css";
import type { TopicTone } from "./data";
import { useTr } from "@/i18n/tr";

/** Mavzu tuslari — kabinet palitrasidan, yorug' va qorong'i rejimda ham o'qiladi */
export const TONE: Record<TopicTone, { solid: string; soft: string; ink: string }> = {
  mint: { solid: "var(--p-mint)", soft: "color-mix(in srgb, var(--p-mint) 16%, transparent)", ink: "var(--p-mint)" },
  coral: { solid: "var(--p-coral)", soft: "color-mix(in srgb, var(--p-coral) 16%, transparent)", ink: "var(--p-coral)" },
  sky: { solid: "var(--p-sky)", soft: "color-mix(in srgb, var(--p-sky) 16%, transparent)", ink: "var(--p-sky-ink)" },
  lilac: { solid: "var(--p-lilac)", soft: "color-mix(in srgb, var(--p-lilac) 16%, transparent)", ink: "var(--p-lilac-ink)" },
  sun: { solid: "var(--p-sun)", soft: "color-mix(in srgb, var(--p-sun) 18%, transparent)", ink: "var(--p-sun-ink)" },
};

/**
 * Pastki menyudagi «O'yinlar» belgisi — `components/ui/icons` bilan bir xil
 * to'r va chiziq (24×24, 1.6), faol bo'limda to'ldirilgan.
 */
export function GamesIcon({ filled, ...props }: IconProps) {
  const common = { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false, ...props } as const;
  if (filled) {
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M7.4 6.4h9.2a4.6 4.6 0 0 1 4.5 3.7l.9 4.9a3 3 0 0 1-5.2 2.6l-1.6-1.8H8.8l-1.6 1.8A3 3 0 0 1 2 15l.9-4.9a4.6 4.6 0 0 1 4.5-3.7Zm.6 3a.8.8 0 0 0-.8.8v.8h-.8a.8.8 0 0 0 0 1.6h.8v.8a.8.8 0 0 0 1.6 0v-.8h.8a.8.8 0 0 0 0-1.6h-.8v-.8a.8.8 0 0 0-.8-.8Zm8.2.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-1.8 2.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.4 7.2h9.2a3.8 3.8 0 0 1 3.7 3.1l.9 4.8a2.3 2.3 0 0 1-4 2l-1.8-2H8.6l-1.8 2a2.3 2.3 0 0 1-4-2l.9-4.8a3.8 3.8 0 0 1 3.7-3.1Z" />
      <path d="M8 10.4v2.6M6.7 11.7h2.6" />
      <path d="M16.2 10.6h.01M14.6 12.6h.01" strokeWidth={2.2} />
    </svg>
  );
}

/** Uchta yulduzcha — nechtasi olingan bo'lsa, shunchasi to'ldirilgan */
export function StarRow({ count, size = 16, className }: { count: number; size?: number; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-0.5", className)} aria-label={`${count}/3`}>
      {[0, 1, 2].map((i) => (
        <GameStar key={i} filled={i < count} size={size} />
      ))}
    </span>
  );
}

export function GameStar({ filled, size, className }: { filled: boolean; size: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <path
        d="M12 2.8l2.75 5.6 6.15.9-4.45 4.34 1.05 6.13L12 16.88l-5.5 2.89 1.05-6.13L3.1 9.3l6.15-.9Z"
        fill={filled ? "var(--p-sun)" : "var(--p-sunken)"}
        stroke={filled ? "var(--p-sun-ink)" : "var(--p-line)"}
        strokeWidth={filled ? 0.8 : 1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Bolalar rejimi sahnasi. Kabinet qobig'iga (`.shell`) portal orqali
 * chiqariladi: sahifa o'tish animatsiyasidagi `transform`/`will-change`
 * `position: fixed` ni buzib qo'ymasin va mavzu ranglari saqlanib qolsin.
 * Ochiq turganda sahifa aylanmaydi (iOS'da «tortib yangilash» ham yo'q).
 */
export function KidStage({ children, label, tone = "mint" }: { children: React.ReactNode; label: string; tone?: TopicTone }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost((anchor.current?.closest(`.${parentStyles.shell}`) as HTMLElement | null) ?? document.body);
    const html = document.documentElement;
    const prev = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.overflow;
      html.style.overscrollBehavior = prev.overscroll;
    };
  }, []);

  return (
    <>
      <span ref={anchor} hidden />
      {host &&
        createPortal(
          <div
            className={styles.stage}
            data-kid-stage=""
            role="application"
            aria-label={label}
            onContextMenu={(event) => event.preventDefault()}
            // Mavzu rangi — fon, kartalar va tugmalar shundan oladi (oyinlar.module.css)
            style={{ "--g": TONE[tone].solid } as React.CSSProperties}
          >
            <StageDecor />
            {children}
          </div>,
          host,
        )}
    </>
  );
}

/** Fon bezagi: sekin suzuvchi doira va halqalar (faqat ko'rinish uchun) */
const DECOR: Array<{ left: string; top: string; size: number; ring?: boolean; delay: number }> = [
  { left: "-6%", top: "14%", size: 120, delay: 0 },
  { left: "78%", top: "8%", size: 84, ring: true, delay: -3 },
  { left: "86%", top: "46%", size: 56, delay: -6 },
  { left: "6%", top: "62%", size: 44, ring: true, delay: -2 },
  { left: "62%", top: "84%", size: 150, delay: -8 },
  { left: "22%", top: "90%", size: 30, delay: -5 },
];

function StageDecor() {
  return (
    <div className={styles.decor} aria-hidden="true">
      {DECOR.map((shape, i) => (
        <span
          key={i}
          data-ring={shape.ring ? "" : undefined}
          style={{ left: shape.left, top: shape.top, width: shape.size, height: shape.size, animationDelay: `${shape.delay}s` }}
        />
      ))}
    </div>
  );
}

/** Tepa qatordagi dumaloq shisha tugma (tovush, qaytadan boshlash) */
export function StageButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={clsx(styles.chip, "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90")}
    >
      {children}
    </button>
  );
}

/** O'yin tepasi: chapda chiqish (bosib turish), o'rtada nom va izoh, o'ngda amallar */
export function StageHeader({
  title,
  subtitle,
  onExit,
  children,
}: {
  title: string;
  subtitle: string;
  onExit: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-2.5 px-4 pt-3">
      <HoldToExit onExit={onExit} />
      <div className="min-w-0 flex-1 text-center">
        <p className={clsx(parentStyles.roundedFont, "truncate text-[20px] leading-tight text-[var(--p-ink)]")}>{title}</p>
        <p className="truncate text-[12.5px] font-semibold text-[var(--p-ink)]/55">{subtitle}</p>
      </div>
      {children}
    </header>
  );
}

/**
 * Topilganlar «patnisi»: shisha kapsula ichida joylar — har topilgan narsa
 * rasmi bilan to'ladi (raqamsiz ham tushunarli), o'ngda hisob.
 */
export function ProgressTray({ total, images, label }: { total: number; images: string[]; label: string }) {
  const small = total > 6;
  return (
    <div className="mt-3.5 flex justify-center px-4">
      <div className={clsx(styles.chip, "flex max-w-full items-center rounded-full py-1.5 pl-2 pr-3", small ? "gap-1" : "gap-1.5")} aria-label={label}>
        {Array.from({ length: total }, (_, i) => {
          const src = images[i];
          return (
            <span
              key={i}
              className={clsx("flex shrink-0 items-center justify-center rounded-full", small ? "h-7 w-7" : "h-8 w-8")}
              style={{ background: src ? "color-mix(in srgb, var(--g) 22%, transparent)" : "color-mix(in srgb, var(--p-ink) 7%, transparent)" }}
            >
              {src && <img src={src} alt="" draggable={false} className={clsx(styles.slotIn, "h-[74%] w-[74%] object-contain")} />}
            </span>
          );
        })}
        <span className="ml-1.5 shrink-0 text-[13px] font-bold tabular-nums text-[var(--p-ink)]/70">
          {images.length}/{total}
        </span>
      </div>
    </div>
  );
}

/** Topilgan narsa nomi — pastda sakrab chiqadigan shisha pufakcha */
export function NameBubble({ image, name }: { image: string; name: string }) {
  return (
    <div className={clsx(styles.bubble, styles.chip, "flex items-center gap-3 rounded-full py-2 pl-2 pr-6")}>
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--g) 22%, transparent)" }}
      >
        <img src={image} alt="" draggable={false} className="h-9 w-9 object-contain" />
      </span>
      <span className={clsx(parentStyles.roundedFont, "text-[24px] text-[var(--p-ink)]")}>{name}!</span>
    </div>
  );
}

const HOLD_MS = 1200;

/**
 * Chiqish tugmasi — bosib turish kerak (1.2 s, atrofidagi halqa to'ladi).
 * Kichkintoy tasodifan bosib, kabinetning boshqa bo'limlariga (to'lov,
 * xabarlar) chiqib ketmasligi uchun. Qisqa bosilsa — maslahat chiqadi.
 * Kompyuterda Esc ham ishlaydi.
 */
export function HoldToExit({ onExit }: { onExit: () => void }) {
  const tr = useTr();
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState(false);
  const frame = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  const timer = useRef<number | null>(null);

  // Chiqish oddiy taymer bilan: requestAnimationFrame ilova fonda bo'lsa
  // to'xtaydi, shuning uchun u faqat halqani chizish uchun ishlatiladi.
  const stop = (showHint: boolean) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) window.clearTimeout(timer.current);
    frame.current = null;
    timer.current = null;
    startedAt.current = null;
    setProgress(0);
    if (showHint) setHint(true);
  };

  const start = () => {
    if (startedAt.current !== null) return;
    setHint(false);
    startedAt.current = performance.now();
    timer.current = window.setTimeout(() => {
      stop(false);
      exitRef.current();
    }, HOLD_MS);
    const tick = (now: number) => {
      if (startedAt.current === null) return;
      setProgress(Math.min(1, (now - startedAt.current) / HOLD_MS));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(false), 2200);
    return () => window.clearTimeout(timer);
  }, [hint]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exitRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const R = 20;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={tr("Chiqish uchun bosib turing")}
        onPointerDown={(event) => {
          try {
            // Barmoq tugmadan biroz siljisa ham bosish uzilmasin
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // ba'zi brauzerlarda qo'llanmaydi — bosib turish baribir ishlaydi
          }
          start();
        }}
        onPointerUp={() => stop(startedAt.current !== null)}
        onPointerCancel={() => stop(false)}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !event.repeat) start();
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") stop(startedAt.current !== null);
        }}
        className={clsx(styles.chip, "relative flex h-11 w-11 items-center justify-center rounded-full")}
      >
        <svg viewBox="0 0 44 44" className="absolute inset-0 h-11 w-11 -rotate-90" aria-hidden="true">
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke="var(--p-red)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            className={styles.holdRing}
            opacity={progress > 0 ? 1 : 0}
          />
        </svg>
        <X className="h-5 w-5" strokeWidth={2.4} />
      </button>
      {hint && (
        <span
          role="status"
          className="absolute left-0 top-[52px] z-10 whitespace-nowrap rounded-full bg-[var(--p-ink)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--p-bg)] shadow-[var(--p-shadow)]"
        >
          {tr("Chiqish uchun bosib turing")}
        </span>
      )}
    </div>
  );
}
