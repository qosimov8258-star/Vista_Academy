"use client";

import { useId, type CSSProperties } from "react";
import type { SkyPhase, SkyState } from "@/lib/sky";
import styles from "../parent.module.css";
import { useCabinetTheme } from "./theme";

/** CSS o'zgaruvchilari (`--x`) bilan to'ldirilgan uslub — React tiplari ularni bilmaydi. */
type FxStyle = CSSProperties & Record<`--${string}`, string | number>;

/**
 * Bola kartochkasi orqasidagi jonli osmon.
 *
 * Ota-ona kabinetni kuniga bir marta, telefonda ochadi — birinchi ko'rgan
 * narsasi shu karta. Shuning uchun u tekis rangli to'rtburchak emas, kichik
 * bog'cha manzarasi: nafas olayotgan rangli yog'dular, burchakda nurlari
 * aylanayotgan quyosh, suzib o'tuvchi bulutchalar, bola rasmi ortida
 * chizilib chiqadigan kamalak, pastdan ko'tarilayotgan sharlar, yulduzcha
 * va yurakchalar, miltillovchi uchqunlar.
 *
 * Osmon haqiqiy vaqtga ergashadi (qarang: lib/sky.ts): kunduzi quyosh,
 * quyosh botishi atrofida shafaq ranglari, tunda esa quyosh o'rniga oy —
 * fazasi osmondagi oy bilan bir xil — yulduzlar va uchar yulduz.
 *
 * Hammasi faqat `transform` va `opacity` bilan harakatlanadi (GPU'da yengil),
 * `filter: blur` yo'q — yog'dular radial gradient bilan yumshatilgan.
 * Ko'tariluvchi narsalar karta balandligiga `cqh` orqali bog'langan, shuning
 * uchun karta qancha baland bo'lsa ham pastdan kirib tepadan chiqadi.
 * Matn ustida o'qilishga xalaqit bermasligi uchun ranglar pastel va shaffof.
 */

type FloaterKind = "balloon" | "star" | "heart" | "bubble";

interface Floater {
  kind: FloaterKind;
  /** Chapdan foizda */
  x: number;
  size: number;
  /** Ko'tarilish davomiyligi (s) */
  duration: number;
  /** Manfiy — yuklanganda allaqachon yo'lda bo'lsin */
  delay: number;
  color: string;
  opacity: number;
  sway: number;
  spin?: number;
}

const FLOATERS: Floater[] = [
  { kind: "balloon", x: 7, size: 17, duration: 23, delay: -4, color: "#ff8fa3", opacity: 0.6, sway: 14 },
  { kind: "star", x: 21, size: 11, duration: 17, delay: -9, color: "#ffc94a", opacity: 0.65, sway: 10, spin: 40 },
  { kind: "heart", x: 33, size: 12, duration: 19, delay: -14, color: "#ff7a66", opacity: 0.5, sway: 12 },
  { kind: "bubble", x: 45, size: 10, duration: 15, delay: -5, color: "#56b4f5", opacity: 0.5, sway: 8 },
  { kind: "balloon", x: 57, size: 15, duration: 25, delay: -17, color: "#7ad3ff", opacity: 0.55, sway: 16 },
  { kind: "star", x: 69, size: 9, duration: 16, delay: -1, color: "#a78bfa", opacity: 0.6, sway: 9, spin: -30 },
  { kind: "bubble", x: 79, size: 13, duration: 20, delay: -11, color: "#3fbf9b", opacity: 0.45, sway: 10 },
  { kind: "heart", x: 89, size: 10, duration: 18, delay: -7, color: "#ff8fc0", opacity: 0.55, sway: 11 },
  { kind: "balloon", x: 40, size: 13, duration: 27, delay: -21, color: "#ffd166", opacity: 0.55, sway: 12 },
  { kind: "star", x: 94, size: 12, duration: 21, delay: -15, color: "#ffc94a", opacity: 0.55, sway: 8, spin: 25 },
  { kind: "bubble", x: 15, size: 7, duration: 14, delay: -12, color: "#a78bfa", opacity: 0.45, sway: 6 },
  { kind: "heart", x: 62, size: 9, duration: 23, delay: -19, color: "#ff7a66", opacity: 0.45, sway: 10 },
];

