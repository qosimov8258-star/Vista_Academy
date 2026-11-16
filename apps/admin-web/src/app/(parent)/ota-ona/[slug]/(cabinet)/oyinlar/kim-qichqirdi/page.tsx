"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Lightbulb, Play, Volume2 } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import styles from "../oyinlar.module.css";
import { SOUND_ANIMALS, SOUND_LEVELS, findSoundLevel, type SoundAnimal } from "../data";
import { useGamesStore } from "../store";
import { loadClip, playClip, stopClip, unlockAudio } from "../sound";
import { StarRow, TONE } from "../ui";
import { FoydaliHeader, SectionLabel } from "../../foydali/ui";
import { useTr } from "@/i18n/tr";

/**
 * «Kim qichqirdi?» — daraja tanlash, o'yinni boshlash va «Ovozlar albomi».
 * Albomda bola (ota-onasi bilan) o'yindan oldin har bir hayvon ovozini
 * bosib eshitib chiqadi — 2 yoshli bola uchun shuning o'zi ham o'yin.
 */
export default function SoundGameHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/oyinlar`;
  const store = useGamesStore();
  const level = findSoundLevel(store.soundLevel);
  const result = store.soundResult(level.id);
  const tone = TONE.sun;

  // Albom: hozir qaysi hayvon ovozi yangrayapti
  const [playingId, setPlayingId] = useState<string | null>(null);
  const token = useRef(0);
  useEffect(() => {
    SOUND_ANIMALS.forEach((animal) => void loadClip(animal.sound));
    return () => {
      token.current++;
      stopClip();
    };
  }, []);
  const listen = async (animal: SoundAnimal) => {
    unlockAudio();
    const mine = ++token.current;
    setPlayingId(animal.id);
    await playClip(animal.sound);
    if (token.current === mine) setPlayingId(null);
  };

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader backHref={base} backLabel="O'yinlar" title={tr("Kim qichqirdi?")} subtitle={tr("Ovozni eshitib, hayvonni toping")} />

      <section className="mt-6">
        <SectionLabel>{tr("Daraja")}</SectionLabel>
        <div role="radiogroup" aria-label={tr("Daraja")} className="mt-3 flex rounded-full bg-[var(--p-sunken)] p-[3px]">
          {SOUND_LEVELS.map((item) => {
            const active = item.id === level.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => store.setSoundLevel(item.id)}
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
          {tr("{0} ta savol. Har birida {1} ta hayvondan tanlaydi.", level.rounds, level.choices)}
        </p>
      </section>

      {/* O'ynash */}
      <Link
        href={`${base}/kim-qichqirdi/oyna?daraja=${level.id}`}
        onClick={() => unlockAudio()}
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

      {/* Ovozlar albomi */}
      <section className="mt-7">
        <SectionLabel>{tr("Ovozlar albomi")}</SectionLabel>
        <p className="mt-1.5 px-1 text-[13px] leading-snug text-[var(--p-muted)]">
          {tr("Hayvonni bosing — ovozini eshitasiz. O'yindan oldin birga tinglab chiqing.")}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2.5 min-[420px]:grid-cols-4">
          {SOUND_ANIMALS.map((animal) => {
            const active = playingId === animal.id;
            return (
              <button
                key={animal.id}
                type="button"
                onClick={() => void listen(animal)}
                aria-label={tr(animal.name)}
                className={clsx(
                  "relative flex flex-col items-center gap-1 rounded-[22px] bg-[var(--p-card)] px-1 pb-2.5 pt-3 shadow-[var(--p-shadow)] transition-transform active:scale-95",
                )}
                style={active ? { boxShadow: `inset 0 0 0 3px ${tone.solid}, var(--p-shadow)` } : undefined}
              >
                <img
                  src={animal.image}
                  alt=""
                  draggable={false}
                  className={clsx("h-14 w-14 object-contain", active && styles.bob)}
                  style={active ? { animationDuration: "0.6s" } : undefined}
                />
                <span className="flex items-center gap-1 text-[13.5px] font-bold text-[var(--p-ink)]">
                  {active && <Volume2 className="h-3.5 w-3.5" style={{ color: tone.ink }} strokeWidth={2.4} />}
                  {tr(animal.name)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <SectionLabel>{tr("Qanday o'ynaladi?")}</SectionLabel>
        <ol className="mt-3 space-y-3 rounded-[24px] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)]">
          {[
            "Katta tugmani bosing — hayvon ovozi yangraydi.",
            "Ovoz kimniki? Rasmini bosing.",
            "Qayta eshitish uchun karnayni bosing.",
            "Adashsangiz, ovoz yana yangraydi — to'g'risini topguncha urinib ko'ring.",
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
            {tr("Ovozga taqlid qiling: «Sigir qanday deydi? — Muu!» Bola eshitganini takrorlasa, tezroq eslab qoladi.")}
          </p>
        </div>
      </section>
    </div>
  );
}
