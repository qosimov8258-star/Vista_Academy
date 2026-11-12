"use client";

import clsx from "clsx";
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
    </div>
  );
}

/** Zeeron belgisi (Z) va yozuvi */
function ZeeronLogo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div className="flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/zeeron-icon.png"
        alt=""
        width={256}
        height={256}
        className={clsx("shadow-[0_18px_40px_-14px_rgba(12,12,12,0.45)]", lg ? "h-[76px] w-[76px] rounded-[22px]" : "h-12 w-12 rounded-[14px]")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/zeeron-wordmark.png" alt="Zeeron" width={960} height={120} className={clsx("w-auto", lg ? "mt-7 h-9 xl:h-10" : "mt-4 h-6")} />
    </div>
  );
}

/** Bog'cha belgisi (bosh harflar) va nomi — formaning tepasida */
export function OrgMark({ name }: { name: string | null }) {
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
        <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-[20px] font-semibold tracking-tight text-[#0c0c0c]">
          {initials(name)}
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
    <section className={clsx(styles.aurora, "relative m-3 hidden overflow-hidden rounded-[28px] lg:flex lg:flex-col")}>
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
      <div className={clsx(styles.aurora, "fixed inset-0 lg:hidden")} aria-hidden="true">
        <Aurora />
      </div>
      <div className="relative flex flex-col items-center px-6 pb-1 pt-9 lg:hidden">
        <ZeeronLogo size="sm" />
      </div>
    </>
  );
}
