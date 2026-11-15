"use client";

import { use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bus, Carrot, Lightbulb, Palette, Stethoscope } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { LEVELS, SOON_TOPICS, TOPICS, findLevel, topicCover } from "../data";
import { useGamesStore } from "../store";
import { StarRow, TONE } from "../ui";
import { FoydaliHeader, SectionLabel } from "../../foydali/ui";
import { useTr } from "@/i18n/tr";

const SOON_ICONS = { Sabzavotlar: Carrot, Transport: Bus, Kasblar: Stethoscope, Ranglar: Palette } as const;

/**
 * «Juftini top» — daraja va mavzu tanlash. Daraja yuqorida (oxirgi tanlov
 * eslab qolinadi), mavzu bosilishi bilan o'yin boshlanadi — kichkintoy
 * kutib qolmasin. Har mavzuda shu darajadagi eng yaxshi yulduzchalar.
 */
export default function MemoryTopicsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/oyinlar`;
  const store = useGamesStore();
  const level = findLevel(store.level);

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader backHref={base} backLabel="O'yinlar" title={tr("Juftini top")} subtitle={tr("Kartalarni ochib, bir xil rasmlarni toping")} />

      {/* Daraja — iOS segmenti */}
      <section className="mt-6">
        <SectionLabel>{tr("Daraja")}</SectionLabel>
        <div role="radiogroup" aria-label={tr("Daraja")} className="mt-3 flex rounded-full bg-[var(--p-sunken)] p-[3px]">
          {LEVELS.map((item) => {
            const active = item.id === level.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => store.setLevel(item.id)}
                className={clsx(
                  "flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-full px-2 py-1 transition-colors",
                  active ? "bg-[var(--p-segment)] shadow-sm" : "",
                )}
              >
                <span className={clsx("text-[14.5px] font-bold", active ? "text-[var(--p-ink)]" : "text-[var(--p-muted)]")}>
                  {tr(item.title)}
                </span>
                <span className="text-[11.5px] font-semibold text-[var(--p-muted)]">{tr(item.age)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[13px] leading-snug text-[var(--p-muted)]">
          {level.peekMs > 0
            ? tr("{0} ta karta. Boshida rasmlar {1} soniya ochiq turadi.", level.pairs * 2, level.peekMs / 1000)
            : tr("{0} ta karta. Rasmlar boshida ko'rsatilmaydi.", level.pairs * 2)}
        </p>
      </section>

      {/* Mavzular */}
      <section className="mt-7">
        <SectionLabel>{tr("Mavzular")}</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {TOPICS.map((topic) => {
            const tone = TONE[topic.tone];
            const result = store.memoryResult(topic.id, level.id);
            return (
              <Link
                key={topic.id}
                href={`${base}/juftini-top/${topic.id}?daraja=${level.id}`}
                className="overflow-hidden rounded-[24px] bg-[var(--p-card)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.97]"
              >
                <div className="flex h-[104px] items-center justify-center" style={{ background: tone.soft }}>
                  {topicCover(topic).map((item, i) => (
                    <img
                      key={item.id}
                      src={item.image}
                      alt=""
                      draggable={false}
                      className={clsx(styles.bob, "object-contain", i === 1 ? "z-10 -mx-2 h-[72px] w-[72px]" : "h-[52px] w-[52px]")}
                      style={{ animationDelay: `${i * 0.5}s` }}
                    />
                  ))}
                </div>
                <div className="px-3.5 pb-3.5 pt-3">
                  <p className={clsx(parentStyles.roundedFont, "truncate text-[18px] font-extrabold text-[var(--p-ink)]")}>{tr(topic.title)}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] text-[var(--p-muted)]">
                      {result.plays > 0 ? tr("{0} marta o'ynaldi", result.plays) : tr("{0} ta rasm", topic.items.length)}
                    </span>
                    <StarRow count={result.best} size={15} />
                  </div>
                </div>
              </Link>
            );
          })}
          {SOON_TOPICS.map((title) => {
            const Icon = SOON_ICONS[title];
            return (
              <div
                key={title}
                className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-[var(--p-line)] px-2 py-4 text-center"
              >
                <Icon className="h-6 w-6 text-[var(--p-muted)] opacity-70" strokeWidth={2} />
                <span className="text-[13px] font-semibold leading-tight text-[var(--p-muted)]">{tr(title)}</span>
                <span className="text-[11.5px] text-[var(--p-muted)] opacity-80">{tr("Tez orada")}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Qanday o'ynaladi */}
      <section className="mt-7">
        <SectionLabel>{tr("Qanday o'ynaladi?")}</SectionLabel>
        <ol className="mt-3 space-y-3 rounded-[24px] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)]">
          {[
            "Kartani bosing — rasm ochiladi.",
            "Yana bitta kartani bosing. Rasmlar bir xil bo'lsa, ochiq qoladi.",
            "Bir xil bo'lmasa, kartalar yopiladi — qayerda nima borligini eslab qoling.",
            "Hamma juftni topsangiz — yulduzcha olasiz!",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p-mint)]/16 text-[13.5px] font-extrabold text-[var(--p-mint)]">
                {i + 1}
              </span>
              <span className="pt-0.5 text-[14.5px] leading-snug text-[var(--p-ink)]">{tr(step)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-start gap-3 rounded-[20px] bg-[var(--p-sun)]/12 px-4 py-3.5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--p-sun-ink)]" strokeWidth={2} />
          <p className="text-[13.5px] leading-relaxed text-[var(--p-ink)]">
            {tr("Juft topilganda rasm nomi pastda chiqadi — uni bolangiz bilan birga ovoz chiqarib ayting. Shunda o'yin so'z boyligini ham oshiradi.")}
          </p>
        </div>
      </section>
    </div>
  );
}
