"use client";

import { use } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Hash, Hand, Timer } from "lucide-react";
import { ChevronRightIcon } from "@/components/ui/icons";
import parentStyles from "../../parent.module.css";
import { GAMES, SOUND_ANIMALS, TOPICS } from "./data";
import { GAME_BANNERS } from "./banners";
import { ODD_SETS } from "./ortiqcha/odd-data";
import { FoydaliHeader, SectionLabel } from "../foydali/ui";
import { TONE } from "./ui";
import { useTr } from "@/i18n/tr";

/**
 * «O'yinlar» — bola bilan birga o'ynash uchun. Tayyor o'yin katta karta
 * bo'lib turadi, qolganlari «Tez orada». O'yinlar internetga bog'liq emas
 * va bola haqida hech narsa saqlamaydi (natijalar faqat shu telefonda).
 */
export default function GamesPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const base = `/ota-ona/${slug}`;
  const ready = GAMES.filter((game) => game.href);
  const soon = GAMES.filter((game) => !game.href);
  const soonIcon: Record<string, typeof Hash> = { nechta: Hash };
  // Har o'yin kartasida «nimasi bor» yorlig'i; banner — banners.tsx
  const chips: Record<string, string> = {
    "juftini-top": tr("{0} mavzu", TOPICS.length),
    "kim-qichqirdi": tr("{0} ta hayvon", SOUND_ANIMALS.length),
    ortiqcha: tr("{0} ta guruh", ODD_SETS.length),
  };

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader title={tr("O'yinlar")} subtitle={tr("Bolangiz bilan birga o'ynang va o'rganing")} />

      <ul className="mt-5 space-y-3">
        {ready.map((game) => {
          const tone = TONE[game.tone];
          const Banner = GAME_BANNERS[game.id];
          const chip = chips[game.id];
          return (
            <li key={game.id}>
              <Link
                href={`${base}${game.href}`}
                className="block overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
              >
                {Banner && <Banner />}
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className={clsx(parentStyles.roundedFont, "text-[21px] font-extrabold text-[var(--p-ink)]")}>{tr(game.title)}</p>
                    <p className="mt-0.5 text-[14px] leading-snug text-[var(--p-muted)]">{tr(game.description)}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: tone.soft, color: tone.ink }}>
                        {tr(game.age)}
                      </span>
                      <span className="rounded-full bg-[var(--p-sunken)] px-2.5 py-1 text-[12px] font-semibold text-[var(--p-muted)]">
                        {tr(game.skill)}
                      </span>
                      {chip && (
                        <span className="rounded-full bg-[var(--p-sunken)] px-2.5 py-1 text-[12px] font-semibold text-[var(--p-muted)]">
                          {chip}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: tone.solid }}
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="mt-7">
        <SectionLabel>{tr("Tez orada")}</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {soon.map((game) => {
            const Icon = soonIcon[game.id] ?? Hand;
            return (
              <div
                key={game.id}
                className="flex flex-col items-start gap-2 rounded-[20px] border border-dashed border-[var(--p-line)] p-4"
              >
                <Icon className="h-6 w-6 text-[var(--p-muted)] opacity-80" strokeWidth={2} />
                <span className={clsx(parentStyles.roundedFont, "text-[16px] font-extrabold leading-tight text-[var(--p-ink)]")}>
                  {tr(game.title)}
                </span>
                <span className="text-[12.5px] leading-snug text-[var(--p-muted)]">{tr(game.description)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-7 space-y-2.5">
        <div className="flex items-start gap-3 rounded-[20px] bg-[var(--p-sky)]/12 px-4 py-3.5">
          <Hand className="mt-0.5 h-5 w-5 shrink-0 text-[var(--p-sky-ink)]" strokeWidth={2} />
          <p className="text-[13.5px] leading-relaxed text-[var(--p-ink)]">
            {tr("O'yin butun ekranni egallaydi — bola tasodifan boshqa bo'limga o'tib ketmaydi. Chiqish uchun ✕ tugmasini bosib turing.")}
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-[20px] bg-[var(--p-sun)]/12 px-4 py-3.5">
          <Timer className="mt-0.5 h-5 w-5 shrink-0 text-[var(--p-sun-ink)]" strokeWidth={2} />
          <p className="text-[13.5px] leading-relaxed text-[var(--p-ink)]">
            {tr("Bog'cha yoshidagi bolaga kuniga 10–15 daqiqa o'yin yetarli. Eng yaxshisi — yonida o'tirib, birga o'ynash.")}
          </p>
        </div>
      </div>
    </div>
  );
}
