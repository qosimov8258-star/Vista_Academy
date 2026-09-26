/**
 * O'yin maydonchasining o'lchamlari va fizikasi — sof hisob, three.js'siz.
 *
 * Birliklar — metr, og'irlik kuchi — haqiqiy (9.81 m/s²): minion ~1.2 m,
 * halinchak zanjiri 1.5 m. Harakatlar "haqiqiy" ko'rinishi shundan: tebranish
 * davri, sirpanish tezlanishi va sakrash yoyi tabiiy qonunlarga bo'ysunadi.
 *
 * Bu faylni ham 3D modellar (props.ts), ham harakat rejasi (choreo.ts)
 * ishlatadi — shuning uchun o'rindiq, tutqich va zanjir nuqtalari ikkalasida
 * bir xil va minion ularni aniq ushlaydi.
 */

export const G = 9.81;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0→1 silliq o'tish */
export const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/** 0→1→0 do'nglik */
export const bump = (t: number) => Math.sin(Math.PI * clamp(t, 0, 1));

/* ------------------------------------------------------------------ arg'imchoq (see-saw) */

/**
 * Minion oyog'i atigi ~18 sm. Shuning uchun arg'imchoq past va ingichka:
 * minion taxtani oyoqlari orasiga olib o'tiradi va pastda oyoqlari yerga
 * yetadi — itarilish haqiqiy bo'ladi.
 */
export const SEESAW = {
  /** Aylanish o'qi balandligi */
  pivotY: 0.22,
  axleR: 0.028,
  /** Taxtaning yarim uzunligi */
  half: 1.0,
  thick: 0.04,
  width: 0.2,
  /** O'rindiq markazi o'qdan qancha uzoqda */
  seatD: 0.84,
  seatH: 0.012,
  seatLen: 0.22,
  /**
   * Tutqich o'rindiqdan 0.31 m oldinda: minionning dumaloq qorni (r ≈ 0.27)
   * sig'adi va qo'llari (~0.37 m) bemalol yetadi
   */
  handleD: 0.53,
  handleH: 0.34,
  gripHalf: 0.17,
  /** Uchidagi rezina tirgak: uchdan ichkarida, taxta ostida */
  bumperIn: 0.1,
  bumperDrop: 0.035,
} as const;

/**
 * Taxta koordinatasidan (o'q markazida) dunyo balandligi va gorizontal siljish.
 * φ > 0 — chap uchi (minion o'tiradigan tomon) tepada.
 */
export function plankPoint(phi: number, lx: number, ly: number, out: { x: number; y: number }) {
  const c = Math.cos(-phi);
  const s = Math.sin(-phi);
  out.x = lx * c - ly * s;
  out.y = lx * s + ly * c + SEESAW.pivotY;
  return out;
}

