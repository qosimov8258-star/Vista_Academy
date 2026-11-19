"use client";

import clsx from "clsx";
import { ArrowRight, Volume2 } from "lucide-react";
import styles from "./oyinlar.module.css";
import { SOUND_ANIMALS, TOPICS, asPhoto, findItem, playItems } from "./data";
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
  const [cat, lion, apple] = ["cat", "lion", "cherries"].map((id) => asPhoto(findItem(id)!));
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
              <img src={playItems(topic)[0]?.image} alt="" draggable={false} className="h-6 w-6 object-contain" />
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

function AnswerTile({ src, right, size = 52, className }: { src: string; right?: boolean; size?: number; className?: string }) {
  return (
    <span
      className={clsx("flex shrink-0 items-center justify-center rounded-[14px] bg-[var(--p-card)]", className)}
      style={{ width: size, height: size, boxShadow: right ? "inset 0 0 0 2.5px var(--p-mint), var(--p-shadow)" : "var(--p-shadow)" }}
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

/* ------------------------------------------------------------------------ */
/* Mantiqiy o'yinlar (mantiq/)                                               */
/* ------------------------------------------------------------------------ */

/** Uzuq chiziqli bo'sh katakcha — o'yindagi «?» va raqamli katakchalar kabi */
function EmptySlot({ tone, size, children }: { tone: keyof typeof TONE; size: number; children?: React.ReactNode }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-[14px] border-[2.5px] border-dashed font-extrabold"
      style={{ width: size, height: size, borderColor: TONE[tone].solid, color: TONE[tone].ink, background: TONE[tone].soft, fontSize: size * 0.42 }}
    >
      {children}
    </span>
  );
}

/** «Nima keyin keladi?»: olma, sabzi, olma, sabzi, olma, «?» — sabzi «?» ga uchib kelyapti */
export function PatternBanner() {
  const [apple, carrot] = ["apple", "carrot"].map((id) => findItem(id)!);
  return (
    <Backdrop tone="sky">
      <div className="absolute inset-x-0 top-[62%] flex -translate-y-1/2 items-center justify-center gap-1.5">
        {[apple, carrot, apple, carrot, apple].map((item, i) => (
          <AnswerTile key={i} src={item.image} size={44} />
        ))}
        <EmptySlot tone="sky" size={44}>
          ?
          <span className={clsx(styles.bob, "absolute -top-[58px] left-1/2 -ml-[22px]")} style={{ animationDuration: "2.4s" }}>
            <AnswerTile src={carrot.image} size={44} right />
          </span>
        </EmptySlot>
      </div>
    </Backdrop>
  );
}

/** «Soyasini top»: chapda rangli mushuk, o'ngda soyalar — mushukniki topilgan */
export function ShadowBanner() {
  const [cat, rabbit, horse, duck] = ["cat", "rabbit", "horse", "duck"].map((id) => findItem(id)!);
  return (
    <Backdrop tone="lilac">
      <div className="absolute inset-0 flex items-center justify-center gap-4">
        <span className={styles.bob} style={{ animationDuration: "2.8s" }}>
          <AnswerTile src={cat.image} size={84} />
        </span>
        <ArrowRight className="h-6 w-6 shrink-0 text-[var(--p-muted)]" strokeWidth={2.4} aria-hidden="true" />
        <div className="grid grid-cols-2 gap-2">
          <AnswerTile src={rabbit.image} size={50} className={styles.silhouette} />
          <AnswerTile src={cat.image} size={50} className={styles.silhouette} right />
          <AnswerTile src={horse.image} size={50} className={styles.silhouette} />
          <AnswerTile src={duck.image} size={50} className={styles.silhouette} />
        </div>
      </div>
    </Backdrop>
  );
}

/** «Kichikdan kattaga»: to'rtta yulduz kichikdan kattaga, ostida tartib raqami */
export function SizeBanner() {
  const star = findItem("star")!;
  const sizes = [34, 46, 60, 76];
  return (
    <Backdrop tone="sun">
      <div className="absolute inset-0 flex items-end justify-center gap-2.5 pb-5">
        {sizes.map((size, i) => (
          <span key={size} className="flex flex-col items-center gap-1.5">
            <AnswerTile src={star.image} size={size} right={i === sizes.length - 1} />
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-extrabold tabular-nums"
              style={{ background: TONE.sun.soft, color: TONE.sun.ink }}
            >
              {i + 1}
            </span>
          </span>
        ))}
      </div>
    </Backdrop>
  );
}

/** «Kim nima yeydi?»: quyon → sabzi (topilgan), maymun → banan */
export function FoodBanner() {
  const pairs = [
    ["rabbit", "carrot"],
    ["monkey", "banana"],
  ].map(([animal, food]) => [findItem(animal)!, findItem(food)!] as const);
  return (
    <Backdrop tone="mint">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
        {pairs.map(([animal, food], i) => (
          <span key={animal.id} className="flex items-center gap-3">
            <AnswerTile src={animal.image} size={56} />
            <ArrowRight className="h-5 w-5 shrink-0 text-[var(--p-muted)]" strokeWidth={2.4} aria-hidden="true" />
            {i === 0 ? (
              <span className={styles.bob} style={{ animationDuration: "2.6s" }}>
                <AnswerTile src={food.image} size={56} right />
              </span>
            ) : (
              <EmptySlot tone="mint" size={56}>
                ?
              </EmptySlot>
            )}
          </span>
        ))}
      </div>
    </Backdrop>
  );
}

/** «Savatchaga ajrat»: o'rtada uzum, pastda «Mevalar» va «Sabzavotlar» savatchalari */
export function SortBanner() {
  const tr = useTr();
  const [grapes, apple, carrot] = ["grapes", "apple", "carrot"].map((id) => findItem(id)!);
  const baskets = [
    { name: "Mevalar", icon: apple },
    { name: "Sabzavotlar", icon: carrot },
  ];
  return (
    <Backdrop tone="coral">
      <span className={clsx(styles.bob, "absolute left-1/2 top-3 -ml-[25px]")} style={{ animationDuration: "2.6s" }}>
        <AnswerTile src={grapes.image} size={50} />
      </span>
      <div className="absolute inset-x-0 bottom-3.5 flex justify-center gap-4">
        {baskets.map((basket) => (
          <span
            key={basket.name}
            className="flex h-[76px] w-[118px] flex-col items-center justify-center gap-1 rounded-[20px] bg-[var(--p-card)]"
            style={{ boxShadow: `inset 0 0 0 2.5px color-mix(in srgb, ${TONE.coral.solid} 30%, transparent), var(--p-shadow)` }}
          >
            <img src={basket.icon.image} alt="" draggable={false} className="h-8 w-8 object-contain" />
            <span className="max-w-full truncate px-2 text-[12.5px] font-extrabold text-[var(--p-ink)]">{tr(basket.name)}</span>
          </span>
        ))}
      </div>
    </Backdrop>
  );
}

/** Yashil halqali katakcha ichida raqam yoki harf — o'yindagi to'lgan javob kabi */
function AnswerMark({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex h-[56px] min-w-[56px] items-center justify-center rounded-[16px] bg-[var(--p-card)] px-2 text-[30px] font-extrabold leading-none"
      style={{ boxShadow: "inset 0 0 0 2.5px var(--p-mint), var(--p-shadow)", color: "color-mix(in srgb, var(--p-mint) 80%, var(--p-ink))" }}
    >
      {children}
    </span>
  );
}

/** «Nechta?»: uchta olma — har biri sanalgan (raqamli), yonida «= 3» */
export function CountBanner() {
  const apple = findItem("apple")!;
  return (
    <Backdrop tone="sky">
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2.5">
          {[1, 2, 3].map((n) => (
            <span key={n} className="relative">
              <AnswerTile src={apple.image} size={50} />
              <span
                className="absolute -right-2 -top-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[12.5px] font-extrabold tabular-nums text-white"
                style={{ background: TONE.sky.solid, boxShadow: "0 0 0 2px var(--p-card)" }}
              >
                {n}
              </span>
            </span>
          ))}
        </div>
        <span className="text-[26px] font-extrabold text-[var(--p-muted)]" aria-hidden="true">
          =
        </span>
        <span className={styles.bob} style={{ animationDuration: "2.6s" }}>
          <AnswerMark>3</AnswerMark>
        </span>
      </div>
    </Backdrop>
  );
}

/** «Qaysi harf?»: olma, yonida «O» katakchaga tushgan va «lma» */
export function LetterBanner() {
  const apple = findItem("apple")!;
  return (
    <Backdrop tone="lilac">
      <div className="absolute inset-0 flex items-center justify-center gap-5">
        <AnswerTile src={apple.image} size={84} />
        <span className="flex items-center gap-1.5">
          <span className={styles.bob} style={{ animationDuration: "2.6s" }}>
            <AnswerMark>O</AnswerMark>
          </span>
          <span className="text-[38px] font-extrabold leading-none text-[var(--p-ink)]">lma</span>
        </span>
      </div>
    </Backdrop>
  );
}

export const GAME_BANNERS: Record<string, () => React.JSX.Element> = {
  "juftini-top": MemoryBanner,
  "kim-qichqirdi": SoundBanner,
  ortiqcha: OddBanner,
  keyingisi: PatternBanner,
  "soyasini-top": ShadowBanner,
  "kichikdan-kattaga": SizeBanner,
  "kim-nima-yeydi": FoodBanner,
  savatcha: SortBanner,
  nechta: CountBanner,
  "qaysi-harf": LetterBanner,
};
