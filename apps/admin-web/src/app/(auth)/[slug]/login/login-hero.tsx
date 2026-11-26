"use client";

import { useId } from "react";
import clsx from "clsx";
import { OrgLogo } from "@/features/organization/org-logo";
import { useTranslations } from "next-intl";
import { initials } from "@/components/ui/avatar";
import styles from "./login.module.css";
import { useTr } from "@/i18n/tr";

/** Suzib yuruvchi aurora foni — Zeeron ranglarining och tuslari */
function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className={styles.swirl}>
        <span className={clsx(styles.blob, styles.blob1)} />
        <span className={clsx(styles.blob, styles.blob2)} />
        <span className={clsx(styles.blob, styles.blob3)} />
        <span className={clsx(styles.blob, styles.blob4)} />
      </span>
      <span className={styles.veil} />
      <span className={styles.grain} />
      {/* Qishda: pastda qor uyumi (boshqa paytda ko'rinmaydi) */}
      <span className="winter-login-ground" />
    </div>
  );
}

/**
 * Qor bobo qalpoqchasi — qishda «Z» belgisiga qiyshaytirib kiyiladi va sekin
 * chayqaladi (winter.css: `.winter-santa-hat`). Qishdan tashqari ko'rinmaydi.
 */
function SantaHat() {
  // Belgi sahifada ikki joyda (telefon / kompyuter) — gradient ID'lari takrorlanmasin,
  // aks holda yashirin nusxadagi ID topilib, qalpoq rangsiz chiqadi
  const id = useId().replace(/:/g, "");
  const red = `santaHatRed${id}`;
  const fur = `santaHatFur${id}`;
  const pom = `santaHatPom${id}`;
  return (
    <span className="winter-santa-hat" aria-hidden="true">
      <svg viewBox="0 0 80 64" width="100%" height="100%">
        <defs>
          <linearGradient id={red} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#ff5a4f" />
            <stop offset="0.5" stopColor="#e0322c" />
            <stop offset="1" stopColor="#a61b1d" />
          </linearGradient>
          <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dfe7f2" />
          </linearGradient>
          <radialGradient id={pom} cx="0.38" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d9e2ef" />
          </radialGradient>
        </defs>
        {/* Qalpoq: tepasi yumshoq egilib, o'ng tomonga osilib tushgan */}
        <path d="M11 50C13 29 25 11 41 8C57 5 69 15 72 31C66 25 59 25 55 31C53 39 58 45 66 50Z" fill={`url(#${red})`} />
        {/* Burma soyasi va yorug' chiziq — matodek ko'rinsin */}
        <path d="M55 31C53 39 58 45 66 50L59 50C51 45 49 37 55 31Z" fill="#6e0d10" fillOpacity="0.28" />
        <path d="M19 44C21 30 29 18 41 13" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2.4" strokeLinecap="round" />
        {/* Mo'yna halqa: chetlari yumaloq, ustida mayda tuklar */}
        <rect x="5" y="45" width="68" height="15" rx="7.5" fill={`url(#${fur})`} />
        <path
          d="M8 47C10 44 14 44 16 46C18 43 23 43 25 46C27 43 32 43 34 46C36 43 41 43 43 46C45 43 50 43 52 46C54 43 59 43 61 46C63 43 68 43 70 47"
          fill="#ffffff"
        />
        <rect x="5" y="45" width="68" height="15" rx="7.5" fill="none" stroke="#c9d4e4" strokeWidth="1" />
        {/* Popuk */}
        <circle cx="72" cy="33" r="7.5" fill={`url(#${pom})`} stroke="#c9d4e4" strokeWidth="1" />
        <circle cx="69.5" cy="30.5" r="2.2" fill="#ffffff" />
      </svg>
    </span>
  );
}