/** Kunduzgi uchqunlar — asosan bo'sh joylarda: o'ng yuqori burchak, o'ng chekka */
const SPARKLES = [
  { x: 86, y: 10, duration: 3.1, delay: 0 },
  { x: 94, y: 31, duration: 3.8, delay: 1.2 },
  { x: 64, y: 5, duration: 2.7, delay: 2.1 },
  { x: 5, y: 52, duration: 3.4, delay: 0.7 },
  { x: 97, y: 62, duration: 4.2, delay: 1.8 },
];

/** Tungi yulduzlar — bola rasmi va ismi yopmaydigan joylarda */
const STARS = [
  { x: 3, y: 5, size: 9, duration: 2.8, delay: 0.2 },
  { x: 14, y: 2, size: 6, duration: 3.4, delay: 1.1 },
  { x: 27, y: 6, size: 7, duration: 2.6, delay: 0.6 },
  { x: 41, y: 2, size: 10, duration: 3.9, delay: 1.7 },
  { x: 55, y: 8, size: 6, duration: 3.1, delay: 0.9 },
  { x: 66, y: 3, size: 8, duration: 2.9, delay: 2.2 },
  { x: 72, y: 14, size: 6, duration: 3.6, delay: 1.4 },
  { x: 30, y: 29, size: 7, duration: 3.3, delay: 2.6 },
  { x: 3, y: 47, size: 8, duration: 2.7, delay: 0.4 },
  { x: 96, y: 40, size: 9, duration: 3.8, delay: 1.9 },
  { x: 50, y: 40, size: 6, duration: 3.2, delay: 2.9 },
  { x: 97, y: 66, size: 7, duration: 2.5, delay: 1.3 },
];

/** Bulutchalar — tepadan chapdan o'ngga suzadi */
const CLOUDS = [
  { y: 21, width: 46, duration: 52, delay: -18 },
  { y: 8, width: 30, duration: 74, delay: -40 },
];

/** Yog'dular joyi va o'lchami; rangi osmon holatiga qarab */
const BLOBS: Array<{ style: CSSProperties; size: number; duration: number; delay: number }> = [
  { style: { top: -80, right: -70 }, size: 250, duration: 15, delay: 0 },
  { style: { bottom: -100, right: -80 }, size: 270, duration: 19, delay: -6 },
  { style: { bottom: -90, left: -80 }, size: 240, duration: 17, delay: -11 },
  { style: { top: "34%", left: -90 }, size: 200, duration: 21, delay: -3 },
];

/**
 * Osmon holatiga qarab ranglar: kunduz iliq, shafaqda qizg'ish, tunda ko'kimtir.
 * Tagfon va bulutlar ko'rinish rejimiga (yorug'/qorong'i) ham bog'liq —
 * qorong'ida karta to'q, bulutlar esa shaffof oq.
 */
const PALETTE: Record<
  SkyPhase,
  {
    base: [light: string, dark: string];
    blobs: [string, string, string, string];
    cloud: [light: string, dark: string];
    cloudOpacity: [light: number, dark: number];
  }
