"use client";

import { use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Lightbulb, Play } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import { useGamesStore } from "../store";
import { StarRow, TONE } from "../ui";
import { FoydaliHeader, SectionLabel } from "../../foydali/ui";
import { ODD_LEVELS, ODD_SETS, findOddLevel } from "./odd-data";
import { useTr } from "@/i18n/tr";

/**
 * «Ortiqchasini top» — daraja tanlash va o'yinni boshlash. Pastda o'yinda
 * uchraydigan guruhlar: ota-ona bola bilan avval ularni nomlab chiqishi
 * mumkin («Bular — mevalar, bular — transport»).
 */
export default function OddGameHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/oyinlar`;
  const store = useGamesStore();
  const level = findOddLevel(store.oddLevel);
  const result = store.oddResult(level.id);
  const tone = TONE.lilac;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader backHref={base} backLabel="O'yinlar" title={tr("Ortiqchasini top")} subtitle={tr("To'rttadan qaysi biri boshqacha?")} />

      <section className="mt-6">
        <SectionLabel>{tr("Daraja")}</SectionLabel>
        <div role="radiogroup" aria-label={tr("Daraja")} className="mt-3 flex rounded-full bg-[var(--p-sunken)] p-[3px]">
          {ODD_LEVELS.map((item) => {
            const active = item.id === level.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => store.setOddLevel(item.id)}
                className={clsx(
                  "flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-full px-2 py-1",
                  active && "bg-[var(--p-segment)] shadow-sm",
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
          {tr("{0} ta savol.", level.rounds)} {tr(level.hint)}
        </p>
      </section>

      {/* O'ynash */}
      <Link
        href={`${base}/ortiqcha/oyna?daraja=${level.id}`}
        className="mt-5 flex items-center gap-4 rounded-[var(--p-radius)] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
      >
        <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full text-white" style={{ background: tone.solid }}>
          <Play className="ml-1 h-8 w-8" strokeWidth={2} fill="currentColor" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx(parentStyles.roundedFont, "block text-[21px] font-extrabold text-[var(--p-ink)]")}>{tr("O'ynash")}</span>
          <span className="mt-0.5 block text-[13px] text-[var(--p-muted)]">
            {result.plays > 0 ? tr("{0} marta o'ynaldi", result.plays) : tr("Hali o'ynalmagan")}
          </span>
        </span>
        <StarRow count={result.best} size={18} />
      </Link>

      {/* O'yindagi guruhlar */}
      <section className="mt-7">
        <SectionLabel>{tr("O'yindagi guruhlar · {0} ta", ODD_SETS.length)}</SectionLabel>
        <p className="mt-1.5 px-1 text-[13px] leading-snug text-[var(--p-muted)]">
          {tr("O'yindan oldin bolangiz bilan guruhlarni nomlab chiqing: «Bular — mevalar».")}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {ODD_SETS.map((set) => (
            <div key={set.id} className="flex min-w-0 flex-col rounded-[20px] bg-[var(--p-card)] p-1.5 shadow-[var(--p-shadow)]">
              <span className="flex aspect-[4/3] items-center justify-center rounded-[15px]" style={{ background: tone.soft }}>
                <img src={set.items[0].image} alt="" loading="lazy" draggable={false} className="h-[66%] w-auto object-contain" />
              </span>
              <span className="flex min-h-[38px] items-center justify-center px-0.5 pt-1.5 text-center text-[12.5px] font-semibold leading-[1.2] text-[var(--p-ink)]">
                <span className="line-clamp-2">{capitalize(tr(set.plural))}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionLabel>{tr("Qanday o'ynaladi?")}</SectionLabel>
        <ol className="mt-3 space-y-3 rounded-[24px] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)]">
          {[
            "Ekranda to'rtta rasm chiqadi.",
            "Uchtasi bir guruhdan, bittasi — boshqa. O'shani bosing.",
            "Adashsangiz, nega u ortiqcha emasligi yoziladi — yana qidiring.",
            "Topilganda izohni bolaga o'qib bering: «Mashina — transport, qolganlari — mevalar».",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13.5px] font-extrabold"
                style={{ background: tone.soft, color: tone.ink }}
              >
                {i + 1}
              </span>
              <span className="pt-0.5 text-[14.5px] leading-snug text-[var(--p-ink)]">{tr(step)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-start gap-3 rounded-[20px] bg-[var(--p-sun)]/12 px-4 py-3.5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--p-sun-ink)]" strokeWidth={2} />
          <p className="text-[13.5px] leading-relaxed text-[var(--p-ink)]">
            {tr("Bola topgach, «Nega?» deb so'rang. O'z so'zi bilan tushuntirsa — mantiq va nutq birga rivojlanadi.")}
          </p>
        </div>
      </section>
    </div>
  );
}

/** «mevalar» → «Mevalar» (tarjimada ham) */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
