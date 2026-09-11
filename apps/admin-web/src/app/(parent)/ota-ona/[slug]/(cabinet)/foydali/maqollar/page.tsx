"use client";

import { use, useState } from "react";
import clsx from "clsx";
import { ChevronDownIcon } from "@/components/ui/icons";
import styles from "../../../parent.module.css";
import { useProverbs } from "../content";
import { useDayIndex, useLearned } from "../store";
import { FoydaliHeader, ProverbIcon, SparkleDeco, StarIcon, TONES, TONE_CYCLE } from "../ui";

/**
 * Maqollar. Har birining ostida bolaga tushuntirish uchun sodda izoh bor —
 * maqolni yodlashdan oldin ma'nosini tushunish muhim.
 */
export default function ProverbsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/foydali`;
  const { data: proverbs } = useProverbs();
  const { has, toggle } = useLearned();
  const day = useDayIndex();
  const [open, setOpen] = useState<string | null>(null);
  const featured = proverbs.length > 0 ? proverbs[day % proverbs.length] : null;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader
        backHref={base}
        backLabel="Foydali"
        title="Maqollar"
        subtitle="Qisqa, dono so'zlar — avval ma'nosini tushuntiring, keyin birga yodlang"
      />

      {featured && (
        <section className="relative mt-5 overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] px-5 pb-5 pt-4 shadow-[var(--p-shadow)]">
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(110%_80%_at_100%_0%,rgba(63,191,155,0.22),transparent_60%),radial-gradient(90%_70%_at_0%_100%,rgba(86,180,245,0.18),transparent_60%)]"
          />
          <SparkleDeco className="absolute right-3 top-3 h-14 w-14" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-[var(--p-mint)]/16 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--p-mint)]">
            <StarIcon filled className="h-3.5 w-3.5" />
            Bugungi maqol
          </span>
          <p
            className={`${styles.roundedFont} relative mt-3 pr-10 text-[23px] font-extrabold leading-snug text-[var(--p-ink)]`}
          >
            <span aria-hidden="true" className="mr-1 text-[var(--p-mint)]">
              «
            </span>
            {featured.text.replace(/\.$/, "")}
            <span aria-hidden="true" className="ml-0.5 text-[var(--p-mint)]">
              »
            </span>
          </p>
          <p className="relative mt-2.5 text-[14.5px] leading-relaxed text-[var(--p-muted)]">{featured.meaning}</p>
        </section>
      )}

      <ul className="mt-5 space-y-3">
        {proverbs.map((proverb, i) => {
          const tone = TONES[TONE_CYCLE[(i + 4) % TONE_CYCLE.length]];
          const learned = has("proverbs", proverb.id);
          const isOpen = open === proverb.id;
          return (
            <li key={proverb.id} className="overflow-hidden rounded-[24px] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
              <div className="flex items-start gap-3 p-4">
                <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone.soft, tone.ink)}>
                  <ProverbIcon className="h-6 w-6" />
                </span>
                <p className={`${styles.roundedFont} flex-1 pt-1 text-[18px] font-bold leading-snug text-[var(--p-ink)]`}>
                  {proverb.text}
                </p>
                <button
                  type="button"
                  aria-pressed={learned}
                  aria-label={learned ? "Yodlangan — belgini olib tashlash" : "Yodladik deb belgilash"}
                  onClick={() => toggle("proverbs", proverb.id)}
                  className={clsx(
                    "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
                    learned ? "bg-[var(--p-sun)]/18 text-[var(--p-sun-ink)]" : "bg-[var(--p-sunken)] text-[var(--p-muted)]",
                  )}
                >
                  <StarIcon
                    filled={learned}
                    key={learned ? "on" : "off"}
                    className={clsx("h-5 w-5", learned && styles.starPop)}
                  />
                </button>
              </div>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : proverb.id)}
                className="flex w-full cursor-pointer items-center justify-between border-t border-[var(--p-line)] px-4 py-3 text-[13.5px] font-bold text-[var(--p-muted)] transition-colors active:bg-[var(--p-sunken)]"
              >
                Ma&apos;nosi
                <ChevronDownIcon className={clsx("h-4 w-4 transition-transform duration-300", isOpen && "rotate-180")} />
              </button>
              {/* Silliq ochilish: balandlik 0fr → 1fr */}
              <div
                className={clsx(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-[14.5px] leading-relaxed text-[var(--p-muted)]">{proverb.meaning}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