> = {
  kun: {
    base: ["linear-gradient(168deg, #fffbf3 0%, #ffffff 60%)", "linear-gradient(168deg, #2d2b4a 0%, #272541 60%)"],
    blobs: ["rgba(255, 183, 3, 0.34)", "rgba(86, 180, 245, 0.28)", "rgba(63, 191, 155, 0.26)", "rgba(167, 139, 250, 0.18)"],
    cloud: ["#ffffff", "#ffffff"],
    cloudOpacity: [0.9, 0.14],
  },
  shafaq: {
    base: ["linear-gradient(168deg, #fff3e4 0%, #ffffff 60%)", "linear-gradient(168deg, #3a2c47 0%, #272541 60%)"],
    blobs: ["rgba(255, 140, 80, 0.36)", "rgba(255, 122, 102, 0.26)", "rgba(255, 183, 3, 0.28)", "rgba(196, 150, 255, 0.22)"],
    cloud: ["#fff1ec", "#ffd9cf"],
    cloudOpacity: [0.95, 0.16],
  },
  tun: {
    base: ["linear-gradient(168deg, #f2f1ff 0%, #ffffff 62%)", "linear-gradient(168deg, #232752 0%, #272541 62%)"],
    blobs: ["rgba(99, 102, 241, 0.24)", "rgba(56, 120, 220, 0.22)", "rgba(63, 191, 155, 0.14)", "rgba(167, 139, 250, 0.26)"],
    cloud: ["#eef0ff", "#ffffff"],
    cloudOpacity: [0.7, 0.1],
  },
};

const RAINBOW = ["#ff8fa3", "#ffb703", "#ffe66d", "#8ce99a", "#74c0fc", "#b197fc"];

/** Server va brauzer trigonometriyasi oxirgi raqamda farq qilmasligi uchun. */
const fixed = (v: number) => v.toFixed(2);

/**
 * Kamalak yoyi: bola rasmining markazi atrofida, chapdan (175°) tepa orqali
 * o'ng-yuqoriga (315°). To'liq yarim doira emas — o'ng uchi bolaning ismiga
 * yetib bormasin.
 */
function rainbowArc(r: number): string {
  const cx = 66;
  const cy = 66;
  const a1 = (175 * Math.PI) / 180;
  const a2 = (315 * Math.PI) / 180;
  const x1 = fixed(cx + r * Math.cos(a1));
  const y1 = fixed(cy + r * Math.sin(a1));
  const x2 = fixed(cx + r * Math.cos(a2));
  const y2 = fixed(cy + r * Math.sin(a2));
  return `M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}`;
}

const SUN_RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  return {
    x1: fixed(70 + 50 * Math.cos(a)),
    y1: fixed(70 + 50 * Math.sin(a)),
    x2: fixed(70 + 64 * Math.cos(a)),
    y2: fixed(70 + 64 * Math.sin(a)),
  };
});

/**
 * Oyning yorug' qismi. Faza 0 — yangi oy, 0.5 — to'lin oy, 1 — yana yangi oy.
 * O'sayotgan oyning o'ng tomoni, kamayayotganining chap tomoni yorug'
 * (shimoliy yarim shar). Yorug' qism ikki yoydan iborat: oyning tashqi
 * chekkasi va soya chegarasi (terminator) — u ellips yoyi bo'lib, yarim o'qi
 * fazaga qarab o'zgaradi.
 */
function moonLitPath(phase: number, cx: number, cy: number, r: number): string {
  // Yangi oyga juda yaqin faza ko'rinmas hilol beradi — ozgina cheklaymiz
  const p = Math.min(0.91, Math.max(0.09, phase));
  const litRight = p <= 0.5;
  const c = r * Math.cos(2 * Math.PI * p);
  // SVG'da (y pastga) sweep=1 — soat yo'nalishida. Tashqi chekka tepadan
  // pastga: o'ng tomondan o'tsa soat yo'nalishi, chapdan o'tsa teskarisi.
  const outerSweep = litRight ? 1 : 0;
  // Terminator pastdan tepaga qaytadi. U yorug' tomonga bo'rtib chiqsa
  // (hilol) — bir yo'nalish, qarama-qarshi tomonga (do'ngayma) — teskarisi.
  const bulgeRight = litRight === c > 0;
  const termSweep = bulgeRight ? 0 : 1;
  const rx = Math.max(0.01, Math.abs(c));
  return `M${cx} ${cy - r}A${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r}A${fixed(rx)} ${r} 0 0 ${termSweep} ${cx} ${cy - r}`;
}

