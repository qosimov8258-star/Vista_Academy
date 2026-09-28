"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * VideoCompareSlider bilan bir xil o'lcham/burchak/soyali portret videokartochka,
 * lekin bitta video uchun (solishtiriladigan ikkinchisi yo'q). Ovoz xatti-harakati
 * ham bir xil: video ekranga ~yarmi ko'rinadigan darajada kirganda avtomatik
 * yoqiladi, chiqib ketganda o'chadi — foydalanuvchi qo'lda o'chirsa/yoqsa, shu
 * tanlovi ekranga kirib-chiqishdan qat'i nazar saqlanib qoladi.
 */
export function SingleVideoCard({ src, className }: { src: string; className?: string }) {
  const t = useTranslations("videoCompare");
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userToggledSoundRef = useRef(false);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn;
  }, [soundOn]);

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

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] ${className ?? ""}`}
      style={{ background: "var(--color-tint)" }}
    >
      <video ref={videoRef} src={src} className="h-full w-full object-cover" autoPlay loop muted playsInline />

      <button
        type="button"
        onClick={toggleSound}
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
    </div>
  );
}
