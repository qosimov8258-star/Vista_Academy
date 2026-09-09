import type { CSSProperties } from "react";
import styles from "./kindergarten-scene.module.css";

/**
 * Kirish sahifasi uchun jonli bog'cha hovlisi: quyosh, bulutlar, kamalak,
 * daraxtdagi arg'imchoq, tarozi-arg'imchoq, sirpanchiq, uchayotgan sharlar,
 * gullar va kapalak. Hammasi qo'lda chizilgan SVG — tashqi rasm yoki
 * kutubxona yo'q, animatsiyalar CSS'da (qarang: kindergarten-scene.module.css).
 *
 * Koordinatalar 1600×900 viewBox'da. Konteyner nisbati boshqacha bo'lsa
 * `slice` rejimida chetlari kesiladi — muhim narsalar markazda (x 280–1320).
 */

const SKIN = "#ffd6b0";
const GROUND_Y = 700;

/** Server va brauzer trigonometriyasi oxirgi raqamda farq qilmasligi uchun. */
const round2 = (v: number) => Math.round(v * 100) / 100;

const FLOWER_COLORS = {
  pink: { petal: "#ff8fc0", center: "#fff3c4" },
  yellow: { petal: "#ffd166", center: "#ff9f43" },
  blue: { petal: "#7ad3ff", center: "#ffffff" },
  lilac: { petal: "#c4b5fd", center: "#fff3c4" },
} as const;

type FlowerColor = keyof typeof FLOWER_COLORS;

function Flower({ x, height, color, delay }: { x: number; height: number; color: FlowerColor; delay: number }) {
  const { petal, center } = FLOWER_COLORS[color];
  const cy = GROUND_Y - height;
  const midY = GROUND_Y - height / 2;
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = ((i * 72 - 90) * Math.PI) / 180;
    return { cx: round2(x + 9 * Math.cos(angle)), cy: round2(cy + 9 * Math.sin(angle)) };
  });
  const style: CSSProperties = {
    transformOrigin: `${x}px ${GROUND_Y}px`,
    animationDelay: `${delay}s`,
    animationDuration: `${2.6 + (height % 7) * 0.15}s`,
  };
  return (
    <g className={styles.flower} style={style}>
      <line x1={x} y1={GROUND_Y} x2={x} y2={cy} stroke="#4aa957" strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={x + 8} cy={midY} rx={9} ry={4} fill="#4aa957" transform={`rotate(-35 ${x + 8} ${midY})`} />
      {petals.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={7} fill={petal} />
      ))}
      <circle cx={x} cy={cy} r={5} fill={center} />
    </g>
  );
}