function FloaterShape({ kind, color }: { kind: FloaterKind; color: string }) {
  switch (kind) {
    case "balloon":
      return (
        <svg viewBox="0 0 24 40" className="h-full w-full" aria-hidden="true">
          <ellipse cx="12" cy="11" rx="9" ry="11" fill={color} />
          <ellipse cx="8.6" cy="7" rx="2.4" ry="3.4" fill="#fff" opacity="0.5" />
          <path d="M10.3 22.4 12 20.6l1.7 1.8z" fill={color} />
          <path
            d="M12 22.6c2.2 3-2.2 6 0 9 1.6 2.2-1.4 4.6 0 7.6"
            stroke="#9aa0a6"
            strokeWidth="0.9"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" fill={color} />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <path
            d="M12 21s-7-4.6-9.3-8.6C.9 9.2 2.4 5.5 5.9 5c2-.3 3.9.7 5 2.3 1.1-1.6 3-2.6 5-2.3 3.5.5 5 4.2 3.2 7.4C19 16.4 12 21 12 21z"
            fill={color}
          />
        </svg>
      );
    case "bubble":
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.6" />
          <circle cx="8.6" cy="8.2" r="2.2" fill="#fff" opacity="0.75" />
        </svg>
      );
  }
}

const SPARKLE_PATH = "M12 0c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12z";