/** Zeeron belgisi (Z) va yozuvi */
function ZeeronLogo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div className="flex flex-col items-center">
      {/* winter-login-logo — qishda belgiga Qor bobo qalpoqchasi kiyiladi (boshqa paytda ko'rinmaydi) */}
      <span className="winter-login-logo inline-flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/zeeron-icon.png"
          alt=""
          width={256}
          height={256}
          className={clsx("shadow-[0_18px_40px_-14px_rgba(12,12,12,0.45)]", lg ? "h-[76px] w-[76px] rounded-[22px]" : "h-12 w-12 rounded-[14px]")}
        />
        <SantaHat />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/zeeron-wordmark.png" alt="Zeeron" width={960} height={120} className={clsx("w-auto", lg ? "mt-7 h-9 xl:h-10" : "mt-4 h-6")} />
    </div>
  );
}

/** Bog'cha belgisi (bosh harflar) va nomi — formaning tepasida */
export function OrgMark({ name, slug, logoUpdatedAt }: { name: string | null; slug?: string; logoUpdatedAt?: string | null }) {
  const tr = useTr();
  if (name === null) {
    return (
      <div className="flex flex-col items-center gap-3.5" aria-hidden="true">
        <div className="h-[68px] w-[68px] animate-pulse rounded-full bg-[#767680]/[0.12]" />
        <div className="h-6 w-28 animate-pulse rounded-full bg-[#767680]/[0.12]" />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-center gap-3.5">
      <span className={clsx(styles.ring, "h-[68px] w-[68px] shrink-0")} aria-hidden="true">
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white text-[20px] font-semibold tracking-tight text-[#0c0c0c]">
          {slug ? <OrgLogo slug={slug} updatedAt={logoUpdatedAt} className="h-[74%] w-[74%]" fallback={initials(name)} /> : initials(name)}
        </span>
      </span>
      <span className="max-w-full truncate rounded-full bg-[#f6f6f7] px-3.5 py-1 text-[13px] font-medium text-[#3c3c43]">{tr(name)}</span>
    </div>
  );
}

/**
 * Kirish sahifasining chap yarmi (katta ekranda): aurora ustida Zeeron
 * logosi va qisqa shior. Telefonda uning o'rniga tepada kichik aurora
 * tasmasi (`LoginHeroCompact`).
 */
export function LoginHero({ orgName }: { orgName: string | null }) {
  const tr = useTr();
  const t = useTranslations("login.hero");
  const year = new Date().getFullYear();

  return (
    <section className={clsx(styles.aurora, "winter-login-sky relative m-3 hidden overflow-hidden rounded-[28px] lg:flex lg:flex-col")}>
      <Aurora />

      <div className="relative flex flex-1 flex-col px-10 pb-9 pt-[68px] xl:px-14 xl:pb-11 xl:pt-[80px]">
        <div className="my-auto flex flex-col items-center py-10 text-center">
          <div className={styles.rise}>
            <ZeeronLogo />
          </div>
          <p
            className={clsx(styles.rise, "mt-8 max-w-[480px] text-[22px] font-semibold leading-[1.3] tracking-[-0.02em] text-[#0c0c0c] xl:text-[24px]")}
            style={{ animationDelay: "80ms" }}
          >
            {t("titleLine1")} {t("titleLine2")}
          </p>
          <p className={clsx(styles.rise, "mt-3 max-w-[440px] text-[15px] leading-[1.6] text-[#3c3c43]/70")} style={{ animationDelay: "140ms" }}>
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-[12.5px] text-[#3c3c43]/60">
          <span>
            © {tr(year)} {orgName ?? ""}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t("rights")}</span>
        </div>
      </div>
    </section>
  );
}

/** Telefonda: aurora butun ekran foni bo'ladi, tepada Zeeron logosi */
export function LoginHeroCompact() {
  return (
    <>
      {/* winter-login-sky — qishda fon ayozli tong ranglarida (winter.css) */}
      <div className={clsx(styles.aurora, "winter-login-sky fixed inset-0 lg:hidden")} aria-hidden="true">
        <Aurora />
      </div>
      <div className="relative flex flex-col items-center px-6 pb-1 pt-9 lg:hidden">
        <ZeeronLogo size="sm" />
      </div>
    </>
  );
}
