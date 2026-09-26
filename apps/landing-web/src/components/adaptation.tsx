"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Reveal } from "./reveal";

type AdaptationProps = {
  introImageSrc?: string;
  introImageAlt?: string;
  introText?: string;
};

const DEFAULT_INTRO_IMAGE_SRC = "/moslashish/moslashish2.jpeg";
const DEFAULT_INTRO_IMAGE_ALT =
  "Bolakay ryukzagini taqib, ota-onasining qo'lidan ushlagancha guruhga birinchi marta kirib kelmoqda, tarbiyachi va do'stlari uni kulib kutib olishmoqda";
const DEFAULT_INTRO_TEXT =
  "Bog'chadagi birinchi kunlar farzandingiz uchun yangi va hayajonli bosqich. Shuning uchun shoshilmaymiz: avval u siz bilan birga tanishadi, so'ng asta-sekin guruhda ko'proq vaqt o'tkazadi. Tajribali tarbiyachilarimiz har bir bolaga alohida yondashadi — shunda qo'rquv o'rnini ishonch va quvonch egallaydi.";

const JARAYON_TEXT =
  "Moslashish davrida tarbiyachilarimiz farzandingiz holatini doimiy kuzatib boradi. Har bir bosqich ota-onalar bilan kelishilgan holda amalga oshiriladi — shu tufayli bola ham, ota-ona ham bog'cha muhitiga xotirjam ko'nikadi.";

const LOVE_TEXT = (
  <>
    Har bir bola — bitta katta oilaning bir bo&apos;lagi.
    <br />
    Bog&apos;chamizda ular sevgi bilan birlashib, chin do&apos;stlikni his etishadi.
  </>
);

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5l-5 5 5 5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 5l5 5-5 5" />
    </svg>
  );
}

type Slide = {
  image: string;
  alt: string;
  eyebrow?: string;
  title?: string;
  text: ReactNode;
};

function MobileSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full shrink-0 px-1">
      <div className="overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-raised)]">
        <div className="relative aspect-[4/3]">
          <Image src={slide.image} alt={slide.alt} fill sizes="100vw" className="object-cover" />
        </div>
      </div>
      <div className="mt-4 text-center">
        {slide.eyebrow ? (
          <p className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
            {slide.eyebrow}
          </p>
        ) : null}
        {slide.title ? (
          <h3 className="font-heading mt-2 text-[20px] font-bold leading-tight tracking-tight text-[var(--color-text)]">
            {slide.title}
          </h3>
        ) : null}
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-text-muted)]">{slide.text}</p>
      </div>
    </div>
  );
}

