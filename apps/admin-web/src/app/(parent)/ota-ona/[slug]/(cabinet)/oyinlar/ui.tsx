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
export function KidStage({ children, label }: { children: React.ReactNode; label: string }) {
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
          <div className={styles.stage} role="application" aria-label={label} onContextMenu={(event) => event.preventDefault()}>
            {children}
          </div>,
          host,
        )}
    </>
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

  const stop = (showHint: boolean) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    startedAt.current = null;
    setProgress(0);
    if (showHint) setHint(true);
  };

  const start = () => {
    setHint(false);
    startedAt.current = performance.now();
    const tick = (now: number) => {
      if (startedAt.current === null) return;
      const value = Math.min(1, (now - startedAt.current) / HOLD_MS);
      setProgress(value);
      if (value >= 1) {
        frame.current = null;
        startedAt.current = null;
        exitRef.current();
        return;
      }
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
          event.currentTarget.setPointerCapture(event.pointerId);
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
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-card)] text-[var(--p-muted)] shadow-[var(--p-shadow)]"
      >
        <svg viewBox="0 0 44 44" className="absolute inset-0 h-11 w-11 -rotate-90" aria-hidden="true">
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke="var(--p-coral)"
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