function Sun({ phase }: { phase: SkyPhase }) {
  const dusk = phase === "shafaq";
  return (
    // Shafaqda quyosh pastroq va qizg'ish — botayotgandek
    <svg viewBox="0 0 140 140" className={styles.sunFx} style={dusk ? { top: -14 } : undefined}>
      <defs>
        <radialGradient id="cfx-sun">
          <stop offset="0" stopColor={dusk ? "#fff0c0" : "#fff3c4"} />
          <stop offset="0.7" stopColor={dusk ? "#ffb457" : "#ffd766"} />
          <stop offset="1" stopColor={dusk ? "#ff8a5b" : "#ffc233"} />
        </radialGradient>
      </defs>
      <g className={styles.sunRaysFx} stroke={dusk ? "#ffb27a" : "#ffd25e"} strokeWidth="5" strokeLinecap="round">
        {SUN_RAYS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      <circle className={styles.sunDiscFx} cx="70" cy="70" r="40" fill="url(#cfx-sun)" />
    </svg>
  );
}

const MOON_CX = 70;
const MOON_CY = 68;
const MOON_R = 35;

/**
 * Oy dengizlari — Yerdan ko'rinadigan yuzidagi qora dog'lar, haqiqiy
 * joylashuvi bo'yicha (shimol tepada). Koordinatalar oy markaziga nisbatan,
 * radius birligida. Bir-birini qoplagan ellipslar xiralashtirilgach notekis,
 * tabiiy dog'larga aylanadi.
 */
const MARIA: ReadonlyArray<{ x: number; y: number; rx: number; ry: number; rot: number; o: number }> = [
  // Bo'ronlar okeani — chap tomondagi katta, notekis dog'
  { x: -0.58, y: -0.05, rx: 0.26, ry: 0.42, rot: 10, o: 0.6 },
  { x: -0.7, y: 0.22, rx: 0.15, ry: 0.2, rot: 0, o: 0.55 },
  { x: -0.42, y: 0.14, rx: 0.14, ry: 0.18, rot: -20, o: 0.52 },
  // Yomg'irlar dengizi
  { x: -0.28, y: -0.38, rx: 0.27, ry: 0.23, rot: -12, o: 0.68 },
  // Tiniqlik dengizi
  { x: 0.18, y: -0.36, rx: 0.17, ry: 0.16, rot: 0, o: 0.7 },
  // Sokinlik dengizi
  { x: 0.3, y: -0.06, rx: 0.2, ry: 0.16, rot: 22, o: 0.66 },
  // Inqirozlar dengizi
  { x: 0.68, y: -0.27, rx: 0.13, ry: 0.1, rot: -8, o: 0.72 },
  // Serhosillik va Nektar dengizlari
  { x: 0.5, y: 0.2, rx: 0.11, ry: 0.17, rot: -15, o: 0.58 },
  { x: 0.28, y: 0.3, rx: 0.1, ry: 0.08, rot: 0, o: 0.52 },
  // Bulutlar va Namlik dengizlari
  { x: -0.2, y: 0.36, rx: 0.17, ry: 0.12, rot: 12, o: 0.54 },
  { x: -0.47, y: 0.42, rx: 0.09, ry: 0.08, rot: 0, o: 0.55 },
  // Sovuq dengizi — shimoldagi ingichka tasma
  { x: -0.04, y: -0.7, rx: 0.4, ry: 0.055, rot: 3, o: 0.48 },
  // Bug'lar dengizi
  { x: -0.02, y: -0.14, rx: 0.08, ry: 0.06, rot: 0, o: 0.5 },
];

/** Kraterlar. `bright` — atrofi oqargan yosh kraterlar (Tycho, Copernicus...). */
const CRATERS: ReadonlyArray<{ x: number; y: number; r: number; bright?: boolean; dark?: boolean }> = [
  { x: -0.1, y: 0.72, r: 0.055, bright: true }, // Tycho — nurlari bor
  { x: -0.26, y: -0.05, r: 0.06, bright: true }, // Copernicus
  { x: -0.52, y: -0.04, r: 0.035, bright: true }, // Kepler
  { x: -0.63, y: -0.3, r: 0.028, bright: true }, // Aristarchus — eng yorqini
  { x: -0.12, y: -0.66, r: 0.05, dark: true }, // Plato — tubi qorong'i
  { x: 0.8, y: 0.12, r: 0.05 }, // Langrenus
  { x: 0.12, y: 0.55, r: 0.045 },
  { x: 0.36, y: 0.6, r: 0.04 },
  { x: -0.42, y: 0.62, r: 0.04 },
  { x: 0.56, y: 0.48, r: 0.035 },
  { x: 0.05, y: 0.82, r: 0.035 },
  { x: -0.28, y: 0.84, r: 0.03 },
  { x: 0.62, y: -0.55, r: 0.035 },
  { x: 0.25, y: -0.62, r: 0.03 },
];

/** Tycho'dan tarqaladigan yorug' nurlar: burchak (°, 0 — o'ngga, -90 — tepaga) va uzunlik (r). */
const TYCHO_RAYS: ReadonlyArray<{ a: number; l: number }> = [
  { a: -95, l: 0.72 },
  { a: -72, l: 0.55 },
  { a: -48, l: 0.62 },
  { a: -122, l: 0.5 },
  { a: -150, l: 0.38 },
  { a: -22, l: 0.45 },
  { a: 18, l: 0.18 },
  { a: 165, l: 0.22 },
];

/**
 * Soyadagi qism uchun "Yer nuri": yangi oy atrofida oyning qorong'i qismi
 * ham xira ko'rinib turadi — Yerdan qaytgan yorug'lik. Qorong'i kartada
 * to'q ko'kimtir, yorug' kartada och siyohrang (oq fonda ko'rinsin).
 */
const EARTHSHINE = {
  dark: "0.24 0 0 0 0.02  0 0.26 0 0 0.03  0 0 0.34 0 0.09  0 0 0 1 0",
  light: "0.35 0 0 0 0.52  0 0.35 0 0 0.52  0 0 0.3 0 0.64  0 0 0 1 0",
};

/**
 * Realistik oy. Qatlamlar:
 * 1. Sirt — shar kabi soyalangan tagrang (yorug' tomonda yorqin, chekkada
 *    qorayadi), oy dengizlari, kraterlar va Tycho nurlari; ustidan
 *    `feTurbulence` + `feDiffuseLighting` bilan mayda relyef — quyosh
 *    tomondan yoritilgan notekisliklar.
 * 2. Shu sirt Yer nuri bilan xira bo'yalgan holda — butun disk.
 * 3. Shu sirt to'liq yorug'likda — faza niqobi orqali. Niqob chegarasi
 *    (terminator) xiralashtirilgan: haqiqiy oydagi kabi yorug'likdan
 *    qorong'ilikka silliq o'tadi. Tashqi chekkasi esa diskka kesilgani
 *    uchun tiniq qoladi.
 *
 * Hammasi statik: filtrlar bir marta chiziladi. Harakat (suzish, yog'du
 * nafasi) tashqi HTML qatlamlarda — telefon oyni har kadrda qayta
 * hisoblamaydi.
 */
function Moon({ phase, dark }: { phase: number; dark: boolean }) {
  // Filtr va niqob identifikatorlari sahifada yagona bo'lsin
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `moon${uid}${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  const p = Math.min(0.91, Math.max(0.09, phase));
  const litRight = p <= 0.5;
  const cos = Math.cos(2 * Math.PI * p);
  // 0 — yangi oy, 1 — to'lin oy
  const litFraction = (1 - cos) / 2;
  const lit = moonLitPath(phase, MOON_CX, MOON_CY, MOON_R);
  // Yorqinlik markazi yorug' tomonga siljiydi; to'lin oyda — o'rtada
  const shift = 8 * ((1 + cos) / 2);
  const shadeCx = `${fixed(50 + (litRight ? shift : -shift))}%`;
  // Hilol ingichka bo'lganda soya chegarasi kamroq xiralashadi — aks holda yo'qolib qoladi
  const blur = fixed(0.9 + 1.4 * (1 - Math.abs(cos)));
  // Relyef va kraterlar yorug'lik tushgan tomondan yoritiladi
  const azimuth = litRight ? 340 : 200;
  const craterFx = litRight ? 0.36 : 0.64;
  const X = (u: number) => fixed(MOON_CX + u * MOON_R);
  const Y = (v: number) => fixed(MOON_CY + v * MOON_R);
  const tycho = CRATERS[0];
  const glow: FxStyle = { "--glow": `rgba(255, 244, 210, ${fixed((dark ? 0.3 : 0.22) + 0.4 * litFraction)})` };

  return (
    <div className={styles.moonFx}>
      <span className={styles.moonGlowFx} style={glow} />
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <defs>
          <radialGradient id={id("shade")} cx={shadeCx} cy="44%" r="60%">
            <stop offset="0" stopColor="#fffbf1" />
            <stop offset="0.5" stopColor="#f4eddb" />
            <stop offset="0.82" stopColor="#dfd6c1" />
            <stop offset="1" stopColor="#c6bca6" />
          </radialGradient>
          {/* Krater kosasi: tubi qoramtir, yorug'lik tushgan ichki devori va qirrasi oqish */}
          <radialGradient id={id("crater")} fx={craterFx} fy="0.4">
            <stop offset="0" stopColor="#7f7768" stopOpacity="0.6" />
            <stop offset="0.6" stopColor="#9d9483" stopOpacity="0.4" />
            <stop offset="0.82" stopColor="#fffbf0" stopOpacity="0.8" />
            <stop offset="1" stopColor="#fffbf0" stopOpacity="0" />
          </radialGradient>
          <clipPath id={id("disc")}>
            <circle cx={MOON_CX} cy={MOON_CY} r={MOON_R} />
          </clipPath>
          <filter id={id("soft")} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.95" />
          </filter>
          <filter
            id={id("relief")}
            x="0"
            y="0"
            width="140"
            height="140"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            {/* Yirik dog'lar: tog'liklar ham bir tekis emas — yorug'lik qaytarishi joy-joyda farq qiladi */}
            <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves={3} seed={3} result="mottleNoise" />
            <feColorMatrix
              in="mottleNoise"
              type="matrix"
              values="0.36 0 0 0 0.8  0.36 0 0 0 0.8  0.36 0 0 0 0.8  0 0 0 0 1"
              result="mottle"
            />
            {/* Mayda relyef: quyosh tomondan yoritilgan notekisliklar — sezilar-sezilmas */}
            <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves={3} seed={7} result="noise" />
            <feDiffuseLighting in="noise" surfaceScale={0.55} diffuseConstant={1} lightingColor="#ffffff" result="light">
              <feDistantLight azimuth={azimuth} elevation={50} />
            </feDiffuseLighting>
            {/* Relyefni rang ustiga ko'paytiramiz — o'rtacha yorqinlik o'zgarmaydi */}
            <feComposite in="light" in2="SourceGraphic" operator="arithmetic" k1={0.35} k2={0} k3={0.73} k4={0} result="relief" />
            <feComposite in="relief" in2="mottle" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="tex" />
            <feComposite in="tex" in2="SourceGraphic" operator="in" />
          </filter>
          <filter id={id("earth")} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={dark ? EARTHSHINE.dark : EARTHSHINE.light} />
          </filter>
          <filter id={id("term")} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
          <mask id={id("phase")} maskUnits="userSpaceOnUse" x="0" y="0" width="140" height="140">
            <path d={lit} fill="#fff" filter={url("term")} />
          </mask>

          <g id={id("surface")} clipPath={url("disc")} filter={url("relief")}>
            <circle cx={MOON_CX} cy={MOON_CY} r={MOON_R} fill={url("shade")} />
            <g fill="#8c8677" filter={url("soft")}>
              {MARIA.map((m, i) => (
                <ellipse
                  key={i}
                  cx={X(m.x)}
                  cy={Y(m.y)}
                  rx={fixed(m.rx * MOON_R)}
                  ry={fixed(m.ry * MOON_R)}
                  opacity={m.o}
                  transform={`rotate(${m.rot} ${X(m.x)} ${Y(m.y)})`}
                />
              ))}
            </g>
            <g stroke="#fffaf0" strokeWidth="0.5" strokeLinecap="round" opacity="0.3">
              {TYCHO_RAYS.map((ray, i) => {
                const a = (ray.a * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    x1={X(tycho.x)}
                    y1={Y(tycho.y)}
                    x2={X(tycho.x + Math.cos(a) * ray.l)}
                    y2={Y(tycho.y + Math.sin(a) * ray.l)}
                  />
                );
              })}
            </g>
            {CRATERS.map((c, i) => (
              <g key={i}>
                {c.bright && (
                  <circle cx={X(c.x)} cy={Y(c.y)} r={fixed(c.r * MOON_R * 1.9)} fill="#fffdf4" opacity="0.55" filter={url("soft")} />
                )}
                <circle
                  cx={X(c.x)}
                  cy={Y(c.y)}
                  r={fixed(c.r * MOON_R)}
                  fill={c.dark ? "#8d8676" : url("crater")}
                  opacity={c.dark ? 0.6 : 1}
                />
              </g>
            ))}
          </g>
        </defs>

        {/* Soyadagi qism — Yer nuri */}
        <use href={`#${id("surface")}`} filter={url("earth")} />
        {/* Yorug' qism — faza niqobi orqali */}
        <use href={`#${id("surface")}`} mask={url("phase")} />
        {/* Yorug' kartada disk chegarasi yo'qolib ketmasin */}
        {!dark && (
          <circle cx={MOON_CX} cy={MOON_CY} r={MOON_R + 0.3} fill="none" stroke="rgba(110, 100, 170, 0.22)" strokeWidth="0.8" />
        )}
      </svg>
    </div>
  );
}