export function Adaptation({
  introImageSrc = DEFAULT_INTRO_IMAGE_SRC,
  introImageAlt = DEFAULT_INTRO_IMAGE_ALT,
  introText = DEFAULT_INTRO_TEXT,
}: AdaptationProps) {
  const slides: Slide[] = [
    {
      image: introImageSrc,
      alt: introImageAlt,
      eyebrow: "Moslashuv davri",
      title: "Bog'chaga moslashish — birga, sekin-asta",
      text: introText,
    },
    {
      image: "/moslashish/love.jpg",
      alt: "Bolalar qo'l ushlashib, yurak shaklida do'stlik va sevgi ramzini yasashmoqda",
      text: LOVE_TEXT,
    },
    {
      image: "/moslashish/moslashish1.jpeg",
      alt: "Bolalar bog'chaga moslashish jarayonida tarbiyachi bilan",
      eyebrow: "Har bir qadam nazoratda",
      title: "Moslashish jarayoni — tajribali tarbiyachilar bilan",
      text: JARAYON_TEXT,
    },
  ];

  const length = slides.length;
  // Uzluksiz aylanish uchun boshiga oxirgi, oxiriga birinchi slaydning nusxasi qo'shiladi
  const track: Slide[] = [slides[length - 1], ...slides, slides[0]];

  const [trackIndex, setTrackIndex] = useState(1);
  const [animate, setAnimate] = useState(true);

  const activeIndex = ((trackIndex - 1) % length + length) % length;

  const goPrev = () => {
    setAnimate(true);
    setTrackIndex((i) => i - 1);
  };
  const goNext = () => {
    setAnimate(true);
    setTrackIndex((i) => i + 1);
  };

  const handleTransitionEnd = () => {
    if (trackIndex === 0) {
      setAnimate(false);
      setTrackIndex(length);
    } else if (trackIndex === length + 1) {
      setAnimate(false);
      setTrackIndex(1);
    }
  };

  return (
    <section id="moslashish" className="py-12 sm:py-20 lg:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto max-w-[1120px] px-4">
        {/* Mobil va planshet: faqat bitta blok, chap/o'ng tugmalar bilan almashadi */}
        <div className="lg:hidden">
          <div className="relative overflow-hidden" onTransitionEnd={handleTransitionEnd}>
            {/* Barcha slaydlar ichida eng balandiga moslab joy ajratish uchun ko'rinmas o'lchagich — shunda matn qisqa bo'lganda ham balandlik o'zgarmaydi va tugmalar siljimaydi */}
            <div aria-hidden="true" className="invisible grid">
              {slides.map((slide, i) => (
                <div key={i} className="[grid-area:1/1]">
                  <MobileSlide slide={slide} />
                </div>
              ))}
            </div>
            {track.map((slide, slot) => (
              <div
                key={slot}
                className={`absolute left-0 top-0 w-full ${animate ? "transition-transform duration-500 ease-in-out" : ""}`}
                style={{ transform: `translateX(${(slot - trackIndex) * 100}%)` }}
              >
                <MobileSlide slide={slide} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Oldingi"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{ background: "var(--color-green)" }}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-[13px] font-bold text-[var(--color-text-muted)]">
              {activeIndex + 1} / {length}
            </span>
            <button
              type="button"
              onClick={goNext}
              aria-label="Keyingi"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{ background: "var(--color-green)" }}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Kompyuter versiyasi: barcha bloklar bir vaqtda ko'rinadi */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-1 items-center gap-6 sm:gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal direction="left" className="overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-raised)] sm:rounded-[var(--radius-xl)]">
              <Image
                src={slides[0].image}
                alt={slides[0].alt}
                width={632}
                height={422}
                sizes="(min-width: 1024px) 520px, 100vw"
                className="h-auto w-full object-cover"
              />
            </Reveal>

            <Reveal direction="right" delay={120}>
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] sm:text-[13px]" style={{ color: "var(--color-green)" }}>
                {slides[0].eyebrow}
              </p>
              <h2 className="font-heading mt-2 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:mt-3 sm:text-[30px] lg:text-[36px]">
                {slides[0].title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-text-muted)] sm:mt-4 sm:text-[16px]">
                {slides[0].text}
              </p>
            </Reveal>
          </div>

          <div className="my-10 flex flex-col items-center text-center sm:my-16 lg:my-24">
            <Reveal direction="up" className="w-full max-w-[240px] overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-raised)] sm:max-w-[300px] sm:rounded-[var(--radius-xl)] lg:max-w-[360px]">
              <Image
                src={slides[1].image}
                alt={slides[1].alt}
                width={612}
                height={534}
                sizes="(min-width: 1024px) 360px, 60vw"
                className="h-auto w-full object-cover"
              />
            </Reveal>
            <Reveal direction="up" delay={150} className="mt-4 max-w-[520px] text-[15px] font-medium leading-relaxed text-[var(--color-text)] sm:mt-6 sm:text-[17px]">
              {slides[1].text}
            </Reveal>
          </div>

          <div className="grid grid-cols-1 items-center gap-6 sm:gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal direction="left" className="order-2 lg:order-1">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] sm:text-[13px]" style={{ color: "var(--color-green)" }}>
                {slides[2].eyebrow}
              </p>
              <h2 className="font-heading mt-2 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:mt-3 sm:text-[30px] lg:text-[36px]">
                {slides[2].title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-text-muted)] sm:mt-4 sm:text-[16px]">
                {slides[2].text}
              </p>
            </Reveal>

            <Reveal direction="right" delay={120} className="order-1 overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-raised)] sm:rounded-[var(--radius-xl)] lg:order-2">
              <Image
                src={slides[2].image}
                alt={slides[2].alt}
                width={612}
                height={323}
                sizes="(min-width: 1024px) 520px, 100vw"
                className="h-auto w-full object-cover"
              />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
