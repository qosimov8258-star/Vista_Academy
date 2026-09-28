import { getTranslations } from "next-intl/server";
import { fetchLanding } from "@/lib/api";
import { cdn } from "@/lib/cdn";
import type { LandingContentBlock } from "@/lib/types";
import { Reveal } from "./reveal";
import { VideoCompareSlider } from "./video-compare-slider";
import { SingleVideoCard } from "./single-video-card";

/**
 * Har bir blok — o'qituvchining yumaloq surati + sarlavha + matn. CMS'da
 * ("Lending sahifa" → "O'qituvchilar", bog'cha panelidan) hali kiritilmagan
 * bo'lsa, shu joyga o'rnatilgan namunaviy matn ko'rsatiladi.
 */
const HIGHLIGHT_KEYS = ["maxsus-oqituvchi-1", "maxsus-oqituvchi-2"] as const;

const FALLBACK_KEY: Record<(typeof HIGHLIGHT_KEYS)[number], "english" | "mentalMath"> = {
  "maxsus-oqituvchi-1": "english",
  "maxsus-oqituvchi-2": "mentalMath",
};

export async function TeacherSubjectHighlights() {
  const t = await getTranslations("teacherSubjects");
  const blocks = await Promise.all(
    HIGHLIGHT_KEYS.map((key) => fetchLanding<LandingContentBlock | null>(`/content-blocks/${key}`, null)),
  );

  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 px-4 sm:gap-20">
        {HIGHLIGHT_KEYS.map((key, index) => {
          const block = blocks[index];
          const fallbackKey = FALLBACK_KEY[key];
          const title = block?.title ?? t(`${fallbackKey}.title`);
          const body = block?.body ?? t(`${fallbackKey}.body`);
          const imageFirst = index % 2 === 1;

          return (
            <div key={key} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal
                direction={imageFirst ? "right" : "left"}
                className={imageFirst ? "order-2 text-center lg:text-left" : "order-2 text-center lg:order-1 lg:text-left"}
              >
                <h2 className="font-heading text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
                  {title}
                </h2>
                <p className="mt-4 whitespace-pre-line text-[16px] leading-relaxed text-[var(--color-text-muted)]">{body}</p>
              </Reveal>

              <Reveal direction={imageFirst ? "left" : "right"} delay={120} className={imageFirst ? "order-1" : "order-1 lg:order-2"}>
                {key === "maxsus-oqituvchi-1" ? (
                  <VideoCompareSlider
                    videoFront={cdn("/video/oqtuvchilar/video1.mp4")}
                    videoBack={cdn("/video/oqtuvchilar/video2.mp4")}
                  />
                ) : (
                  <SingleVideoCard src={cdn("/rus.mp4")} />
                )}
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
