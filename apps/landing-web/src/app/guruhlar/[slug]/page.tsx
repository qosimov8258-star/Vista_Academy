import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { fetchLanding } from "@/lib/api";
import { PLACEHOLDER_GROUPS, getGroupBySlug, toDisplayGroups } from "@/lib/groups";
import type { LandingGroup } from "@/lib/types";
import { Reveal } from "@/components/reveal";
import { alternatingDirection, staggerDelay } from "@/components/reveal-utils";

async function loadGroups() {
  const fetched = await fetchLanding<LandingGroup[]>("/groups", []);
  return fetched.length > 0 ? toDisplayGroups(fetched) : PLACEHOLDER_GROUPS;
}

/**
 * Har bir guruh uchun `public/guruh/<slug>/` papkasi oldindan tayyorlangan,
 * lekin hozircha faqat ba'zilarida rasm bor — shu bo'lim faqat rasmi mavjud
 * guruhlarda ko'rsatiladi, aks holda hamma guruhda bir xil rasm takrorlanib qolardi.
 */
function findGroupIntroImage(slug: string): string | null {
  const dir = path.join(process.cwd(), "public", "guruh", slug);
  try {
    const file = fs.readdirSync(dir).find((name) => /\.(jpe?g|png|webp)$/i.test(name));
    return file ? `/guruh/${slug}/${file}` : null;
  } catch {
    return null;
  }
}

/**
 * Sahifa oxiridagi "Farzandingiz shu yerda o'sadi va rivojlanadi" bo'limidagi
 * rasm uchun zaxira (fallback) — admin panelda "Guruh sahifasidagi rasmlar"dan
 * hali rasm qo'shilmagan guruhlar uchun ishlatiladi: avval `talim3` statik
 * rasmi, keyin `group.photo` (bosh rasm) tekshiriladi.
 */
function findGroupClosingImage(slug: string): string | null {
  const dir = path.join(process.cwd(), "public", "guruh", slug);
  try {
    const file = fs.readdirSync(dir).find((name) => /^talim3\.(jpe?g|png|webp)$/i.test(name));
    return file ? `/guruh/${slug}/${file}` : null;
  } catch {
    return null;
  }
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
  minionlar: "/guruh/minion/minion1.jpeg",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const group = getGroupBySlug(await loadGroups(), slug);
  return { title: group ? `${group.name} — Vista Academy` : "Guruh — Vista Academy" };
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getGroupBySlug(await loadGroups(), slug);
  if (!group) notFound();
  const introImage = findGroupIntroImage(group.slug);
  const closingImage = group.photos[0] ?? findGroupClosingImage(group.slug) ?? group.photo;
  const heroImageSrc = HERO_IMAGE_OVERRIDES[group.slug] ?? group.photo;

  return (
    <PageShell
      eyebrow="Guruhlarimiz"
      title={group.name}
      description="Bizning quvnoq guruhlarimizdan biri — farzandingiz shu yerda do'stlar orttiradi va yangi narsalar o'rganadi."
      heroImage={
        heroImageSrc
          ? { src: heroImageSrc, alt: `${group.name} guruhi`, position: "50% 50%" }
          : {
              alt: `${group.name} guruhi`,
              background: group.color,
              placeholder: (
                <div className="flex flex-col items-center gap-3 text-white/80">
                  <PhotoPlaceholderIcon className="h-16 w-16" />
                  <span className="text-[13px] font-bold">Rasm tez orada qo&apos;shiladi</span>
                </div>
              ),
            }
      }
    >
      {introImage && (
        <>
          <Reveal direction="up" className="mx-auto max-w-[520px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- guruh papkasidan dinamik topilgan rasm, o'lchamlari oldindan noma'lum */}
            <img
              src={introImage}
              alt="Bolalar quvnoq qahramonlar bilan o'ynamoqda"
              className="h-auto w-full object-contain"
            />
          </Reveal>

          <Reveal direction="up" delay={120} className="mx-auto mt-6 max-w-[640px] text-center">
            <p className="font-heading text-[20px] font-bold leading-snug tracking-tight text-[var(--color-text)] sm:text-[24px]">
              Har bir bola — o&apos;zicha bir dunyo, o&apos;zicha bir baxt.
              <br />
              Biz shu dunyoni mehr, o&apos;yin va bilim bilan boyitamiz.
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
            return (
              <Reveal key={index} direction={alternatingDirection(index)} delay={staggerDelay(index, 90, 360)} className="text-center">
                <div
                  className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-card)]"
                  style={{ background: "var(--color-tint)" }}
                >
                  {student?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                    <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Image
                        src="/icon/teacher.png"
                        alt=""
                        width={96}
                        height={96}
                        className="h-auto w-[45%] max-w-[100px] opacity-80"
                      />
                    </div>
                  )}
                </div>
                <p className="font-heading mt-4 text-[17px] font-bold text-[var(--color-text)]">
                  {student?.name ?? `${index + 1}-o'quvchi`}
                </p>
                <p className="mx-auto mt-2 max-w-[200px] text-[13.5px] italic leading-relaxed text-[var(--color-text-muted)]">
                  {student?.bio ?? "Ism va rasm tez orada qo'shiladi"}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-[1120px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal direction="left" className="order-2 lg:order-1">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
            {group.name} guruhi
          </p>
          <h2 className="font-heading mt-3 text-[26px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px]">
            Farzandingiz shu yerda o&apos;sadi va rivojlanadi
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
            &quot;{group.name}&quot; guruhida bolalar tajribali tarbiyachilar nazorati ostida do&apos;stlar orttiradi,
            har kungi mashg&apos;ulotlar orqali yangi bilim va ko&apos;nikmalarga ega bo&apos;ladi. Guruhimizda har bir
            bolaga alohida e&apos;tibor, mehr va g&apos;amxo&apos;rlik bilan yondashiladi.
          </p>
        </Reveal>

        <Reveal
          direction="right"
          delay={120}
          className="order-1 aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] lg:order-2"
          style={{ background: group.color }}
        >
          {closingImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- guruh uchun statik yoki API'dan kelgan dinamik rasm
            <img src={closingImage} alt={`${group.name} guruhi`} className="h-full w-full object-contain" />
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
