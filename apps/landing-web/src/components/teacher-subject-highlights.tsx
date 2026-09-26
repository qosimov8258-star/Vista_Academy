import Image from "next/image";
import { fetchLanding, assetUrl } from "@/lib/api";
import type { LandingContentBlock } from "@/lib/types";
import { Reveal } from "./reveal";
import { VideoCompareSlider } from "./video-compare-slider";

/**
 * Ushbu ikki fanning o'ziga xos o'qituvchisi hali suratga tushmagan —
 * shuning uchun rasm o'rnida mavzuga mos icon ko'rsatiladi. Chin surat
 * qo'shilganda shu joyga <Image src="..." /> qo'yiladi.
 */
function AbacusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <rect x="8" y="10" width="80" height="76" rx="12" fill="none" stroke="#a8794f" strokeWidth="5" />
      <line x1="16" y1="30" x2="80" y2="30" stroke="#a8794f" strokeWidth="3" />
      <line x1="16" y1="48" x2="80" y2="48" stroke="#a8794f" strokeWidth="3" />
      <line x1="16" y1="66" x2="80" y2="66" stroke="#a8794f" strokeWidth="3" />
      <circle cx="30" cy="30" r="7" fill="var(--color-blue)" />
      <circle cx="48" cy="30" r="7" fill="var(--color-blue)" />
      <circle cx="66" cy="30" r="7" fill="var(--color-blue)" />
      <circle cx="24" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="42" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="60" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="78" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="36" cy="66" r="7" fill="var(--color-yellow)" />
      <circle cx="54" cy="66" r="7" fill="var(--color-yellow)" />
      <circle cx="72" cy="66" r="7" fill="var(--color-yellow)" />
    </svg>
  );
}

function PlaceholderFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto flex aspect-[3/4] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]"
      style={{ background: "var(--color-tint)" }}
    >
      {children}
    </div>
  );
}

/**
 * Har bir blok — o'qituvchining yumaloq surati + sarlavha + matn. CMS'da
 * ("Lending sahifa" → "O'qituvchilar", bog'cha panelidan) hali kiritilmagan
 * bo'lsa, shu joyga o'rnatilgan namunaviy matn va icon ko'rsatiladi.
 */
const HIGHLIGHT_KEYS = ["maxsus-oqituvchi-1", "maxsus-oqituvchi-2"] as const;

const FALLBACKS: Record<(typeof HIGHLIGHT_KEYS)[number], { title: string; body: string; icon: "book" | "abacus" }> = {
  "maxsus-oqituvchi-1": {
    title: "Ingliz tili o'qituvchisi",
    body: "Ingliz tili o'qituvchimiz bolalarga tilni yodlash orqali emas, qo'shiq, she'r va rolli o'yinlar orqali singdiradi. Har bir dars quvnoq muhitda o'tadi — bolalar yangi so'zlarni to'g'ri talaffuz bilan, qo'rquvsiz gapirishni o'rganadi. Bu yondashuv keyinchalik maktabda til o'rganishni ancha osonlashtiradi.",
    icon: "book",
  },
  "maxsus-oqituvchi-2": {
    title: "Mental arifmetika o'qituvchisi",
    body: "Mental arifmetika o'qituvchimiz bolalarga avval abakus (hisoblash taxtachasi) yordamida sonlar bilan ishlashni, so'ng ularni faqat tasavvur orqali hisoblashga o'rgatadi. Bu mashg'ulotlar diqqatni jamlash, xotira va tez fikrlash qobiliyatini rivojlantiradi — bola nafaqat matematikada, balki boshqa fanlarda ham yutuqqa erishadi.",
    icon: "abacus",
  },
};

export async function TeacherSubjectHighlights() {
  const blocks = await Promise.all(
    HIGHLIGHT_KEYS.map((key) => fetchLanding<LandingContentBlock | null>(`/content-blocks/${key}`, null)),
  );

  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 px-4 sm:gap-20">
        {HIGHLIGHT_KEYS.map((key, index) => {
          const block = blocks[index];
          const fallback = FALLBACKS[key];
          const title = block?.title ?? fallback.title;
          const body = block?.body ?? fallback.body;
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
                  <VideoCompareSlider videoFront="/video/oqtuvchilar/video1.mp4" videoBack="/video/oqtuvchilar/video2.mp4" />
                ) : (
                  <PlaceholderFrame>
                    {block?.photoPath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                      <img src={assetUrl(block.photoPath) ?? undefined} alt={title} className="h-full w-full object-cover" />
                    ) : fallback.icon === "book" ? (
                      <Image src="/icon/book.png" alt="" width={120} height={120} className="h-auto w-[32%] max-w-[130px] opacity-90" />
                    ) : (
                      <AbacusIcon className="h-auto w-[34%] max-w-[130px] opacity-90" />
                    )}
                  </PlaceholderFrame>
                )}
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