/** O'tirgan bola: bosh (x, y) nuqtada, tanasi pastga, oyoqlari osilib turadi. */
function Kid({ x, y, shirt, hair, legs }: { x: number; y: number; shirt: string; hair: string; legs: string }) {
  return (
    <g>
      <rect x={x - 8} y={y + 34} width={7} height={18} rx={3.5} fill={legs} />
      <rect x={x + 1} y={y + 34} width={7} height={18} rx={3.5} fill={legs} />
      <circle cx={x - 4.5} cy={y + 53} r={4} fill="#4a3627" />
      <circle cx={x + 4.5} cy={y + 53} r={4} fill="#4a3627" />
      <rect x={x - 12} y={y + 10} width={24} height={26} rx={9} fill={shirt} />
      <circle cx={x} cy={y} r={12} fill={SKIN} />
      <path d={`M${x - 12} ${y - 1} a12 12 0 0 1 24 0 q-12 -5 -24 0z`} fill={hair} />
      <circle cx={x - 4} cy={y + 1.5} r={1.4} fill="#4a3627" />
      <circle cx={x + 4} cy={y + 1.5} r={1.4} fill="#4a3627" />
      <path d={`M${x - 3} ${y + 6} q3 3 6 0`} stroke="#c2410c" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

function GrassTuft({ x, y = GROUND_Y, scale = 1 }: { x: number; y?: number; scale?: number }) {
  return (
    <path
      d={`M${x} ${y} q3 -12 6 0 M${x + 6} ${y} q3 -16 6 0 M${x + 12} ${y} q3 -10 6 0`}
      stroke="#5fb56a"
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
      transform={scale === 1 ? undefined : `translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`}
    />
  );
}

/** Maysadagi mayda romashka — old plandagi bo'sh joyni to'ldiradi. */
function Daisy({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {Array.from({ length: 5 }, (_, i) => {
        const angle = ((i * 72 - 90) * Math.PI) / 180;
        return <circle key={i} cx={round2(x + 4.5 * Math.cos(angle))} cy={round2(y + 4.5 * Math.sin(angle))} r={3.4} fill="#fff" />;
      })}
      <circle cx={x} cy={y} r={2.6} fill="#ffd166" />
    </g>
  );
}

const SPARKLE_PATH = "M0 -9 Q0 0 9 0 Q0 0 0 9 Q0 0 -9 0 Q0 0 0 -9 Z";

/* Uy peshtoqidagi lavha: nom uzunligiga qarab kengayadi, devor kengligidan chiqmaydi */
const SIGN_FONT_SIZE = 13;
const SIGN_MIN_WIDTH = 100;
const SIGN_MAX_WIDTH = 256;
const SIGN_PADDING = 28;

function signMetrics(label: string) {
  // Qalin katta harflar o'rtacha ~0.72em (harf oralig'i bilan) joy oladi
  const estimated = label.length * SIGN_FONT_SIZE * 0.72 + SIGN_PADDING;
  const width = Math.min(SIGN_MAX_WIDTH, Math.max(SIGN_MIN_WIDTH, Math.round(estimated)));
  // Juda uzun nom lavhaga sig'masa, brauzer harflarni siqib joylashtiradi
  const textLength = estimated > SIGN_MAX_WIDTH ? SIGN_MAX_WIDTH - SIGN_PADDING + 4 : undefined;
  return { width, textLength };
}

const CLOUDS = [
  { width: 240, y: 56, x: 120, duration: 110, delay: -30, opacity: 1 },
  { width: 170, y: 190, x: 1180, duration: 140, delay: -95, opacity: 0.95 },
  { width: 300, y: 112, x: 760, duration: 170, delay: -60, opacity: 0.85 },
  { width: 140, y: 300, x: 1000, duration: 125, delay: -15, opacity: 0.9 },
];

const BALLOONS = [
  { x: 300, color: "#ff8fa3", duration: 26, delay: -6 },
  { x: 690, color: "#ffd166", duration: 32, delay: -18 },
  { x: 1330, color: "#7ad3ff", duration: 29, delay: -24 },
];

const RAINBOW = ["#ff8fa3", "#ffb703", "#ffe66d", "#8ce99a", "#74c0fc", "#b197fc"];

const RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 30 * Math.PI) / 180;
  return {
    x1: round2(560 + 74 * Math.cos(angle)),
    y1: round2(150 + 74 * Math.sin(angle)),
    x2: round2(560 + 106 * Math.cos(angle)),
    y2: round2(150 + 106 * Math.sin(angle)),
  };
});

interface KindergartenSceneProps {
  className?: string;
  /** Uy peshtoqidagi lavha matni — tashkilot nomi. Hali yuklanmagan bo'lsa lavha bo'sh turadi. */
  name?: string | null;
}

