import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { CradleFeedingAnimation } from "@/components/cradle-feeding-animation";
import { MealsIntro } from "@/components/meals-intro";
import { WeeklyMenu } from "@/components/weekly-menu";
import { fetchLanding } from "@/lib/api";
import { cdn } from "@/lib/cdn";
import type { LandingMeal } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mealsPage");
  return { title: t("metaTitle") };
}

export default async function MealsPage() {
  const meals = await fetchLanding<LandingMeal[]>("/meals", []);
  const t = await getTranslations("mealsPage");
  const tCommon = await getTranslations("common");
  const tGroups = await getTranslations("groups");
  const tWhyUs = await getTranslations("whyUs");

  return (
    <PageShell
      eyebrow={tCommon("pagesEyebrow")}
      title={tGroups("meals")}
      description={tWhyUs("features.meals")}
      heroImage={{
        src: cdn("/taom/taom.jpeg"),
        alt: t("heroImageAlt"),
        background: "var(--color-tint-cream)",
      }}
      belowHero={
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center">
          <div className="max-w-[300px] text-center sm:text-left">
            <p className="font-heading text-[22px] font-bold leading-snug text-[var(--color-text)] sm:text-[26px]">
              {t("belowHeroTitle")}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-muted)]">{t("belowHeroBody")}</p>
          </div>
          <CradleFeedingAnimation />
        </div>
      }
    >
      <div className="mb-16 sm:mb-20">
        <MealsIntro />
      </div>

      {meals.length > 0 ? (
        <WeeklyMenu meals={meals} />
      ) : (
        <p className="py-10 text-center text-[15px] text-[var(--color-text-muted)]">{t("emptyMenu")}</p>
      )}
    </PageShell>
  );
}
