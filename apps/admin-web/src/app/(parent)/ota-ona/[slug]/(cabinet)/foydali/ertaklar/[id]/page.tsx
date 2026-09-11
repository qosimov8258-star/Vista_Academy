"use client";

import { use } from "react";
import clsx from "clsx";
import { BulbIcon } from "@/components/ui/icons";
import styles from "../../../../parent.module.css";
import { useTale } from "../../content";
import { useLearned, useTextSize } from "../../store";
import { FoydaliHeader, LearnedButton, NotFoundCard, TaleCover, TextSizeControl, formatUzDate } from "../../ui";

/** Ertak matni uchun shrift (px) — she'rdan kichikroq, o'qishga qulay */
const READING_SIZES = [16.5, 18.5, 21] as const;

/**
 * Ertak — uxlashdan oldin ota-ona o'qib beradi. Oxirida saboq va bolaga
 * savollar: ertakni tushunganini tekshirish va suhbat boshlash uchun.
 */
export default function TalePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params);
  const base = `/ota-ona/${slug}/foydali`;
  const { data: tale } = useTale(id);
  const { has, toggle } = useLearned();
  const size = useTextSize();

  if (!tale) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4">
        <FoydaliHeader backHref={`${base}/ertaklar`} backLabel="Ertaklar" title="Ertak" />
        <NotFoundCard
          backHref={`${base}/ertaklar`}
          backLabel="Ertaklarga qaytish"
          text="Bu ertak o'chirilgan yoki hali qo'shilmagan."
        />
      </div>
    );
  }

  const fontSize = READING_SIZES[size];

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader
        backHref={`${base}/ertaklar`}
        backLabel="Ertaklar"
        title={tale.title}
        subtitle={`${tale.origin} · ${tale.minutes} daqiqa`}
        right={<TextSizeControl />}
      />

      <div className="mt-4 aspect-[16/9] w-full overflow-hidden rounded-[var(--p-radius)] shadow-[var(--p-shadow)]">
        <TaleCover kind={tale.cover} className="h-full w-full" />
      </div>

      <article className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] px-5 py-6 shadow-[var(--p-shadow)]">
        {tale.paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className={clsx("leading-[1.75] text-[var(--p-ink)]", i > 0 && "mt-4", i === 0 && styles.dropCap)}
            style={{ fontSize }}
          >
            {paragraph}
          </p>
        ))}
      </article>

      <section className="mt-3 rounded-[var(--p-radius)] bg-[var(--p-sun)]/12 px-5 py-4">
        <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--p-sun-ink)]">
          <BulbIcon className="h-4 w-4" />
          Ertak saboqi
        </p>
        <p className={`${styles.roundedFont} mt-2 text-[17px] font-bold leading-snug text-[var(--p-ink)]`}>{tale.moral}</p>
      </section>

      {tale.questions.length > 0 && (
        <section className="mt-3 rounded-[var(--p-radius)] bg-[var(--p-card)] px-5 py-4 shadow-[var(--p-shadow)]">
          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--p-sky-ink)]">Bolangizga so&apos;rang</p>
          <ol className="mt-3 space-y-2.5">
            {tale.questions.map((question, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--p-sky)]/16 text-[12.5px] font-bold text-[var(--p-sky-ink)]">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[15px] leading-snug text-[var(--p-ink)]">{question}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <LearnedButton
        learned={has("tales", tale.id)}
        onToggle={() => toggle("tales", tale.id)}
        idleLabel="O'qib bo'ldik!"
        doneLabel="O'qildi"
      />
      <p className="mt-6 text-center text-[12.5px] text-[var(--p-muted)]">
        {tale.addedBy} qo&apos;shgan · {formatUzDate(tale.addedAt)}
      </p>
    </div>
  );
}
