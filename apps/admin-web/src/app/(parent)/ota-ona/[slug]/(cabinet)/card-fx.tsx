import type { CSSProperties } from "react";
import styles from "../parent.module.css";

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

/** Uchqunlar — asosan bo'sh joylarda: o'ng yuqori burchak, o'ng chekka */
const SPARKLES = [
  { x: 86, y: 10, duration: 3.1, delay: 0 },
  { x: 94, y: 31, duration: 3.8, delay: 1.2 },
  { x: 64, y: 5, duration: 2.7, delay: 2.1 },
  { x: 5, y: 52, duration: 3.4, delay: 0.7 },
  { x: 97, y: 62, duration: 4.2, delay: 1.8 },
];

/** Bulutchalar — tepadan chapdan o'ngga suzadi */
const CLOUDS = [
  { y: 21, width: 46, duration: 52, delay: -18 },
  { y: 8, width: 30, duration: 74, delay: -40 },
];

/** Yog'dular: nafas olayotgan rangli dog'lar */
const BLOBS: Array<{ style: CSSProperties; size: number; color: string; duration: number; delay: number }> = [
  { style: { top: -80, right: -70 }, size: 250, color: "rgba(255, 183, 3, 0.34)", duration: 15, delay: 0 },
  { style: { bottom: -100, right: -80 }, size: 270, color: "rgba(86, 180, 245, 0.28)", duration: 19, delay: -6 },
  { style: { bottom: -90, left: -80 }, size: 240, color: "rgba(63, 191, 155, 0.26)", duration: 17, delay: -11 },
  { style: { top: "34%", left: -90 }, size: 200, color: "rgba(167, 139, 250, 0.18)", duration: 21, delay: -3 },
];

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

export function CardFx({ rainbow = false }: { rainbow?: boolean }) {
  return (
    <div className={styles.cardFx} aria-hidden="true">
      {BLOBS.map((b, i) => {
        const style: FxStyle = {
          ...b.style,
          width: b.size,
          height: b.size,
          "--c": b.color,
          "--d": `${b.duration}s`,
          "--delay": `${b.delay}s`,
        };
        return <span key={i} className={styles.blobFx} style={style} />;
      })}

      {/* Quyosh — o'ng yuqori burchakdan mo'ralaydi */}
      <svg viewBox="0 0 140 140" className={styles.sunFx}>
        <defs>
          <radialGradient id="cfx-sun">
            <stop offset="0" stopColor="#fff3c4" />
            <stop offset="0.7" stopColor="#ffd766" />
            <stop offset="1" stopColor="#ffc233" />
          </radialGradient>
        </defs>
        <g className={styles.sunRaysFx} stroke="#ffd25e" strokeWidth="5" strokeLinecap="round">
          {SUN_RAYS.map((r, i) => (
            <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
          ))}
        </g>
        <circle className={styles.sunDiscFx} cx="70" cy="70" r="40" fill="url(#cfx-sun)" />
      </svg>

      {/* Kamalak — bola rasmi ortida chizilib chiqadi */}
      {rainbow && (
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
        const style: FxStyle = { "--y": `${c.y}%`, "--w": `${c.width}px`, "--d": `${c.duration}s`, "--delay": `${c.delay}s` };
        return (
          <svg key={i} viewBox="0 0 64 34" className={styles.cloudFx} style={style}>
            <ellipse cx="32" cy="26" rx="28" ry="8" fill="#fff" />
            <circle cx="20" cy="20" r="11" fill="#fff" />
            <circle cx="34" cy="14" r="14" fill="#fff" />
            <circle cx="48" cy="21" r="10" fill="#fff" />
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

      {SPARKLES.map((s, i) => {
        const style: FxStyle = { "--x": `${s.x}%`, "--y": `${s.y}%`, "--d": `${s.duration}s`, "--delay": `${s.delay}s` };
        return (
          <svg key={i} viewBox="0 0 24 24" className={styles.sparkleFx} style={style}>
            <path d="M12 0c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12z" fill="#ffe08a" />
          </svg>
        );
      })}

      {/* Vaqti-vaqti bilan o'tadigan yaltiroq */}
      <span className={styles.shineFx} />
    </div>
  );
}
