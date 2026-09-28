import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { fetchLanding } from "@/lib/api";
import { cdn } from "@/lib/cdn";
import { PLACEHOLDER_GROUPS, getGroupBySlug, toDisplayGroups } from "@/lib/groups";
import type { LandingGroup } from "@/lib/types";
import { Reveal } from "@/components/reveal";
import { alternatingDirection, staggerDelay } from "@/components/reveal-utils";

async function loadGroups() {
  const fetched = await fetchLanding<LandingGroup[]>("/groups", []);
  return fetched.length > 0 ? toDisplayGroups(fetched) : PLACEHOLDER_GROUPS;
}

/**
 * Ba'zi placeholder guruhlar uchun oldindan tayyorlangan qo'shimcha rasmlar
 * (`public/guruh/<slug>/...`) — avval bu papka request vaqtida fayl tizimidan
 * skanerlanardi, lekin fayllar R2'ga ko'chgani uchun endi qo'lda ro'yxatga
 * olingan (R2'da papka ro'yxatini o'qib bo'lmaydi).
 */
const GROUP_INTRO_IMAGES: Record<string, string> = {
  akademiklar: "/guruh/akademiklar/talim1.jpeg",
  kichkintoylar: "/guruh/kichkintoylar/baby1.jpeg",
  quyoshcha: "/guruh/quyoshcha/quyosh1.jpeg",
  "vinni-pux": "/guruh/vinni-pux/vinni1.jpeg",
};

/**
 * Sahifa oxiridagi "Farzandingiz shu yerda o'sadi va rivojlanadi" bo'limidagi
 * rasm uchun zaxira (fallback) — admin panelda "Guruh sahifasidagi rasmlar"dan
 * hali rasm qo'shilmagan guruhlar uchun ishlatiladi.
 */
const GROUP_CLOSING_IMAGES: Record<string, string> = {
  akademiklar: "/guruh/akademiklar/talim3.jpeg",
};

function findGroupIntroImage(slug: string): string | null {
  const image = GROUP_INTRO_IMAGES[slug];
  return image ? cdn(image) : null;
}

function findGroupClosingImage(slug: string): string | null {
  const image = GROUP_CLOSING_IMAGES[slug];
  return image ? cdn(image) : null;
}

function PhotoPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="9" width="38" height="30" rx="6" />
      <circle cx="17" cy="19" r="4" />
      <path d="M5 33l11-11 9 9 6-6 12 12" />
    </svg>
  );
}

/** Guruh sahifasida bir vaqtda ko'rsatiladigan o'quvchi joylari soni. */
const STUDENT_SLOT_COUNT = 4;

/**
 * Ba'zi guruhlar uchun shu sahifaning boshidagi katta (hero) rasmga maxsus statik
 * fayl belgilangan — bu admin paneldagi "asosiy rasm"dan (bosh sahifa va boshqa
 * kartochkalarda ham ishlatiladigan `group.photo`) ATAYLAB mustaqil: faqat shu
 * guruh sahifasi ochilganda ko'rinadigan katta rasmga tegishli, boshqa joylarga
 * (kartochkalarga) ta'sir qilmaydi.
 */
const HERO_IMAGE_OVERRIDES: Record<string, string> = {
  minionlar: cdn("/guruh/minion/minion1.jpeg"),
  akademiklar: cdn("/guruh/akademiklar/talim4.jpeg"),
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const group = getGroupBySlug(await loadGroups(), slug);
  const t = await getTranslations("groupPage");
  return { title: group ? `${group.name} — Vista Academy` : t("metaTitleFallback") };
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getGroupBySlug(await loadGroups(), slug);
  if (!group) notFound();
  const introImage = findGroupIntroImage(group.slug);
  const closingImage = group.photos[0] ?? findGroupClosingImage(group.slug) ?? group.photo;
  const heroImageSrc = HERO_IMAGE_OVERRIDES[group.slug] ?? group.photo;
  const t = await getTranslations("groupPage");
  const tCommon = await getTranslations("common");
  const groupLabel = `${group.name} ${t("groupSuffix")}`;

  return (
    <PageShell
      eyebrow={tCommon("pagesEyebrow")}
      title={group.name}
      description={t("description")}
      heroImage={
        heroImageSrc
          ? { src: heroImageSrc, alt: groupLabel, position: "50% 50%" }
          : {
              alt: groupLabel,
              background: group.color,
              placeholder: (
                <div className="flex flex-col items-center gap-3 text-white/80">
                  <PhotoPlaceholderIcon className="h-16 w-16" />
                  <span className="text-[13px] font-bold">{t("photoComingSoon")}</span>
                </div>
              ),
            }
      }
    >
      {introImage && (
        <>
          <Reveal direction="up" className="mx-auto max-w-[520px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- guruh papkasidan dinamik topilgan rasm, o'lchamlari oldindan noma'lum */}
            <img src={introImage} alt={t("introImageAlt")} className="h-auto w-full object-contain" />
          </Reveal>

          <Reveal direction="up" delay={120} className="mx-auto mt-6 max-w-[640px] text-center">
            <p className="font-heading text-[20px] font-bold leading-snug tracking-tight text-[var(--color-text)] sm:text-[24px]">
              {t("introQuoteLine1")}
              <br />
              {t("introQuoteLine2")}
            </p>
          </Reveal>
        </>
      )}

      <div
        className="mx-auto mt-12 max-w-[1120px] rounded-[var(--radius-xl)] px-4 py-10 sm:px-8 sm:py-12"
        style={{ background: "var(--color-tint-green)" }}
      >
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {Array.from({ length: STUDENT_SLOT_COUNT }, (_, index) => {
            const student = group.students[index];
            // O'zining rasmi bo'lmagan o'quvchi uchun guruhning bosh rasmi ko'rsatiladi (butunlay bo'sh joyларда emas).
            const displayPhoto = student ? (student.photo ?? group.photo) : undefined;
            return (
              <Reveal key={index} direction={alternatingDirection(index)} delay={staggerDelay(index, 90, 360)} className="text-center">
                <div
                  className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-card)]"
                  style={{ background: "var(--color-tint)" }}
                >
                  {displayPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                    <img src={displayPhoto} alt={student?.name ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Image
                        src={cdn("/icon/teacher.png")}
                        alt=""
                        width={96}
                        height={96}
                        className="h-auto w-[45%] max-w-[100px] opacity-80"
                      />
                    </div>
                  )}
                </div>
                <p className="font-student-name mt-4 text-[18px] text-[var(--color-text)]">
                  {student?.name ?? t("studentFallbackName", { index: index + 1 })}
                </p>
                <p className="font-student-caption mx-auto mt-2 max-w-[200px] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
                  {student?.bio ?? t("studentFallbackBio")}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal direction="left" className="order-2 lg:order-1">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
            {groupLabel}
          </p>
          <h2 className="font-heading mt-3 text-[26px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px]">
            {t("sectionHeading")}
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
            {t("sectionBody", { name: group.name })}
          </p>
        </Reveal>

        <Reveal
          direction="right"
          delay={120}
          className="order-1 aspect-square w-full overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] lg:order-2"
          style={{ background: group.color }}
        >
          {closingImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- guruh uchun statik yoki API'dan kelgan dinamik rasm; kvadrat qutiga (aspect-square) markazdan moslab kesiladi, shuning uchun rasm o'lchami yoki nisbatidan qat'i nazar bir xil chiqadi
            <img src={closingImage} alt={groupLabel} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <PhotoPlaceholderIcon className="h-16 w-16 text-white/80" />
            </div>
          )}
        </Reveal>
      </div>
    </PageShell>
  );
}
