"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Lightbulb, Shuffle } from "lucide-react";
import { LEVELS, TOPICS, TOPIC_GROUPS, findLevel, topicCover } from "../data";
import { useGamesStore } from "../store";
import { StarRow, TONE } from "../ui";
import { FoydaliHeader, SectionLabel } from "../../foydali/ui";
import { useTr } from "@/i18n/tr";

/**
 * «Juftini top» — daraja va mavzu tanlash. Daraja yuqorida (oxirgi tanlov
 * eslab qolinadi), mavzu bosilishi bilan o'yin boshlanadi — kichkintoy
 * kutib qolmasin. Har mavzuda shu darajadagi eng yaxshi yulduzchalar.
 */
export default function MemoryTopicsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/oyinlar`;
  const router = useRouter();
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

      {/* Mavzular — guruhlarga bo'lingan; bosilishi bilan o'yin boshlanadi */}
      <section className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{tr("Mavzular · {0} ta", TOPICS.length)}</SectionLabel>
          <button
            type="button"
            onClick={() => {
              const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
              router.push(`${base}/juftini-top/${topic.id}?daraja=${level.id}`);
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--p-accent)]/12 px-3.5 text-[13.5px] font-semibold text-[var(--p-accent)] transition-transform active:scale-95"
          >
            <Shuffle className="h-4 w-4" strokeWidth={2.3} />
            {tr("Tasodifiy")}
          </button>
        </div>

        {TOPIC_GROUPS.map((group) => {
          const tone = TONE[group.tone];
          const topics = TOPICS.filter((topic) => topic.group === group.id);
          if (topics.length === 0) return null;
          return (
            <div key={group.id} className="mt-5">
              <h3 className="px-1 text-[17px] font-semibold tracking-[-0.01em] text-[var(--p-ink)]">{tr(group.title)}</h3>
              <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                {topics.map((topic) => {
                  const result = store.memoryResult(topic.id, level.id);
                  const cover = topicCover(topic)[0];
                  return (
                    <Link
                      key={topic.id}
                      href={`${base}/juftini-top/${topic.id}?daraja=${level.id}`}
                      className="flex min-w-0 flex-col rounded-[20px] bg-[var(--p-card)] p-1.5 shadow-[var(--p-shadow)] transition-transform active:scale-[0.96]"
                    >
                      <span className="flex aspect-[4/3] items-center justify-center rounded-[15px]" style={{ background: tone.soft }}>
                        {cover && <img src={cover.image} alt="" draggable={false} loading="lazy" className="h-[70%] w-auto object-contain" />}
                      </span>
                      <span className="flex min-h-[34px] items-center justify-center px-0.5 pt-1.5 text-center text-[12.5px] font-semibold leading-[1.2] text-[var(--p-ink)]">
                        <span className="line-clamp-2">{tr(topic.title)}</span>
                      </span>
                      <span className="flex justify-center pb-1 pt-1">
                        <StarRow count={result.best} size={12} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
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
