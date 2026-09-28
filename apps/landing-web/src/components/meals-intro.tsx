"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { cdn } from "@/lib/cdn";
import { Reveal } from "./reveal";

export function MealsIntro() {
  const t = useTranslations("mealsIntro");
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal direction="left" className="order-2 text-center lg:order-1 lg:text-left">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
          {t("eyebrow")}
        </p>
        <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
          {t("heading")}
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">{t("body1")}</p>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">{t("body2")}</p>
      </Reveal>

      <Reveal direction="right" delay={120} className="order-1 overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] lg:order-2">
        <Image
          src={cdn("/taom/home.jpeg")}
          alt={t("imageAlt")}
          width={1280}
          height={720}
          sizes="(min-width: 1024px) 520px, 100vw"
          className="h-auto w-full object-cover"
        />
      </Reveal>
    </div>
  );
}
