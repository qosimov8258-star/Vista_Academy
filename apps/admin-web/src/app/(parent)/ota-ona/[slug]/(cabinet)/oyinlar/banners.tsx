"use client";

import clsx from "clsx";
import { Volume2 } from "lucide-react";
import styles from "./oyinlar.module.css";
import { SOUND_ANIMALS, TOPICS, findItem } from "./data";
import { TONE } from "./ui";
import { useTr } from "@/i18n/tr";

/**
 * O'yinlar ro'yxatidagi bannerlar. Har biri o'z o'yinining kichik sahnasi:
 * ota-ona hali ochmay turib, o'yin qanday ekanini ko'radi. Elementlar
 * o'yinning o'zidan olingan (karta orqasi, yulduzcha, karnay) — ro'yxat va
 * o'yin bir-biriga o'xshaydi.
 */

const animal = (id: string) => SOUND_ANIMALS.find((item) => item.id === id);

/** Banner foni: yumshoq rangli yoyilma + mayda nuqtalar to'ri */
function Backdrop({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <div
      className="relative h-[164px] overflow-hidden"
      style={{
        background: `radial-gradient(120% 110% at 12% 0%, ${TONE[tone].soft}, transparent 62%), radial-gradient(110% 100% at 100% 100%, ${TONE[tone].soft}, transparent 60%), var(--p-sunken)`,
      }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-[0.35]" aria-hidden="true">
        <defs>
          <pattern id={`dots-${tone}`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="currentColor" className="text-[var(--p-muted)]" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots-${tone})`} />
      </svg>
      {children}
    </div>
  );
}

/** Karta orqasi — o'yindagi bilan bir xil yulduzcha */
function CardBack({ tone, className, style }: { tone: keyof typeof TONE; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={clsx("flex items-center justify-center rounded-[16px]", className)}
      style={{ background: TONE[tone].solid, boxShadow: "inset 0 0 0 2.5px rgba(255,255,255,0.35), 0 6px 14px -8px rgba(60,40,30,0.5)", ...style }}
    >
      <svg viewBox="0 0 100 100" className="h-[58%] w-[58%]" aria-hidden="true">
        <circle cx="18" cy="20" r="4" fill="white" opacity="0.35" />
        <circle cx="84" cy="78" r="5" fill="white" opacity="0.3" />
        <path
          d="M50 22l8.3 16.8 18.5 2.7-13.4 13 3.2 18.4L50 64.2l-16.6 8.7 3.2-18.4-13.4-13 18.5-2.7Z"
          fill="white"
          opacity="0.92"
          stroke="white"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Ochiq karta — oq, rasm bilan; topilgan juft yashil halqali */
function CardFace({ src, matched, className, style }: { src: string; matched?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={clsx("flex items-center justify-center rounded-[16px] bg-[var(--p-card)]", className)}
      style={{ boxShadow: matched ? "inset 0 0 0 2.5px var(--p-mint), var(--p-shadow)" : "var(--p-shadow)", ...style }}
    >
      <img src={src} alt="" draggable={false} className="h-[74%] w-[74%] object-contain" />
    </span>
  );
}

/**
 * «Juftini top»: 6 kartali kichik taxta — ikkitasi topilgan juft (yashil
 * halqa), bittasi hozir ochilgan, qolganlari yopiq. Yonida mavzular yorlig'i.
 */
export function MemoryBanner() {
  const [cat, lion, apple] = ["cat", "lion", "apple"].map((id) => findItem(id)!);
  // Mavzular ko'p — bannerda bir nechtasining birinchi rasmi va «+N»
  const shownTopics = TOPICS.filter((topic) => ["yovvoyi", "mevalar", "transport"].includes(topic.id));
  const size = "h-[46px] w-[46px]";
  return (
    <Backdrop tone="mint">
      {/* Taxta — chapda, biroz burilgan, o'yin ekranini eslatadi */}
      <div className="absolute left-5 top-1/2 grid -translate-y-1/2 -rotate-[4deg] grid-cols-3 gap-2" style={{ transformOrigin: "center" }}>
        <CardFace src={cat.image} matched className={size} />
        <CardBack tone="mint" className={size} />
        <CardFace src={cat.image} matched className={size} />
        <CardBack tone="mint" className={size} />
        <CardFace src={apple.image} className={clsx(size, styles.bob)} style={{ animationDuration: "2.6s" }} />
        <CardBack tone="mint" className={size} />
      </div>
      {/* O'ngda: topilgan juft rasmi «sakrab» chiqqan va mavzular */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--p-card)] py-1.5 pl-1.5 pr-3 shadow-[var(--p-shadow)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: TONE.mint.soft }}>
            <img src={lion.image} alt="" draggable={false} className="h-5 w-5 object-contain" />
          </span>
          <span className="text-[13px] font-extrabold text-[var(--p-ink)]">Sher!</span>
        </span>
        <span className="flex items-center gap-1.5">
          {shownTopics.map((topic) => (
            <span
              key={topic.id}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--p-card)] shadow-[var(--p-shadow)]"
            >
              <img src={topic.items[0]?.image} alt="" draggable={false} className="h-6 w-6 object-contain" />
            </span>
          ))}
          {TOPICS.length > shownTopics.length && (
            <span className="flex h-9 items-center justify-center rounded-full bg-[var(--p-card)] px-2.5 text-[12.5px] font-bold tabular-nums text-[var(--p-ink)] shadow-[var(--p-shadow)]">
              +{TOPICS.length - shownTopics.length}
            </span>
          )}
        </span>
      </div>
      {/* Pastda yulduzchalar — natija */}
      <div className="absolute bottom-3 right-4 flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <svg key={i} viewBox="0 0 24 24" className="h-5 w-5">
            <path
              d="M12 2.8l2.75 5.6 6.15.9-4.45 4.34 1.05 6.13L12 16.88l-5.5 2.89 1.05-6.13L3.1 9.3l6.15-.9Z"
              fill={i < 2 ? "var(--p-sun)" : "var(--p-card)"}
              stroke={i < 2 ? "var(--p-sun-ink)" : "var(--p-line)"}
              strokeWidth={i < 2 ? 0.8 : 1.2}
              strokeLinejoin="round"
            />
          </svg>
        ))}
      </div>
    </Backdrop>
  );
}

/**
 * «Kim qichqirdi?»: markazda karnay, undan to'lqinlar tarqaladi; atrofida
 * to'rtta hayvon, biri (sigir) «topildi» — yashil halqada va nomi bilan.
 */
export function SoundBanner() {
  const cow = animal("cow")!;
  const others = ["rooster", "cat", "duck"].map((id) => animal(id)!);
  return (
    <Backdrop tone="sun">
      {/* To'lqinlar — statik halqalar, karnay atrofida kengayib boradi */}
      <div className="absolute left-[76px] top-[62px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
        {[1, 2, 3].map((ring) => (
          <span
            key={ring}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              width: 56 + ring * 34,
              height: 56 + ring * 34,
              borderColor: TONE.sun.solid,
              opacity: 0.55 - ring * 0.14,
            }}
          />
        ))}
        <span
          className={clsx(styles.speaker, styles.speaking, "relative flex h-[64px] w-[64px] items-center justify-center rounded-full text-white shadow-[var(--p-shadow)]")}
          style={{ background: TONE.sun.solid, ["--wave" as string]: TONE.sun.solid }}
        >
          <Volume2 className="h-8 w-8" strokeWidth={2.2} />
        </span>
      </div>

      {/* Javob kartalari — o'yindagi kabi oq kvadratlar */}
      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
        <div className="flex flex-col gap-2">
          <AnswerTile src={others[0].image} />
          <AnswerTile src={others[1].image} />
        </div>
        <div className="flex flex-col gap-2">
          <AnswerTile src={cow.image} right />
          <AnswerTile src={others[2].image} />
        </div>
      </div>

      {/* «Sigir!» — topilgan javob nomi, o'yindagi pufakcha kabi */}
      <span className={clsx(styles.bob, "absolute bottom-3 left-4 flex items-center gap-1.5 rounded-full bg-[var(--p-card)] py-1 pl-1 pr-3 shadow-[var(--p-shadow)]")} style={{ animationDuration: "3s" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: TONE.sun.soft }}>
          <img src={cow.image} alt="" draggable={false} className="h-5 w-5 object-contain" />
        </span>
        <span className="text-[13px] font-extrabold text-[var(--p-ink)]">Sigir!</span>
      </span>
    </Backdrop>
  );
}

function AnswerTile({ src, right }: { src: string; right?: boolean }) {
  return (
    <span
      className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[var(--p-card)]"
      style={{ boxShadow: right ? "inset 0 0 0 2.5px var(--p-mint), var(--p-shadow)" : "var(--p-shadow)" }}
    >
      <img src={src} alt="" draggable={false} className="h-[74%] w-[74%] object-contain" />
    </span>
  );
}

/**
 * «Ortiqchasini top»: 2×2 karta — uchta meva va bitta mashina; mashina
 * «topilgan» (yashil halqa, biroz ko'tarilgan). Yonida o'yindagi izoh.
 */
export function OddBanner() {
  const tr = useTr();
  const [apple, banana, grapes, car] = ["apple", "banana", "grapes", "car"].map((id) => findItem(id)!);
  return (
    <Backdrop tone="lilac">
      <div className="absolute left-5 top-1/2 grid -translate-y-1/2 -rotate-[3deg] grid-cols-2 gap-2">
        <AnswerTile src={apple.image} />
        <AnswerTile src={banana.image} />
        <span className={styles.bob} style={{ animationDuration: "2.8s" }}>
          <span className="block -translate-y-1 rotate-[7deg]">
            <AnswerTile src={car.image} right />
          </span>
        </span>
        <AnswerTile src={grapes.image} />
      </div>

      {/* O'yindagi izoh: nega ortiqcha */}
      <div className="absolute right-4 top-1/2 flex max-w-[52%] -translate-y-1/2 flex-col items-end gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--p-card)] py-1 pl-1 pr-3 shadow-[var(--p-shadow)]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: TONE.lilac.soft }}>
            <img src={car.image} alt="" draggable={false} className="h-5 w-5 object-contain" />
          </span>
          <span className="truncate text-[13px] font-extrabold text-[var(--p-ink)]">
            {tr(car.name)} — {tr("transport")}
          </span>
        </span>
        <span className="truncate rounded-full bg-[var(--p-card)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--p-muted)] shadow-[var(--p-shadow)]">
          {tr("Qolganlari — {0}", tr("mevalar"))}
        </span>
      </div>
    </Backdrop>
  );
}

export const GAME_BANNERS: Record<string, () => React.JSX.Element> = {
  "juftini-top": MemoryBanner,
  "kim-qichqirdi": SoundBanner,
  ortiqcha: OddBanner,
};
