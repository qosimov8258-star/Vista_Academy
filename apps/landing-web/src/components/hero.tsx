"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { MinionPlayground } from "./minion-playground";
import { useReveal } from "./reveal";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function HeroBadge() {
  const t = useTranslations("hero");
  return (
    <>
      <span className="inline-flex items-center rounded-full border border-white/50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-white lg:hidden">
        {t("badgeMobile")}
      </span>
      <span className="hidden items-center rounded-full border border-white/50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-white lg:inline-flex">
        {t("badgeDesktop")}
      </span>
    </>
  );
}

function HeroHeading() {
  const t = useTranslations("hero");
  return (
    <h1 className="font-heading mt-4 text-[26px] font-bold leading-[1.15] tracking-tight text-white sm:mt-5 sm:text-[34px] lg:text-[46px]">
      {t("headingPrefix")}{" "}
      <span style={{ color: "var(--color-green)" }}>{t("headingHighlight")}</span> {t("headingSuffix")}
    </h1>
  );
}

function HeroParagraph() {
  const t = useTranslations("hero");
  return (
    <p className="mt-4 max-w-[460px] text-[15px] leading-relaxed text-white/90 sm:mt-5 sm:text-[16px] lg:text-[17px]">
      {t("paragraph")}
    </p>
  );
}

function HeroActions() {
  const t = useTranslations();
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8 sm:gap-4">
      <a
        href="/ariza"
        className="flex items-center gap-1.5 rounded-full px-6 py-3 text-[15px] font-bold text-white shadow-[var(--shadow-cta)] transition-transform duration-150 hover:scale-[1.03] sm:px-7 sm:py-3.5 sm:text-[16px]"
        style={{ background: "linear-gradient(135deg, var(--color-green) 0%, var(--color-green-dark) 100%)" }}
      >
        {t("common.cta")}
        <ArrowIcon className="h-4 w-4" />
      </a>
      <a
        href="#about"
        className="rounded-full border border-white/60 px-6 py-3 text-[15px] font-bold text-white transition-colors hover:bg-white/10 sm:px-7 sm:py-3.5 sm:text-[16px]"
      >
        {t("hero.ctaSecondary")}
      </a>
    </div>
  );
}

export function Hero() {
  const image = useReveal<HTMLDivElement>(0);
  const text = useReveal<HTMLDivElement>(150);

  return (
    <section id="top" className="relative bg-white pb-4 sm:pb-6">
      <div className="relative w-full">
        <div
          ref={image.ref}
          className={`reveal reveal-right ${image.visible ? "reveal-visible" : ""}`}
          style={image.style}
        >
          <Image
            src="/rasm/moslashish.jpeg"
            alt="Vista Academy bolalari"
            width={4096}
            height={1903}
            priority
            sizes="100vw"
            className="h-[400px] w-full object-cover object-[68%] sm:h-[460px] md:h-[520px] lg:h-auto"
          />
        </div>

        {/* Matn o'qilishi uchun qora gradient — faqat mobil/tabletda, rasm ustida matn shu tufayli o'qiladi.
            Pastda rasmning o'ziga chizilgan oq to'lqin bor — gradient shu yerda tugab, to'lqin
            tiniq ko'rinishi uchun pastga tomon shaffoflikka o'tadi (aks holda to'lqin qоra parda
            tagida "uzilib qolgandek" ko'rinardi). */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/5 lg:hidden"
          style={{
            maskImage: "linear-gradient(to bottom, black 0%, black 68%, transparent 84%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 68%, transparent 84%)",
          }}
        />

        {/* Matn rasmning chap tomonida — bolalar yuzi to'sib qolmasin */}
        <div className="pointer-events-none absolute inset-0 flex items-center">
          <div className="pointer-events-auto mx-auto w-full max-w-[1280px] px-6 lg:px-8">
            <div
              ref={text.ref}
              className={`reveal reveal-left max-w-[260px] sm:max-w-[380px] lg:max-w-[440px] ${text.visible ? "reveal-visible" : ""}`}
              style={text.style}
            >
              <HeroBadge />
              <HeroHeading />
              <HeroParagraph />
              <HeroActions />
            </div>
          </div>
        </div>
      </div>

      {/* To'lqin ostidagi bo'sh joyda minionlar o'ynaydi */}
      <MinionPlayground />
    </section>
  );
}