export function CardFx({ rainbow = false, sky }: { rainbow?: boolean; sky: SkyState | null }) {
  const { dark } = useCabinetTheme();
  const phase: SkyPhase = sky?.phase ?? "kun";
  const palette = PALETTE[phase];
  const night = phase === "tun";
  const mode = dark ? 1 : 0;
  // Qorong'i kartada yaltiroq xiraroq bo'lsin
  const rootStyle: FxStyle = { "--p-shine": dark ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.55)" };

  return (
    <div className={styles.cardFx} data-sky={phase} style={rootStyle} aria-hidden="true">
      <span className={styles.baseFx} style={{ background: palette.base[mode] }} />
      {night && (
        <span
          className={styles.nightBandFx}
          style={dark ? { background: "radial-gradient(120% 70% at 50% -20%, rgba(120, 110, 255, 0.24) 0%, transparent 60%)" } : undefined}
        />
      )}

      {BLOBS.map((b, i) => {
        const style: FxStyle = {
          ...b.style,
          width: b.size,
          height: b.size,
          "--c": palette.blobs[i],
          "--d": `${b.duration}s`,
          "--delay": `${b.delay}s`,
        };
        return <span key={i} className={styles.blobFx} style={style} />;
      })}

      {/* Quyosh yoki oy — o'ng yuqori burchakdan mo'ralaydi */}
      {sky && (night ? <Moon phase={sky.moonPhase} dark={dark} /> : <Sun phase={phase} />)}

      {/* Kamalak — bola rasmi ortida chizilib chiqadi (tunda kamalak bo'lmaydi) */}
      {rainbow && !night && (
        <svg viewBox="0 0 132 132" className={styles.rainbowFx}>
          {RAINBOW.map((color, i) => (
            <path
              key={color}
              className={styles.rainbowArcFx}
              style={{ animationDelay: `${0.5 + i * 0.09}s` }}
              d={rainbowArc(60 - i * 4)}
              pathLength={1}
              stroke={color}
              strokeWidth="3.6"
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </svg>
      )}

      {CLOUDS.map((c, i) => {
        const style: FxStyle = {
          "--y": `${c.y}%`,
          "--w": `${c.width}px`,
          "--d": `${c.duration}s`,
          "--delay": `${c.delay}s`,
          opacity: palette.cloudOpacity[mode],
        };
        return (
          <svg key={i} viewBox="0 0 64 34" className={styles.cloudFx} style={style} fill={palette.cloud[mode]}>
            <ellipse cx="32" cy="26" rx="28" ry="8" />
            <circle cx="20" cy="20" r="11" />
            <circle cx="34" cy="14" r="14" />
            <circle cx="48" cy="21" r="10" />
          </svg>
        );
      })}

      {FLOATERS.map((f, i) => {
        const style: FxStyle = {
          "--x": `${f.x}%`,
          "--s": `${f.size}px`,
          "--h": `${f.kind === "balloon" ? Math.round(f.size * 1.7) : f.size}px`,
          "--d": `${f.duration}s`,
          "--delay": `${f.delay}s`,
          "--o": f.opacity,
          "--sway": `${f.sway}px`,
          "--spin": `${f.spin ?? 0}deg`,
          "--sd": `${2.6 + (i % 4) * 0.5}s`,
        };
        return (
          <span key={i} className={styles.floaterFx} style={style}>
            <span className={styles.swayFx}>
              <FloaterShape kind={f.kind} color={f.color} />
            </span>
          </span>
        );
      })}

      {night
        ? STARS.map((s, i) => {
            const style: FxStyle = {
              "--x": `${s.x}%`,
              "--y": `${s.y}%`,
              "--s": `${s.size}px`,
              "--d": `${s.duration}s`,
              "--delay": `${s.delay}s`,
            };
            return (
              <svg key={i} viewBox="0 0 24 24" className={styles.starFx} style={style}>
                <path d={SPARKLE_PATH} fill="#ffd76a" />
              </svg>
            );
          })
        : SPARKLES.map((s, i) => {
            const style: FxStyle = { "--x": `${s.x}%`, "--y": `${s.y}%`, "--d": `${s.duration}s`, "--delay": `${s.delay}s` };
            return (
              <svg key={i} viewBox="0 0 24 24" className={styles.sparkleFx} style={style}>
                <path d={SPARKLE_PATH} fill="#ffe08a" />
              </svg>
            );
          })}

      {/* Tunda vaqti-vaqti bilan uchar yulduz o'tadi */}
      {night && <span className={styles.shootFx} />}

      {/* Vaqti-vaqti bilan o'tadigan yaltiroq */}
      <span className={styles.shineFx} />
    </div>
  );
}
