"use client";

import { use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BulbIcon, ChevronRightIcon } from "@/components/ui/icons";
import styles from "../../../parent.module.css";
import { usePoems } from "../content";
import { useLearned } from "../store";
import { Chip, FoydaliHeader, PoemIcon, StarIcon, TONES, TONE_CYCLE } from "../ui";

/** She'rlar ro'yxati — tarbiyachilar qo'shgan, bolaning yoshiga mos she'rlar */
export default function PoemsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/foydali`;
  const { data: poems } = usePoems();
  const { has } = useLearned();

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader
        backHref={base}
        backLabel="Foydali"
        title="She'rlar"
        subtitle="Tarbiyachilar tanlagan she'rlar — bolangiz bilan birga yodlang"
      />

      <div className="mt-4 flex items-start gap-3 rounded-[20px] bg-[var(--p-sun)]/12 px-4 py-3.5">
        <BulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--p-sun-ink)]" />
        <p className="text-[13.5px] leading-relaxed text-[var(--p-ink)]">
          Har kuni uxlashdan oldin 1–2 bandni takrorlang — bola she&apos;rni tez va mustahkam yodlaydi.
        </p>
      </div>

      {poems.length === 0 ? (
        <p className="mt-10 text-center text-[15px] text-[var(--p-muted)]">
          Hozircha she&apos;r yo&apos;q — tarbiyachi tez orada qo&apos;shadi.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {poems.map((poem, i) => {
            const tone = TONES[TONE_CYCLE[i % TONE_CYCLE.length]];
            const learned = has("poems", poem.id);
            const lines = poem.stanzas.reduce((n, stanza) => n + stanza.length, 0);
            return (
              <li key={poem.id}>
                <Link
                  href={`${base}/sherlar/${poem.id}`}
                  className="flex items-center gap-4 rounded-[24px] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
                >
                  <span
                    className={clsx(
                      "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]",
                      tone.soft,
                      tone.ink,
                    )}
                  >
                    <PoemIcon className="h-8 w-8" />
                    {learned && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--p-mint)] text-white ring-2 ring-[var(--p-card)]">
                        <StarIcon filled className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`${styles.roundedFont} block truncate text-[18px] font-bold text-[var(--p-ink)]`}>
                      {poem.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[13.5px] text-[var(--p-muted)]">
                      {poem.stanzas[0]?.[0]}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Chip>
                        {poem.ageFrom}–{poem.ageTo} yosh
                      </Chip>
                      <Chip>{lines} qator</Chip>
                      {learned && <Chip tone="mint">Yodlandi</Chip>}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-[var(--p-muted)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
