"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Reveal } from "./reveal";

function useReviews() {
  const t = useTranslations("testimonials.reviews");
  return [
    { name: "Dilnoza Ergasheva", role: t("review1.role"), text: t("review1.text") },
    { name: "Bekzod Qodirov", role: t("review2.role"), text: t("review2.text") },
    { name: "Nilufar Saidova", role: t("review3.role"), text: t("review3.text") },
    { name: "Jasur Toshpulatov", role: t("review4.role"), text: t("review4.text") },
    { name: "Madina Rahimova", role: t("review5.role"), text: t("review5.text") },
  ];
}

function ReviewCard({ review }: { review: ReturnType<typeof useReviews>[number] }) {
  return (
    <div className="w-[300px] shrink-0 rounded-[var(--radius-lg)] bg-white px-6 py-6 text-left shadow-[var(--shadow-card)]">
      <p className="text-[15px] leading-relaxed text-[var(--color-text)]">&ldquo;{review.text}&rdquo;</p>
      <p className="font-heading mt-4 text-[14px] font-bold text-[var(--color-text)]">{review.name}</p>
      <p className="text-[13px] text-[var(--color-text-muted)]">{review.role}</p>
    </div>
  );
}

export function Testimonials() {
  const t = useTranslations("testimonials");
  const REVIEWS = useReviews();

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-[560px] px-4 text-center">
        <Reveal direction="up" className="relative mx-auto h-[180px] w-full max-w-[560px] sm:h-[220px]">
          <Image src="/bezak/bezak.jpg" alt={t("imageAlt")} fill sizes="560px" className="object-contain" />
        </Reveal>

        <Reveal direction="up" delay={120} className="mt-6 text-[16px] italic leading-relaxed text-[var(--color-text-muted)]">
          {t("quoteLine1")}
          <br />
          {t("quoteLine2")}
        </Reveal>
      </div>

      <Reveal direction="up" delay={150} className="marqueeWrap mx-auto mt-10 max-w-[1120px]">
        <div className="marqueeTrack">
          {REVIEWS.map((review) => (
            <ReviewCard key={`a-${review.name}`} review={review} />
          ))}
          {REVIEWS.map((review) => (
            <ReviewCard key={`b-${review.name}`} review={review} />
          ))}
        </div>
      </Reveal>

      <Reveal direction="up" delay={180} className="mx-auto mt-20 max-w-[560px] px-4 text-center">
        <div className="relative mx-auto h-[240px] w-full max-w-[420px] overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] sm:h-[280px]">
          <Image src="/team.jpeg" alt={t("teamImageAlt")} fill sizes="420px" className="object-cover" />
        </div>
        <p className="font-heading mt-5 text-[18px] font-bold text-[var(--color-text)]">{t("teamHeading")}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">{t("teamBody")}</p>
      </Reveal>
    </section>
  );
}
