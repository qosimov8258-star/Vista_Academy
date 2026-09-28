import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { Adaptation } from "@/components/adaptation";
import { fetchLanding } from "@/lib/api";
import type { LandingScheduleItem, LandingScheduleType } from "@/lib/types";
import { Reveal } from "@/components/reveal";
import { alternatingDirection, staggerDelay } from "@/components/reveal-utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("schedulePage");
  return { title: t("metaTitle") };
}

const TYPE_COLORS: Record<LandingScheduleType, string> = {
  LESSON: "var(--color-blue)",
  SLEEP: "#9b6fd6",
  MEAL: "var(--color-green)",
  OTHER: "var(--color-yellow-dark)",
};

export default async function SchedulePage() {
  const items = await fetchLanding<LandingScheduleItem[]>("/schedule", []);
  const t = await getTranslations("schedulePage");
  const tCommon = await getTranslations("common");
  const tGroups = await getTranslations("groups");

  return (
    <PageShell
      eyebrow={tCommon("pagesEyebrow")}
      title={tGroups("schedule")}
      description={t("description")}
      heroImage={{ src: "/moslashish/moslashish5.jpeg", alt: t("heroImageAlt"), position: "50% 0%" }}
      afterContent={
        <Adaptation
          introImageSrc="/moslashish/rasm1.jpeg"
          introImageAlt={t("adaptationOverride.imageAlt")}
          introText={t("adaptationOverride.text")}
        />
      }
    >
      {items.length === 0 ? (
        <Reveal direction="up" className="mx-auto max-w-[720px] overflow-hidden rounded-[var(--radius-xl)]">
          <Image
            src="/rasm/moslashish-text.jpeg"
            alt={t("emptyImageAlt")}
            width={1408}
            height={768}
            sizes="(min-width: 768px) 720px, 100vw"
            className="h-auto w-full object-cover"
          />
        </Reveal>
      ) : (
        <ol className="mx-auto max-w-[560px] space-y-3">
          {items.map((item, index) => (
            <Reveal
              key={item.id}
              as="li"
              direction={alternatingDirection(index)}
              delay={staggerDelay(index, 70, 420)}
              className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-white px-5 py-4 shadow-[var(--shadow-card)]"
            >
              <span className="font-heading w-16 shrink-0 text-[18px] font-bold tabular-nums text-[var(--color-text)]">
                {item.time}
              </span>
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: TYPE_COLORS[item.type] }}
              />
              <span className="min-w-0 flex-1 text-[15px] text-[var(--color-text)]">{item.title}</span>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold"
                style={{ background: "var(--color-tint)", color: TYPE_COLORS[item.type] }}
              >
                {t(`types.${item.type}`)}
              </span>
            </Reveal>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
