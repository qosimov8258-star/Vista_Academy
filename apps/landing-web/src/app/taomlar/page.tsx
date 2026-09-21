import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { BabyBottleAnimation } from "@/components/baby-bottle-animation";
import { MealsIntro } from "@/components/meals-intro";
import { WeeklyMenu } from "@/components/weekly-menu";
import { fetchLanding } from "@/lib/api";
import type { LandingMeal } from "@/lib/types";

export const metadata: Metadata = {
  title: "Sog'lom taomlar — Vista Academy",
};

export default async function MealsPage() {
  const meals = await fetchLanding<LandingMeal[]>("/meals", []);

  return (
    <PageShell
      eyebrow="Guruhlarimiz"
      title="Sog'lom taomlar"
      description="Kun davomida muvozanatli va sifatli ovqatlanish — dastur doirasida qo'shimcha to'lovsiz taqdim etiladi."
      heroImage={{ src: "/rasm/soglom-taom.png", alt: "Bolalar oshxonada sog'lom taom yemoqda", position: "50% 0%" }}
      belowHero={
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center">
          <div className="max-w-[300px] text-center sm:text-left">
            <p className="font-heading text-[22px] font-bold leading-snug text-[var(--color-text)] sm:text-[26px]">
              Shirintoyingizning qornini to&apos;ydiring!
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
              Kichkintoyingiz bilan birga quyidagi qiziqarli o&apos;yinni sinab ko&apos;ring.
            </p>
          </div>
          <BabyBottleAnimation />
        </div>
      }
    >
      <div className="mb-16 sm:mb-20">
        <MealsIntro />
      </div>

      {meals.length > 0 ? (
        <WeeklyMenu meals={meals} />
      ) : (
        <p className="py-10 text-center text-[15px] text-[var(--color-text-muted)]">
          Hozircha menyu kiritilmagan.
        </p>
      )}
    </PageShell>
  );
}
