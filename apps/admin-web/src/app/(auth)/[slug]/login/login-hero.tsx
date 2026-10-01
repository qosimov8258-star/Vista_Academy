"use client";

import { useState } from "react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { initials } from "@/components/ui/avatar";
import { ChecklistIcon, MealIcon, PhoneIcon, WalletIcon } from "@/components/ui/icons";
import styles from "./login.module.css";
import { useTr } from "@/i18n/tr";

const FEATURES = [
  { key: "attendance", Icon: ChecklistIcon },
  { key: "finance", Icon: WalletIcon },
  { key: "kitchen", Icon: MealIcon },
  { key: "parents", Icon: PhoneIcon },
] as const;

/** Bog'cha belgisi va nomi. Nom yuklanayotganda — joy egallovchi. */
export function OrgBrand({ name, compact = false }: { name: string | null; compact?: boolean }) {
  const tr = useTr();
  if (name === null) {
    return (
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className={clsx("animate-pulse rounded-[14px] bg-white/[0.07]", compact ? "h-10 w-10" : "h-11 w-11")} />
        <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.07]" />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={clsx(
          styles.brandMark,
          "flex shrink-0 items-center justify-center rounded-[14px] font-extrabold tracking-tight",
          compact ? "h-10 w-10 text-[15px]" : "h-11 w-11 text-[16px]",
        )}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      <span className="truncate text-[17px] font-bold tracking-[-0.01em] text-white">{tr(name)}</span>
    </div>
  );
}

/**
 * Kirish sahifasining chap yarmi: tizim nima qilishi haqida qisqa va
 * aniq. Pastda imkoniyatlar kartasi o'zi almashib turadi (sichqoncha
 * ustida bo'lsa to'xtaydi), chiziqlarni bosib ham almashtirish mumkin.
 */
export function LoginHero({ orgName, online }: { orgName: string | null; online: boolean }) {
  const tr = useTr();
  const t = useTranslations("login.hero");
  const [active, setActive] = useState(0);
  const year = new Date().getFullYear();

  return (
    <section className={clsx(styles.hero, "relative hidden overflow-hidden lg:flex lg:flex-col")}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.orbit} aria-hidden="true">
        <div className={styles.orbitSpin}>
          <span className={styles.orbitDot} />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-20 xl:py-14">
        <div className={styles.rise}>
          <OrgBrand name={orgName} />
        </div>

        <div className="my-auto max-w-[640px] py-10 xl:py-12">
          {online && (
            <div
              className={clsx(
                styles.rise,
                "mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-[var(--accent-pale)]/80",
              )}
            >
              <span className={clsx(styles.liveDot, "h-2 w-2 rounded-full bg-[var(--accent-bright)]")} aria-hidden="true" />
              {t("status")}
            </div>
          )}

          <h2
            className={clsx(styles.rise, "text-[40px] font-extrabold leading-[1.06] tracking-[-0.035em] text-white xl:text-[48px] 2xl:text-[56px]")}
            style={{ animationDelay: "60ms" }}
          >
            {t("titleLine1")}
            <br />
            <span className={styles.accentText}>{t("titleLine2")}</span>
          </h2>
          <p
            className={clsx(styles.rise, "mt-5 max-w-[480px] text-[16px] leading-[1.65] text-[var(--accent-pale)]/60 xl:mt-6 xl:text-[17px]")}
            style={{ animationDelay: "120ms" }}
          >
            {t("subtitle")}
          </p>

          <div className={clsx(styles.rise, styles.carousel, "mt-10 max-w-[500px] xl:mt-12")} style={{ animationDelay: "180ms" }}>
            <div className="grid">
              {FEATURES.map(({ key, Icon }, i) => (
                <div
                  key={key}
                  aria-hidden={i !== active}
                  className={clsx(styles.slide, styles.feature, "flex gap-4 rounded-[20px] p-5", i !== active && styles.slideHidden)}
                >
                  <span className={clsx(styles.featureIcon, "flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]")}>
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[16px] font-bold text-white">{t(`features.${key}.title`)}</p>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--accent-pale)]/55">{t(`features.${key}.text`)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2" role="tablist" aria-label={t("featuresLabel")}>
              {FEATURES.map(({ key }, i) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={t(`features.${key}.title`)}
                  onClick={() => setActive(i)}
                  className={clsx(
                    "relative h-1 cursor-pointer overflow-hidden rounded-full bg-white/[0.1] transition-[width] duration-500",
                    i === active ? "w-12" : "w-6 hover:bg-white/[0.18]",
                  )}
                >
                  {i === active && (
                    <span
                      // key: har almashganda chiziq boshidan to'ladi
                      key={active}
                      className={clsx(styles.progress, "absolute inset-0 origin-left rounded-full bg-[var(--accent-bright)]")}
                      onAnimationEnd={() => setActive((a) => (a + 1) % FEATURES.length)}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-[var(--accent-pale)]/35">
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
