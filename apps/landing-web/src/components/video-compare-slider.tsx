"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ikkita videoni bir freymda ko'rsatadi: video1 old planda, video2 orqada.
 * Desktopda kursorni ushlab ongga surish orqali video2 ochiladi (wipe effekti).
 * Mobilda drag qulay bo'lmagani uchun chap/o'ng chetlarda strelka tugmalari
 * beriladi — ular bosilganda faol bo'lmagan video pauza qilinadi.
 */
export function VideoCompareSlider({
  videoFront,
  videoBack,
  className,
}: {
  videoFront: string;
  videoBack: string;
  className?: string;
}) {
  const [reveal, setReveal] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const frontVideoRef = useRef<HTMLVideoElement>(null);
  const backVideoRef = useRef<HTMLVideoElement>(null);

  const goTo = (value: number) => {
    setTransitioning(true);
    setReveal(value);
  };

  // Faqat 2 ta video bo'lgani uchun chap/o'ng tugma bosilganda ular
  // navbat bilan almashadi — bir tugmani qayta-qayta bossa ham to'xtab
  // qolmay, ikkalasi orasida aylanaveradi.
  const toggle = () => goTo(reveal >= 50 ? 0 : 100);

  useEffect(() => {
    // Animatsiya davomida video hali ko'rinib turgani uchun pauza qilinmaydi —
    // faqat CSS o'tishi tugagach (transitioning false bo'lgach) qo'llanadi.
    if (transitioning) return;
    if (reveal <= 0) {
      backVideoRef.current?.pause();
      void frontVideoRef.current?.play();
    } else if (reveal >= 100) {
      frontVideoRef.current?.pause();
      void backVideoRef.current?.play();
    } else {
      void frontVideoRef.current?.play();
      void backVideoRef.current?.play();
    }
  }, [reveal, transitioning]);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setReveal(Math.min(100, Math.max(0, ratio)));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setTransitioning(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const stopDragging = () => {
    draggingRef.current = false;
  };

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto aspect-[3/4] w-full max-w-[320px] touch-none select-none overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] ${className ?? ""}`}
      style={{ background: "var(--color-tint)" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerLeave={stopDragging}
      onPointerCancel={stopDragging}
    >
      <video ref={backVideoRef} src={videoBack} className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline />
      <div
        className={`absolute inset-0 overflow-hidden ${transitioning ? "transition-[clip-path] duration-500 ease-in-out" : ""}`}
        style={{ clipPath: `inset(0 0 0 ${reveal}%)` }}
        onTransitionEnd={() => setTransitioning(false)}
      >
        <video ref={frontVideoRef} src={videoFront} className="h-full w-full object-cover" autoPlay loop muted playsInline />
      </div>

      <div
        className={`pointer-events-none absolute inset-y-0 hidden w-[3px] -translate-x-1/2 bg-white/90 sm:block ${
          transitioning ? "transition-[left] duration-500 ease-in-out" : ""
        }`}
        style={{ left: `${reveal}%` }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)]">
          <svg viewBox="0 0 20 20" fill="none" stroke="var(--color-text)" strokeWidth="1.8" strokeLinecap="round" className="h-3.5 w-3.5">
            <path d="M7 5 3 10l4 5M13 5l4 5-4 5" />
          </svg>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 inset-x-2 flex items-center justify-between sm:hidden">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Birinchi video"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-[var(--shadow-card)] backdrop-blur-sm"
          style={{ background: "rgba(255,255,255,0.28)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Ikkinchi video"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-[var(--shadow-card)] backdrop-blur-sm"
          style={{ background: "rgba(255,255,255,0.28)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