export function KindergartenScene({ className, name }: KindergartenSceneProps) {
  const signLabel = name ? name.toUpperCase() : null;
  const sign = signMetrics(signLabel ?? "BOG'CHA");
  return (
    <svg
      className={[styles.scene, className].filter(Boolean).join(" ")}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="kg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9e6ff" />
          <stop offset="0.55" stopColor="#e6f3ff" />
          <stop offset="1" stopColor="#fff3dc" />
        </linearGradient>
        <linearGradient id="kg-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ad48e" />
          <stop offset="1" stopColor="#6dbd76" />
        </linearGradient>
        <radialGradient id="kg-glow">
          <stop offset="0" stopColor="#fff1b8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff1b8" stopOpacity="0" />
        </radialGradient>
        <symbol id="kg-cloud" viewBox="0 0 200 90">
          <ellipse cx="100" cy="66" rx="88" ry="22" fill="#fff" />
          <circle cx="60" cy="50" r="32" fill="#fff" />
          <circle cx="105" cy="38" r="40" fill="#fff" />
          <circle cx="150" cy="54" r="28" fill="#fff" />
        </symbol>
      </defs>

      {/* Osmon */}
      <rect width="1600" height="900" fill="url(#kg-sky)" />

      {/* Quyosh: nur halqasi aylanadi, yog'dusi nafas oladi */}
      <circle className={styles.glow} cx="560" cy="150" r="130" fill="url(#kg-glow)" />
      <g className={styles.rays} stroke="#ffd84d" strokeWidth="9" strokeLinecap="round">
        {RAYS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      <circle cx="560" cy="150" r="58" fill="#ffd166" />
      <circle cx="560" cy="150" r="48" fill="#ffdb7a" />
      <path d="M534 144 q8 -9 16 0" stroke="#e9a23b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M570 144 q8 -9 16 0" stroke="#e9a23b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M541 162 q19 17 38 0" stroke="#e9a23b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="529" cy="160" r="5.5" fill="#ffb4a2" opacity="0.75" />
      <circle cx="591" cy="160" r="5.5" fill="#ffb4a2" opacity="0.75" />

      {/* Yulduzchalar */}
      {[
        { x: 668, y: 78, delay: 0 },
        { x: 452, y: 222, delay: 0.9 },
        { x: 1160, y: 210, delay: 1.7 },
        { x: 1480, y: 90, delay: 0.5 },
      ].map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <path className={styles.sparkle} style={{ animationDelay: `${s.delay}s` }} d={SPARKLE_PATH} fill="#ffe08a" />
        </g>
      ))}

      {/* Bulutlar */}
      {CLOUDS.map((c, i) => (
        <use
          key={i}
          href="#kg-cloud"
          className={styles.cloud}
          x={c.x}
          y={c.y}
          width={c.width}
          height={c.width * 0.45}
          opacity={c.opacity}
          style={{ animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
        />
      ))}

      {/* Kamalak — yuklanganda tashqaridan ichkariga chiziladi */}
      {RAINBOW.map((color, i) => {
        const r = 470 - i * 15;
        return (
          <path
            key={color}
            className={styles.arc}
            style={{ animationDelay: `${0.35 + i * 0.08}s` }}
            d={`M${700 - r} 720 A${r} ${r} 0 0 1 ${700 + r} 720`}
            pathLength={1}
            stroke={color}
            strokeWidth={15}
            fill="none"
            opacity={0.6}
          />
        );
      })}

      {/* Qushlar galasi */}
      <g className={styles.flock}>
        {[
          [0, 0],
          [46, -16],
          [92, 6],
        ].map(([dx, dy], i) => (
          <g key={i} transform={`translate(${900 + dx} ${70 + dy})`}>
            <g className={styles.bird} style={{ animationDelay: `${-i * 0.4}s` }}>
              <path className={styles.wing} d="M-16 0 Q-8 -10 0 0" stroke="#475569" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path className={styles.wing} d="M0 0 Q8 -10 16 0" stroke="#475569" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>
          </g>
        ))}
      </g>

      {/* Tepaliklar va maysa */}
      <ellipse cx="350" cy="730" rx="720" ry="150" fill="#cdebc4" />
      <ellipse cx="1200" cy="745" rx="820" ry="125" fill="#b3e0a6" />
      <rect x="0" y={GROUND_Y} width="1600" height="200" fill="url(#kg-ground)" />
      {/* Eshikdan pastga buralib tushadigan qumli so'qmoq */}
      <path d="M600 712 C 560 770, 520 790, 470 830 S 430 880 420 910" stroke="#e9dcb8" strokeWidth="46" strokeLinecap="round" fill="none" />
      <path d="M600 712 C 560 770, 520 790, 470 830 S 430 880 420 910" stroke="#f3e9cc" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.7" />
      <ellipse cx="610" cy="706" rx="92" ry="10" fill="#eadfbe" />

      {/* Sharlar — pastdan ko'tarilib osmonga uchadi */}
      {BALLOONS.map((b) => (
        <g key={b.x} className={styles.balloon} style={{ animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }}>
          <g transform={`translate(${b.x} 300)`}>
            <g className={styles.balloonBody}>
              <path d="M0 31 q6 20 -4 40 q-6 18 2 36" stroke="#94a3b8" strokeWidth="1.6" fill="none" />
              <ellipse cx="0" cy="0" rx="22" ry="27" fill={b.color} />
              <polygon points="-4,26 4,26 0,32" fill={b.color} />
              <ellipse cx="-8" cy="-10" rx="5" ry="8" fill="#fff" opacity="0.45" />
            </g>
          </g>
        </g>
      ))}

      {/* Daraxt va undagi arg'imchoq */}
      <g className={styles.enter} style={{ animationDelay: "0.05s" }}>
        <path d="M132 700 L132 590 Q136 560 150 545 Q164 560 168 590 L168 700 Z" fill="#a0673b" />
        <path d="M150 552 Q200 528 262 534" stroke="#a0673b" strokeWidth="12" strokeLinecap="round" fill="none" />
        <g className={styles.canopy}>
          <circle cx="150" cy="455" r="92" fill="#56b865" />
          <circle cx="86" cy="505" r="62" fill="#4aa957" />
          <circle cx="214" cy="500" r="66" fill="#63c472" />
          <circle cx="150" cy="405" r="58" fill="#6fcf7b" />
          <circle cx="120" cy="540" r="40" fill="#4aa957" />
          {[
            [120, 470],
            [175, 440],
            [200, 510],
            [95, 520],
            [150, 520],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="8" fill="#ff6b6b" />
              <circle cx={cx - 2.5} cy={cy - 2.5} r="2.5" fill="#fff" opacity="0.7" />
            </g>
          ))}
        </g>
        <g className={styles.swing}>
          <line x1="212" y1="536" x2="206" y2="648" stroke="#b9855a" strokeWidth="3" />
          <line x1="240" y1="536" x2="246" y2="648" stroke="#b9855a" strokeWidth="3" />
          <Kid x={226} y={612} shirt="#ff9f43" hair="#4a3627" legs="#3b82f6" />
          <line x1="217" y1="626" x2="211" y2="606" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <line x1="235" y1="626" x2="241" y2="606" stroke={SKIN} strokeWidth="5" strokeLinecap="round" />
          <rect x="200" y="648" width="52" height="9" rx="4" fill="#8b5a2b" />
        </g>
      </g>

      {/* ABC kubiklari */}
      <g className={styles.enterUp} style={{ animationDelay: "0.35s" }}>
        <rect x="36" y="656" width="44" height="44" rx="7" fill="#ff8fa3" />
        <text x="58" y="688" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff">
          A
        </text>
        <rect x="84" y="656" width="44" height="44" rx="7" fill="#7ad3ff" />
        <text x="106" y="688" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff">
          B
        </text>
        <g className={styles.block}>
          <rect x="60" y="612" width="44" height="44" rx="7" fill="#ffd166" />
          <text x="82" y="644" textAnchor="middle" fontSize="24" fontWeight="800" fill="#9a5b00">
            C
          </text>
        </g>
      </g>

      {/* Tarozi-arg'imchoq */}
      <g className={styles.enter} style={{ animationDelay: "0.2s" }}>
        <polygon points="352,700 378,700 365,668" fill="#ff9f43" />
        <g className={styles.seesaw}>
          <rect x="283" y="660" width="164" height="10" rx="5" fill="#ffc233" />
          <rect x="300" y="650" width="4" height="10" rx="2" fill="#e07b1a" />
          <rect x="426" y="650" width="4" height="10" rx="2" fill="#e07b1a" />
          <Kid x={305} y={624} shirt="#60a5fa" hair="#2b2118" legs="#f97316" />
          <Kid x={425} y={624} shirt="#f472b6" hair="#d97706" legs="#a855f7" />
        </g>
        <circle cx="365" cy="668" r="6" fill="#e07b1a" />
      </g>

      {/* Bog'cha binosi */}
      <g className={styles.enterUp} style={{ animationDelay: "0.1s" }}>
        <rect x="472" y="500" width="276" height="200" rx="4" fill="#fff8ea" />
        <polygon points="446,514 610,394 774,514" fill="#ff8577" />
        <rect x="458" y="506" width="304" height="10" rx="5" fill="#f0645a" />
        <line x1="610" y1="394" x2="610" y2="332" stroke="#6b7280" strokeWidth="3" />
        <polygon className={styles.flag} points="611,334 652,346 611,358" fill="#ff6b6b" />
        <circle cx="610" cy="458" r="20" fill="#bfe6ff" stroke="#fff" strokeWidth="5" />
        <line x1="590" y1="458" x2="630" y2="458" stroke="#fff" strokeWidth="3" />
        <line x1="610" y1="438" x2="610" y2="478" stroke="#fff" strokeWidth="3" />
        {[498, 662].map((wx) => (
          <g key={wx}>
            <rect x={wx} y="545" width="60" height="54" rx="6" fill="#bfe6ff" stroke="#fff" strokeWidth="5" />
            <line x1={wx + 30} y1="545" x2={wx + 30} y2="599" stroke="#fff" strokeWidth="3" />
            <line x1={wx} y1="572" x2={wx + 60} y2="572" stroke="#fff" strokeWidth="3" />
            <rect x={wx - 4} y="599" width="68" height="12" rx="3" fill="#c47a3a" />
            {["#ff8fc0", "#ffd166", "#7ad3ff", "#ff8fc0"].map((c, i) => (
              <circle key={i} cx={wx + 8 + i * 15} cy="596" r="5" fill={c} />
            ))}
          </g>
        ))}
        {/* Peshtoqdagi lavha — tashkilot nomi, eshik ustida */}
        <rect x={610 - sign.width / 2} y="620" width={sign.width} height="26" rx="7" fill="#ffd166" />
        {signLabel && (
          <text
            className={styles.signText}
            x="610"
            y="638"
            textAnchor="middle"
            fontSize={SIGN_FONT_SIZE}
            fontWeight="800"
            letterSpacing="1"
            fill="#7c4a03"
            textLength={sign.textLength}
            lengthAdjust={sign.textLength ? "spacingAndGlyphs" : undefined}
          >
            {signLabel}
          </text>
        )}
        <path d="M588 700 V676 a22 22 0 0 1 44 0 V700 Z" fill="#0f766e" />
        <circle cx="622" cy="688" r="3" fill="#ffd166" />
        <rect x="578" y="700" width="64" height="6" rx="3" fill="#d9c7a3" />
        {/* Panjara */}
        <rect x="762" y="676" width="68" height="5" rx="2.5" fill="#fff" />
        <rect x="762" y="691" width="68" height="5" rx="2.5" fill="#fff" />
        {[764, 782, 800, 818].map((px) => (
          <rect key={px} x={px} y="664" width="12" height="36" rx="3" fill="#fff" stroke="#e5e7eb" />
        ))}
      </g>

      {/* Sirpanchiq va koptok */}
      <g className={styles.enter} style={{ animationDelay: "0.25s" }}>
        <rect x="852" y="556" width="8" height="144" fill="#ff9f43" />
        <rect x="872" y="556" width="8" height="144" fill="#ff9f43" />
        {[580, 610, 640, 670].map((ry) => (
          <rect key={ry} x="852" y={ry} width="28" height="6" rx="3" fill="#e07b1a" />
        ))}
        <rect x="846" y="548" width="44" height="10" rx="4" fill="#e07b1a" />
        <rect x="960" y="660" width="8" height="40" fill="#ff9f43" />
        <path d="M886 552 C 930 600, 950 660, 1000 690" stroke="#ffca3a" strokeWidth="16" strokeLinecap="round" fill="none" />
        <path d="M886 552 C 930 600, 950 660, 1000 690" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.55" />
        <g className={styles.ball}>
          <circle cx="886" cy="542" r="11" fill="#ef476f" />
          <path d="M876 538 q10 6 20 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* Maysa tutamlari */}
      {[120, 200, 470, 640, 700, 900, 1100, 1180, 1280, 1330, 1590].map((x) => (
        <GrassTuft key={x} x={x} />
      ))}

      {/* Gullar */}
      <g className={styles.enter} style={{ animationDelay: "0.4s" }}>
        <Flower x={458} height={30} color="blue" delay={-1.2} />
        <Flower x={742} height={32} color="pink" delay={-0.4} />
        <Flower x={1370} height={46} color="pink" delay={0} />
        <Flower x={1412} height={36} color="yellow" delay={-0.8} />
        <Flower x={1458} height={52} color="blue" delay={-1.6} />
        <Flower x={1506} height={40} color="pink" delay={-0.3} />
        <Flower x={1548} height={48} color="lilac" delay={-2.1} />
      </g>

      {/* Old plan: qum maydonchasi (chelak va kurakcha bilan) */}
      <g className={styles.enter} style={{ animationDelay: "0.45s" }}>
        <rect x="60" y="790" width="180" height="80" rx="12" fill="#d7b98a" />
        <rect x="70" y="800" width="160" height="60" rx="8" fill="#f1dfb0" />
        <ellipse cx="200" cy="846" rx="20" ry="9" fill="#e6cf9a" />
        <rect x="190" y="826" width="20" height="18" rx="3" fill="#e6cf9a" />
        <polygon points="112,822 138,822 134,850 116,850" fill="#ef476f" />
        <path d="M113 822 a12 12 0 0 1 24 0" stroke="#be123c" strokeWidth="2.5" fill="none" />
        <rect x="160" y="808" width="5" height="34" rx="2.5" fill="#60a5fa" transform="rotate(-18 162 825)" />
        <path d="M150 838 l14 -4 l8 16 l-16 6 z" fill="#3b82f6" />
      </g>

      {/* Klassiki (bo'r bilan chizilgan) — tor ekranda karta ostida qolgani uchun yashirin */}
      <g className={`${styles.enter} hidden lg:block`} style={{ animationDelay: "0.5s" }}>
        <rect x="1076" y="730" width="168" height="160" rx="16" fill="#e8edf3" />
        {[
          { x: 1138, y: 836, n: 1 },
          { x: 1094, y: 792, n: 2 },
          { x: 1182, y: 792, n: 3 },
          { x: 1138, y: 748, n: 4 },
        ].map((c) => (
          <g key={c.n}>
            <rect x={c.x} y={c.y} width="44" height="44" fill="#fff" fillOpacity="0.35" stroke="#fff" strokeWidth="3" />
            <text x={c.x + 22} y={c.y + 29} textAnchor="middle" fontSize="18" fontWeight="800" fill="#ff8fa3">
              {c.n}
            </text>
          </g>
        ))}
      </g>

      {/* Romashkalar va maysa — old plandagi chuqurlik uchun */}
      {[
        [340, 760],
        [720, 748],
        [980, 822],
        [520, 862],
        [880, 882],
        [1300, 762],
        [1420, 852],
        [1560, 792],
        [760, 802],
        [270, 742],
        [1010, 764],
        [1500, 876],
      ].map(([x, y]) => (
        <Daisy key={`${x}-${y}`} x={x} y={y} />
      ))}
      {[
        [400, 770, 1.3],
        [660, 830, 1.5],
        [820, 760, 1.2],
        [1040, 870, 1.6],
        [1280, 820, 1.4],
        [1470, 760, 1.2],
        [300, 880, 1.7],
        [1580, 860, 1.5],
      ].map(([x, y, sc]) => (
        <GrassTuft key={`${x}-${y}`} x={x} y={y} scale={sc} />
      ))}

      {/* Xonqizi — so'qmoq bo'ylab sekin yuradi, chekkaga yetganda buriladi */}
      <g className={styles.ladybug}>
        <g transform="translate(560 868)">
          {[-5, 0, 5].map((lx) => (
            <g key={lx}>
              <line x1={lx} y1="-5" x2={lx - 3} y2="-10" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />
              <line x1={lx} y1="5" x2={lx - 3} y2="10" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ))}
          <ellipse cx="0" cy="0" rx="10" ry="7" fill="#ef4444" />
          <circle cx="9" cy="0" r="4.2" fill="#1f2937" />
          <line x1="-9" y1="0" x2="6" y2="0" stroke="#1f2937" strokeWidth="1.2" />
          {[
            [-5, -3],
            [-1, 3],
            [3, -3],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="#1f2937" />
          ))}
        </g>
      </g>

      {/* Kapalak */}
      <g className={styles.enter} style={{ animationDelay: "0.5s" }}>
        <g className={styles.butterfly}>
          <g transform="translate(1440 600)">
            <g className={styles.butterflyBob}>
              <path className={styles.wingL} d="M0 0 C -14 -22, -30 -14, -22 2 C -30 10, -12 16, 0 4 Z" fill="#ff8fc0" />
              <path className={styles.wingR} d="M0 0 C 14 -22, 30 -14, 22 2 C 30 10, 12 16, 0 4 Z" fill="#ff9f43" />
              <ellipse cx="0" cy="2" rx="2.5" ry="9" fill="#4a3627" />
              <path d="M-1 -6 q-4 -6 -7 -8 M1 -6 q4 -6 7 -8" stroke="#4a3627" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
