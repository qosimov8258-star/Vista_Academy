"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { cdn } from "@/lib/cdn";
import { Reveal } from "./reveal";

export function EducationHighlights() {
  const t = useTranslations("education");
  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 px-4 sm:gap-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal
            direction="left"
            className="aspect-[16/9] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]"
          >
            <Image
              src={cdn("/talim/talim.jpeg")}
              alt={t("block1.imageAlt")}
              width={600}
              height={338}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-full w-full object-cover object-top"
            />
          </Reveal>

          <Reveal direction="right" delay={120} className="text-center lg:text-left">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
              {t("block1.eyebrow")}
            </p>
            <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
              {t("block1.title")}
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">{t("block1.body")}</p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal direction="left" className="order-2 text-center lg:order-1 lg:text-left">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
              {t("block2.eyebrow")}
            </p>
            <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
              {t("block2.title")}
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">{t("block2.body")}</p>
          </Reveal>

          <Reveal
            direction="right"
            delay={120}
            className="order-1 aspect-[3/2] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] lg:order-2"
          >
            <Image
              src={cdn("/talim/talim2.jpeg")}
              alt={t("block2.imageAlt")}
              width={600}
              height={400}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-full w-full object-cover object-top"
            />
          </Reveal>
        </div>

        <div>
          <Reveal
            direction="up"
            className="mx-auto aspect-[3/2] w-full max-w-[600px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]"
          >
            <Image
              src={cdn("/talim/talim4.jpg")}
              alt={t("block3.imageAlt")}
              width={600}
              height={400}
              sizes="(min-width: 640px) 600px, 90vw"
              className="h-full w-full object-cover object-top"
            />
          </Reveal>

          <Reveal direction="up" delay={150} className="mx-auto mt-8 max-w-[640px] text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
              {t("block3.eyebrow")}
            </p>
            <p className="font-heading mt-3 text-[22px] font-bold leading-snug tracking-tight text-[var(--color-text)] sm:text-[26px]">
              {t("block3.quote")}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