/** Taxta uchi yerga tekkandagi burchak — tirgakning pastki nuqtasi y = 0 */
export const SEESAW_TILT = (() => {
  const p = { x: 0, y: 0 };
  const lx = -(SEESAW.half - SEESAW.bumperIn);
  const ly = SEESAW.axleR - SEESAW.bumperDrop;
  let lo = 0;
  let hi = 0.9;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (plankPoint(-mid, lx, ly, p).y > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

export const SEAT_LOCAL = { x: -SEESAW.seatD, y: SEESAW.axleR + SEESAW.thick + SEESAW.seatH };
export const HANDLE_LOCAL = { x: -SEESAW.handleD, y: SEESAW.axleR + SEESAW.thick + SEESAW.handleH };

/* ------------------------------------------------------------------ sirg'anchiq */

export const SLIDE = {
  deckY: 1.02,
  deckW: 0.56,
  deckD: 0.66,
  /** Qiyalik burchagi */
  angle: (34 * Math.PI) / 180,
  /** Pastki egilish radiusi */
  arcR: 0.55,
  /** Chiqish labining balandligi */
  lipY: 0.2,
  exitLen: 0.3,
  bedW: 0.48,
  wallH: 0.12,
  /**
   * Narvon emas, zinapoya: 5 ta 20 sm'lik ko'tarilish. Minionning oyog'i
   * kalta — pog'onaga qadam bosa olmaydi, shuning uchun ikki oyoqlab sakrab
   * chiqadi. Pog'ona chuqurligi shunday tanlanganki, dumaloq qorni keyingi
   * pog'ona qirrasiga tegmaydi.
   */
  steps: 4,
  tread: 0.26,
  stairW: 0.56,
  /** Zinapoya va maydoncha panjaralari (z) */
  railZ: 0.3,
  railH: 0.42,
  /** Plastik va kiyim orasidagi ishqalanish */
  mu: 0.28,
} as const;

const straightDrop = SLIDE.deckY - SLIDE.lipY - SLIDE.arcR * (1 - Math.cos(SLIDE.angle));

/**
 * Sirg'anchiq koordinatalari (lokal): x = 0 — chiqish uchi (eng chap),
 * narvon o'ngda. Tarnov tepadan (s = 0) pastga (s = CHUTE_LENGTH) boradi.
 */
export const SLIDE_GEO = (() => {
  const straight = straightDrop / Math.sin(SLIDE.angle);
  const arcLen = SLIDE.arcR * SLIDE.angle;
  const deckLeft = SLIDE.exitLen + SLIDE.arcR * Math.sin(SLIDE.angle) + straight * Math.cos(SLIDE.angle);
  const deckRight = deckLeft + SLIDE.deckW;
  const stairEnd = deckRight + SLIDE.steps * SLIDE.tread;
  return {
    straight,
    arcLen,
    length: straight + arcLen + SLIDE.exitLen,
    deckLeft,
    deckRight,
    stairEnd,
    /** Zinapoya oldida, yerda turish joyi */
    base: stairEnd + 0.2,
    rise: SLIDE.deckY / (SLIDE.steps + 1),
    width: stairEnd + 0.05,
  };
})();

/**
 * Zinapoyada turish joyi (lokal): 0 — yer, 1..4 — pog'onalar, 5 — maydoncha.
 * Minion pog'onaning orqaroq qismida turadi — qorni oldingi qirraga tegmaydi.
 */
export function stairSpot(level: number, out: { x: number; y: number }) {
  const { deckRight, base, rise } = SLIDE_GEO;
  if (level <= 0) {
    out.x = base;
    out.y = 0;
  } else if (level >= SLIDE.steps + 1) {
    out.x = deckRight - 0.18;
    out.y = SLIDE.deckY;
  } else {
    out.x = deckRight + (SLIDE.steps + 0.5 - level) * SLIDE.tread + 0.04;
    out.y = level * rise;
  }
  return out;
}

/** Tarnov tubidagi nuqta va shu joydagi qiyalik (gorizontdan pastga, radian) */
export function chuteAt(s: number, out: { x: number; y: number; slope: number }) {
  const a = SLIDE.angle;
  const { straight, arcLen, deckLeft } = SLIDE_GEO;
  if (s <= straight) {
    const d = Math.max(0, s);
    out.x = deckLeft - d * Math.cos(a);
    out.y = SLIDE.deckY - d * Math.sin(a);
    out.slope = a;
    return out;
  }
  const p1x = deckLeft - straight * Math.cos(a);
  const p1y = SLIDE.deckY - straight * Math.sin(a);
  // Yoy markazi tarnovdan yuqorida — pastga tushgan sari qiyalik yo'qoladi
  const cx = p1x - SLIDE.arcR * Math.sin(a);
  const cy = p1y + SLIDE.arcR * Math.cos(a);
  if (s <= straight + arcLen) {
    const psi = a - (s - straight) / SLIDE.arcR;
    out.x = cx + SLIDE.arcR * Math.sin(psi);
    out.y = cy - SLIDE.arcR * Math.cos(psi);
    out.slope = psi;
    return out;
  }
  const e = Math.min(SLIDE.exitLen, s - straight - arcLen);
  out.x = cx - e;
  out.y = cy - SLIDE.arcR;
  out.slope = 0;
  return out;
}

/**
 * Sirpanish fizikasi: a = g·sinα − μ·(g·cosα + v²/R). Yoyda markazga
 * intilma kuch bosimni oshiradi, shuning uchun pastda ishqalanish ko'proq.
 * Natija — vaqt bo'yicha jadval (s, v), ko'rsatishda undan o'qiladi.
 */
export function simulateSlide(v0: number) {
  const dt = 1 / 240;
  const ts: number[] = [0];
  const ss: number[] = [0];
  const vs: number[] = [v0];
  const p = { x: 0, y: 0, slope: 0 };
  let s = 0;
  let v = v0;
  let t = 0;
  while (s < SLIDE_GEO.length && t < 6) {
    chuteAt(s, p);
    const onArc = s > SLIDE_GEO.straight && s < SLIDE_GEO.straight + SLIDE_GEO.arcLen;
    const normal = G * Math.cos(p.slope) + (onArc ? (v * v) / SLIDE.arcR : 0);
    const a = G * Math.sin(p.slope) - SLIDE.mu * normal;
    v = Math.max(0.05, v + a * dt);
    s += v * dt;
    t += dt;
    ts.push(t);
    ss.push(Math.min(s, SLIDE_GEO.length));
    vs.push(v);
  }
  return {
    duration: t,
    exitSpeed: v,
    at(time: number) {
      if (time <= 0) return { s: 0, v: v0 };
      if (time >= t) return { s: SLIDE_GEO.length, v };
      const i = Math.min(ts.length - 2, Math.floor(time / dt));
      const f = (time - ts[i]) / dt;
      return { s: lerp(ss[i], ss[i + 1], f), v: lerp(vs[i], vs[i + 1], f) };
    },
  };
}

/* ------------------------------------------------------------------ halinchak */

export const SWING = {
  pivotY: 1.98,
  /** Ilgakdan o'rindiq ustigacha */
  chain: 1.5,
  /** A-ramka oyoqlari yerda markazdan qancha chetda */
  footX: 0.9,
  /** Old va orqa A-ramkalar */
  frameZ: 0.52,
  /** Minion keng (0.56 m) — zanjirlar uning yonlaridan o'tadi */
  seatW: 0.78,
  seatDepth: 0.2,
  seatT: 0.035,
  chainZ: 0.35,
  tubeR: 0.042,
} as const;

/** Mayatnik: minion bilan og'irlik markazi o'rindiqdan ~0.28 m yuqorida */
export const SWING_OMEGA = Math.sqrt(G / (SWING.chain - 0.28));
/** Bo'sh halinchak — faqat zanjir va o'rindiq */
export const SWING_OMEGA_EMPTY = Math.sqrt(G / SWING.chain);

/**
 * Halinchak burchagidan (θ > 0 — o'rindiq chapda) zanjir bo'ylab nuqta.
 * `down` — ilgakdan pastga masofa.
 */
export function swingPoint(theta: number, down: number, out: { x: number; y: number }) {
  out.x = -Math.sin(theta) * down;
  out.y = SWING.pivotY - Math.cos(theta) * down;
  return out;
}

/* ------------------------------------------------------------------ joylashuv */

export interface Layout {
  /** Ko'rinadigan kenglik (z = 0 tekisligida) */
  L: number;
  seesawX: number;
  /** Sirg'anchiqning chap (chiqish) uchi */
  slideX: number;
  swingX: number;
  /** Minionlar shu yerda ekrandan chiqadi / kiradi */
  leftOut: number;
  rightIn: number;
}

/**
 * Keng ekranda jihozlar kenglik ulushlari bo'yicha, torida — bir-biriga
 * tegmaydigan eng kichik oraliqlar bilan joylashadi. O'ng tomon bo'sh
 * qoladi: bananli minion shu yerdan kirib keladi.
 */
export function computeLayout(L: number): Layout {
  const half = L / 2;
  const seesawX = -half + Math.max(1.25, 0.15 * L);
  // Oraliqlar minion o'tib yuradigan yo'lakka qarab: arg'imchoq uchi bilan
  // sirg'anchiqdan tushgan minion tegmaydi; halinchakdagi minion eng chetga
  // uchganda ham (~1.2 m) zinapoya oldida turganga yetmaydi
  const slideX = Math.max(seesawX + SEESAW.half + 0.75, -half + 0.3 * L);
  const swingX = Math.max(slideX + SLIDE_GEO.base + 1.6, -half + 0.68 * L);
  return { L, seesawX, slideX, swingX, leftOut: -half - 0.9, rightIn: half + 1.2 };
}

/** Uchala jihoz sig'ishi uchun kerak bo'lgan eng kichik kenglik */
export const MIN_VISIBLE_WIDTH = 9.3;
