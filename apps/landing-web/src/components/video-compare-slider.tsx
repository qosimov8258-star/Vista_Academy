"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Ikkita videoni bir freymda ko'rsatadi: video1 old planda, video2 orqada.
 * Kursorni ushlab surish (yoki barmoq bilan drag) orqali video2 ochiladi
 * (wipe effekti). Bundan tashqari chap/o'ng chetlarda strelka tugmalari ham
 * bor (barcha ekran o'lchamlarida ko'rinadi) — ular bosilganda faol
 * bo'lmagan video pauza qilinadi.
 *
 * Ovoz: video shu joy ekranga ~yarmi ko'rinadigan darajada kirganda avtomatik
 * yoqiladi (faol — hozir ustida turgan — videoning ovozi), chiqib ketganda
 * o'chadi. Foydalanuvchi yuqori o'ngdagi tugma bilan qo'lda o'chirsa/yoqsa,
 * shu tanlovi ekranga kirib-chiqishdan qat'i nazar saqlanib qoladi.
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
  const t = useTranslations("videoCompare");
  const [reveal, setReveal] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const userToggledSoundRef = useRef(false);
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

  // Har qanday paytda faqat "faol" (hozir tepada ko'rinib turgan) videoning
  // ovozi ochiq bo'ladi — ikkalasi baravar ovoz chiqarib qolmasligi uchun.
  const backIsActive = reveal >= 50;
  useEffect(() => {
    if (frontVideoRef.current) frontVideoRef.current.muted = !soundOn || backIsActive;
    if (backVideoRef.current) backVideoRef.current.muted = !soundOn || !backIsActive;
  }, [soundOn, backIsActive]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (userToggledSoundRef.current) return;
        setSoundOn(entry.isIntersecting);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleSound = () => {
    userToggledSoundRef.current = true;
    setSoundOn((v) => !v);
  };

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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleSound();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={soundOn ? t("muteAria") : t("unmuteAria")}
        className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white shadow-[var(--shadow-card)] backdrop-blur-sm transition hover:bg-black/60"
      >
        {soundOn ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 6a9 9 0 0 1 0 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="m23 9-6 6M17 9l6 6" />
          </svg>
        )}
      </button>

      <div className="pointer-events-none absolute inset-y-0 inset-x-2 flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={t("firstAria")}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white shadow-[var(--shadow-card)] backdrop-blur-sm transition hover:bg-black/60 sm:h-11 sm:w-11"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
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
          aria-label={t("secondAria")}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white shadow-[var(--shadow-card)] backdrop-blur-sm transition hover:bg-black/60 sm:h-11 sm:w-11"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
