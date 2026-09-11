"use client";

import { use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BulbIcon, ChevronRightIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import { usePoems, useProverbs, useTales } from "./content";
import { countLearned, useDayIndex, useLearned } from "./store";
import {
  FoydaliHeader,
  PoemIcon,
  ProverbIcon,
  RiddleIcon,
  SectionLabel,
  SongIcon,
  SparkleDeco,
  StarIcon,
  TaleIcon,
  TONES,
  TongueTwisterIcon,
  type Tone,
} from "./ui";

/**
 * "Foydali" — bola bilan birga o'qish va yodlash uchun.
 *
 * Hozircha she'rlar, maqollar va ertaklar; keyinchalik boshqa bo'limlar
 * qo'shiladi ("Tez orada" qatori shu uchun). Mazmunni tarbiyachilar
 * yuklaydi (qarang: content.ts).
 */
export default function UsefulPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/foydali`;
  const { data: poems } = usePoems();
  const { data: proverbs } = useProverbs();
  const { data: tales } = useTales();
  const { learned } = useLearned();
  const day = useDayIndex();
  const featured = poems.length > 0 ? poems[day % poems.length] : null;

  const sections: Array<{
    href: string;
    title: string;
    note: string;
    Icon: (props: { className?: string }) => React.JSX.Element;
    tone: Tone;
    total: number;
    done: number;
    unit: string;
    doneWord: string;
  }> = [
    {
      href: `${base}/sherlar`,
      title: "She'rlar",
      note: "Qatorma-qator yodlang",
      Icon: PoemIcon,
      tone: "lilac",
      total: poems.length,
      done: countLearned(learned.poems, poems),
      unit: "she'r",
      doneWord: "yodlandi",
    },
    {
      href: `${base}/maqollar`,
      title: "Maqollar",
      note: "Ma'nosi bilan",
      Icon: ProverbIcon,
      tone: "mint",
      total: proverbs.length,
      done: countLearned(learned.proverbs, proverbs),
      unit: "maqol",
      doneWord: "yodlandi",
    },
    {
      href: `${base}/ertaklar`,
      title: "Ertaklar",
      note: "Uxlashdan oldin o'qing",
      Icon: TaleIcon,
      tone: "sky",
      total: tales.length,
      done: countLearned(learned.tales, tales),
      unit: "ertak",
      doneWord: "o'qildi",
    },
  ];

  const soon = [
    { title: "Topishmoqlar", Icon: RiddleIcon },
    { title: "Qo'shiqlar", Icon: SongIcon },
    { title: "Tez aytishlar", Icon: TongueTwisterIcon },
  ];

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader title="Foydali" subtitle="Bolangiz bilan birga o'qing, yodlang va o'ynang" />

      {featured && (
        <Link
          href={`${base}/sherlar/${featured.id}`}
          className="relative mt-5 block overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(167,139,250,0.28),transparent_60%),radial-gradient(90%_80%_at_0%_100%,rgba(255,183,3,0.2),transparent_60%)]"
          />
          <SparkleDeco className="absolute right-4 top-4 h-16 w-16" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-[var(--p-lilac)]/16 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--p-lilac-ink)]">
            <StarIcon filled className="h-3.5 w-3.5" />
            Bugungi she&apos;r
          </span>
          <p className={`${styles.roundedFont} relative mt-3 text-[26px] font-extrabold leading-tight text-[var(--p-ink)]`}>
            {featured.title}
          </p>
          <p className={`${styles.roundedFont} relative mt-2 text-[16.5px] font-semibold leading-relaxed text-[var(--p-muted)]`}>
            {featured.stanzas[0]?.[0]}
            <br />
            {featured.stanzas[0]?.[1]}
          </p>
          <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--p-coral)] px-4 py-2.5 text-[14.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(255,122,102,0.8)]">
            Yodlashni boshlash
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </Link>
      )}

      <section className="mt-7">
        <SectionLabel>Bo&apos;limlar</SectionLabel>
        <ul className="mt-3 space-y-3">
          {sections.map((section) => {
            const tone = TONES[section.tone];
            const progress = section.total > 0 ? section.done / section.total : 0;
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="flex items-center gap-4 rounded-[24px] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
                >
                  <span className={clsx("flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[20px]", tone.soft, tone.ink)}>
                    <section.Icon className="h-9 w-9" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`${styles.roundedFont} block text-[18px] font-extrabold text-[var(--p-ink)]`}>
                      {section.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[var(--p-muted)]">
                      {section.total} ta {section.unit}
                      {section.done > 0 ? ` · ${section.done} tasi ${section.doneWord}` : ` · ${section.note}`}
                    </span>
                    <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[var(--p-sunken)]">
                      <span
                        className={clsx("block h-full rounded-full transition-[width] duration-500 ease-out", tone.solid)}
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-[var(--p-muted)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-7">
        <SectionLabel>Tez orada</SectionLabel>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {soon.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-[var(--p-line)] px-2 py-4 text-center"
            >
              <item.Icon className="h-7 w-7 text-[var(--p-muted)] opacity-70" />
              <span className="text-[12.5px] font-semibold leading-tight text-[var(--p-muted)]">{item.title}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-7 flex items-start gap-3 rounded-[20px] bg-[var(--p-sun)]/12 px-4 py-3.5">
        <BulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--p-sun-ink)]" />
        <p className="text-[13.5px] leading-relaxed text-[var(--p-ink)]">
          Bolalar takrorlash orqali yodlaydi. Kuniga 5 daqiqa — bir oyda o&apos;nlab she&apos;r va maqol!
        </p>
      </div>
    </div>
  );
}
