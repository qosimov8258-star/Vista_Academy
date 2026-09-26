/**
 * Harakat rejasi (xoreografiya): kim qachon, qayerda, qanday holatda.
 *
 * Hammasi vaqtning funksiyasi (t → holat), ichki holat saqlanmaydi: sahna
 * istalgan paytga "o'ralsa" ham bir xil ko'rinadi, varaq yashirinib qaytsa
 * ham harakat buzilmaydi. Fizika analitik:
 *   · arg'imchoq — minion oyog'i bilan yerdan itariladi, taxta o'z og'irligi
 *     bilan sekinlashib qaytadi; tepada taxta to'xtaganda minion o'rindiqdan
 *     biroz uchib ketadi;
 *   · sirg'anchiq — dims.ts'dagi ishqalanishli sirpanish jadvali;
 *   · halinchak — mayatnik, minion oyoqlarini silkitib amplitudani oshiradi;
 *     sakrab tushganda tanasi parabola bo'ylab uchadi, bo'sh halinchak esa
 *     orqaga tepilib, so'nib boradi.
 *
 * Ssenariy: uchala minion chapdan yugurib kelib o'ynaydi → o'ngdan bananli
 * minion yugurib keladi → har biri uni ko'rgan payt o'z holatiga qarab
 * qochadi (halinchakdan sakraydi, arg'imchoqdan tushadi, zinapoyadan tez
 * chiqib sirg'anib tushadi) → hammasi chapga qochib ketadi → qaytib kelishadi.
 */
import { Vector3 } from "three";
import {
  G,
  HANDLE_LOCAL,
  SEAT_LOCAL,
  SEESAW_TILT,
  SLIDE,
  SLIDE_GEO,
  stairSpot,
  SWING,
  SWING_OMEGA,
  SWING_OMEGA_EMPTY,
  bump,
  chuteAt,
  clamp,
  lerp,
  plankPoint,
  simulateSlide,
  smooth,
  swingPoint,
  type Layout,
} from "./dims";
import { SIT_HIP, STAND_HIP, copyPose, createPose, mixPose, resetPose, type Limb, type Pose } from "./rig";

export const SEESAW_RIDER = 0;
export const SLIDER = 1;
export const SWINGER = 2;
export const CHASER = 3;

/** Yo'laklar (z): jihozlar oldida, bir-biriga tegmaydigan chiziqlar */
const LANE_ARRIVE = 0.88;
const LANE_FLEE = 1.02;
const LANE_CHASE = 1.36;
const ARRIVE_SPEED = 1.75;
const WALK_SPEED = 1.35;
const FLEE_SPEED = 2.6;
const CHASE_SPEED = 2.25;
/**
 * Bananli minion shuncha yaqinlashganda sezib qolishadi. Arg'imchoqdagi unga
 * yuzma-yuz o'tiradi — uzoqdan ko'radi; halinchakdagi sakrash uchun qulay
 * paytni kutishi kerak (bir tebranishgacha) — shuning uchun hayqiriqni
 * uzoqdan eshitadi.
 */
const NOTICE_SEESAW = 6;
const NOTICE_SWING = 7;
const NOTICE_SLIDE = 4.5;
/** Hammasi o'ynay boshlagach, quvlashgacha */
const PLAY_TIME = 9.5;
const SWING_AMP = 0.6;
const LEFT = -Math.PI / 2;
const RIGHT = Math.PI / 2;

const _p = { x: 0, y: 0 };
const _c = { x: 0, y: 0, slope: 0 };

const set = (l: Limb, pitch: number, roll: number, bend: number) => {
  l.pitch = pitch;
  l.roll = roll;
  l.bend = bend;
};

/** Yuzni biroz kameraga burish: yon tomonga yurganda ham ko'zlari ko'rinadi */
const biased = (h: number, b: number) => h - b * Math.sin(h);

/** Eng qisqa yo'l bilan burilish */
const lerpAngle = (a: number, b: number, w: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * w;
};

/* ------------------------------------------------------------------ yo'l va qadam */

class Path {
  private readonly xs: number[] = [];
  private readonly zs: number[] = [];
  private readonly cum: number[] = [0];
  readonly length: number;

  constructor(points: Array<[number, number]>) {
    // Burchaklar silliqlanadi: minion keskin emas, yoy bo'ylab buriladi
    const dense: Array<[number, number]> = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const [ax, az] = points[i - 1];
      const [bx, bz] = points[i];
      const [cx, cz] = points[i + 1];
      const ab = Math.hypot(bx - ax, bz - az);
      const bc = Math.hypot(cx - bx, cz - bz);
      const t = Math.min(0.6, 0.45 * ab, 0.45 * bc);
      if (t < 1e-3) {
        dense.push(points[i]);
        continue;
      }
      const p1: [number, number] = [bx - ((bx - ax) / ab) * t, bz - ((bz - az) / ab) * t];
      const p2: [number, number] = [bx + ((cx - bx) / bc) * t, bz + ((cz - bz) / bc) * t];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        const q = (1 - u) * (1 - u);
        const m = 2 * u * (1 - u);
        const e = u * u;
        dense.push([q * p1[0] + m * bx + e * p2[0], q * p1[1] + m * bz + e * p2[1]]);
      }
    }
    dense.push(points[points.length - 1]);
    for (const [x, z] of dense) {
      this.xs.push(x);
      this.zs.push(z);
    }
    for (let i = 1; i < this.xs.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(this.xs[i] - this.xs[i - 1], this.zs[i] - this.zs[i - 1]));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  point(s: number, out: { x: number; y: number }) {
    const d = clamp(s, 0, this.length);
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const f = (d - this.cum[i - 1]) / seg;
    out.x = lerp(this.xs[i - 1], this.xs[i], f);
    out.y = lerp(this.zs[i - 1], this.zs[i], f);
    return out;
  }

  /** Harakat yo'nalishi — burchaklarda silliq */
  heading(s: number): number {
    const a = this.point(s - 0.06, { x: 0, y: 0 });
    const b = this.point(s + 0.06, { x: 0, y: 0 });
    return Math.atan2(b.x - a.x, b.y - a.y);
  }
}

type Gait = "walk" | "skip" | "panic" | "chase";

interface GaitSpec {
  stride: number;
  hip: number;
  knee: number;
  bob: number;
  flight: boolean;
  lean: number;
  arm: number;
  armBend: number;
  sway: number;
}

/**
 * Qadam uzunligi tezlikka bog'langan: oyoq yerda "sirpanmaydi". Minion
 * oyoqlari kalta — shuning uchun qadamlari tez-tez, yugurganda esa har
 * qadamda havoga biroz ko'tariladi.
 */
const GAITS: Record<Gait, GaitSpec> = {
  walk: { stride: 0.46, hip: 0.48, knee: 0.55, bob: 0.018, flight: false, lean: 0.05, arm: 0.5, armBend: 0.35, sway: 0.05 },
  skip: { stride: 0.6, hip: 0.62, knee: 0.9, bob: 0.05, flight: true, lean: 0.07, arm: 0.8, armBend: 0.55, sway: 0.06 },
  panic: { stride: 0.76, hip: 0.88, knee: 1.3, bob: 0.065, flight: true, lean: 0.06, arm: 0, armBend: 0.3, sway: 0.07 },
  chase: { stride: 0.82, hip: 0.9, knee: 1.35, bob: 0.06, flight: true, lean: 0.2, arm: 1.0, armBend: 1.25, sway: 0.05 },
};

function applyGait(p: Pose, s: number, kind: Gait, t: number) {
  const g = GAITS[kind];
  const ph = (s / g.stride) * Math.PI * 2;
  const sn = Math.sin(ph);
  const cs = Math.cos(ph);
  set(p.legL, g.hip * sn, 0.05, 0.08 + g.knee * Math.max(0, cs));
  set(p.legR, -g.hip * sn, 0.05, 0.08 + g.knee * Math.max(0, -cs));
  p.y += g.flight ? g.bob * sn * sn : g.bob * cs * cs;
  p.lean += g.lean;
  p.side += g.sway * sn;
  p.twist += 0.07 * sn;
  if (g.flight) p.squash = 1 + 0.035 * Math.cos(2 * ph);
  if (kind === "panic") {
    // Qo'llar tepada, alanglab silkinadi
    const f = Math.sin(2 * ph);
    set(p.armL, 2.6 + 0.4 * f, 0.5, 0.35);
    set(p.armR, 2.6 - 0.4 * Math.sin(2 * ph + 0.7), 0.5, 0.35);
  } else if (kind === "chase") {
    // Banan tepada silkinadi, ikkinchi qo'l yugurishga yordam beradi
    set(p.armR, 2.75 + 0.22 * Math.sin(t * 11), 0.18, 0.4);
    set(p.armL, -g.arm * sn, 0.22, g.armBend);
  } else {
    set(p.armL, -g.arm * sn, 0.18, g.armBend);
    set(p.armR, g.arm * sn, 0.18, g.armBend);
  }
}

interface Travel {
  path: Path;
  t0: number;
  t1: number;
  speed: number;
  accel: number;
}

function travel(path: Path, t0: number, speed: number, accel = 0.35): Travel {
  return { path, t0, speed, accel, t1: t0 + path.length / speed + accel / 2 };
}

function travelDist(tr: Travel, t: number): number {
  const tau = t - tr.t0;
  if (tau < tr.accel) return (tr.speed * tau * tau) / (2 * tr.accel);
  return Math.min(tr.path.length, tr.speed * (tau - tr.accel / 2));
}

/* ------------------------------------------------------------------ arg'imchoq fizikasi */

/**
 * Bir sakrash: tayyorlanish (tizzalar bukiladi) → itarilish (taxta ω₀ bilan
 * buriladi, minion og'irligi uni α bilan sekinlashtiradi) → narigi uchi yerga
 * urilib to'xtaydi → minion o'z tezligi bilan o'rindiqdan uchib chiqadi,
 * taxta esa (muvozanatda, minionsiz) sekin qaytadi → minion o'rindiqqa
 * qaytib tushadi (impuls saqlanadi) va ikkalasi birga pastga tezlashadi →
 * minion tomoni yerga tegadi, oyoqlar zarbni yutadi.
 */
class Bounce {
  readonly phiM = SEESAW_TILT;
  /** Inersiya: taxta ~12 kg, 2 m; minion ~20 kg o'rindiqda */
  private readonly Ip = 4;
  private readonly Ir = 20 * SEAT_LOCAL.x * SEAT_LOCAL.x;
  readonly alpha: number;
  readonly e = 0.25;
  readonly prep = 0.26;
  readonly land = 0.32;
  readonly w0: number;
  readonly T1: number;
  readonly w1: number;
  readonly T2: number;
  readonly total: number;
  private readonly dt = 1 / 240;
  private readonly fallPhi: number[] = [];
  private readonly fallLift: number[] = [];

  constructor() {
    this.alpha = (20 * G * Math.abs(SEAT_LOCAL.x)) / (this.Ip + this.Ir);
    const d = 2 * this.phiM;
    this.w0 = Math.sqrt(2 * this.alpha * d) * 1.08;
    this.T1 = (this.w0 - Math.sqrt(this.w0 * this.w0 - 2 * this.alpha * d)) / this.alpha;
    this.w1 = this.w0 - this.alpha * this.T1;

    const seatY = (phi: number) => plankPoint(phi, SEAT_LOCAL.x, SEAT_LOCAL.y, _p).y;
    const dydphi = (phi: number) => (seatY(phi + 1e-4) - seatY(phi - 1e-4)) / 2e-4;
    let phi = this.phiM;
    let w = -this.e * this.w1;
    let ry = seatY(phi);
    let rvy = dydphi(phi) * this.w1;
    let onSeat = false;
    for (let i = 0; i < 2000 && phi > -this.phiM; i++) {
      if (!onSeat) {
        // Minion havoda: taxtaga kuch ta'sir qilmaydi, u tekis aylanadi
        phi += w * this.dt;
        rvy -= G * this.dt;
        ry += rvy * this.dt;
        if (ry <= seatY(phi)) {
          onSeat = true;
          ry = seatY(phi);
          // Noelastik to'qnashuv: umumiy burchak tezligi
          const wr = rvy / dydphi(phi);
          w = (this.Ip * w + this.Ir * wr) / (this.Ip + this.Ir);
        }
      } else {
        w -= this.alpha * Math.cos(phi) * this.dt;
        phi += w * this.dt;
        ry = seatY(phi);
      }
      this.fallPhi.push(Math.max(phi, -this.phiM));
      this.fallLift.push(Math.max(0, ry - seatY(phi)));
    }
    this.T2 = this.fallPhi.length * this.dt;
    this.total = this.prep + this.T1 + this.T2 + this.land;
  }

  private sample(arr: number[], u: number) {
    const f = u / this.dt;
    const i = Math.min(arr.length - 2, Math.max(0, Math.floor(f)));
    return lerp(arr[i], arr[i + 1], clamp(f - i, 0, 1));
  }

  /** Taxta burchagi (φ > 0 — minion tomoni tepada) */
  angle(tau: number): number {
    const { prep, T1, T2, phiM } = this;
    if (tau < prep) return -phiM;
    if (tau < prep + T1) {
      const u = tau - prep;
      return -phiM + this.w0 * u - 0.5 * this.alpha * u * u;
    }
    if (tau < prep + T1 + T2) return this.sample(this.fallPhi, tau - prep - T1);
    const v = (tau - prep - T1 - T2) / this.land;
    return -phiM + 0.03 * Math.sin(Math.PI * clamp(v * 1.6, 0, 1)) * (1 - v);
  }

  /** Tepadagi zarbdan keyin minion o'rindiqdan qancha ko'tarilgan */
  lift(tau: number): number {
    const u = tau - this.prep - this.T1;
    if (u <= 0 || u >= this.T2) return 0;
    return this.sample(this.fallLift, u);
  }
}

/* ------------------------------------------------------------------ reja */

interface Seg {
  t0: number;
  t1: number;
  /** Oldingi bo'lakdan silliq o'tish davomiyligi */
  blend: number;
  kind: string;
  fn: (t: number, p: Pose) => void;
}

export class Choreography {
  readonly period: number;
  /** Sahifa ochilganda — hamma allaqachon o'ynayapti */
  readonly startTime: number;
  /** Harakat kamaytirilganda ko'rsatiladigan bitta kadr */
  readonly staticTime: number;

  private readonly tracks: Seg[][] = [[], [], [], []];
  /** Bo'laklar ichidagi oraliq hisob uchun */
  private readonly tmp = createPose();
  /** evaluate(): oldingi bo'lakning oxirgi holati (aralashtirish uchun) */
  private readonly prevPose = createPose();
  private readonly bounce = new Bounce();
  readonly lo: Layout;

  // Arg'imchoq
  private seesawPlay = 0;
  private seesawStop = 0;
  // Halinchak
  private swingPlay = 0;
  private swingRelease = Infinity;
  private swingMount = 0;
  private swingFree = { th0: 0, dth0: 0 };
  // Quvlovchi
  private chaseStart = 0;

  constructor(layout: Layout) {
    this.lo = layout;
    const lo = layout;
    const H_CLIMB = LEFT + 0.2;

    // ---------------------------------------------------------- joylar
    const seatRest = plankPoint(-SEESAW_TILT, SEAT_LOCAL.x, SEAT_LOCAL.y, { x: 0, y: 0 });
    const seatX = lo.seesawX + seatRest.x;
    const deckL = lo.slideX + SLIDE_GEO.deckLeft;
    const slideBase = { x: lo.slideX + SLIDE_GEO.base, z: 0.02 };
    const swingFront = { x: lo.swingX - 0.2, z: 0.04 };

    // ---------------------------------------------------------- kelish
    const arrive = (x: number, z: number, approachX: number, t0: number) =>
      travel(new Path([[lo.leftOut, LANE_ARRIVE], [approachX, LANE_ARRIVE], [x, z]]), t0, ARRIVE_SPEED);
    const arrSwing = arrive(swingFront.x, swingFront.z, lo.swingX - 0.15, 0);
    const arrSlide = arrive(slideBase.x, slideBase.z, slideBase.x + 0.05, 0.75);
    const arrSeesaw = travel(
      new Path([
        [lo.leftOut, LANE_ARRIVE],
        [seatX - 1.1, LANE_ARRIVE],
        [seatX - 0.62, 0.14],
        [seatX - 0.32, 0.1],
      ]),
      1.5,
      ARRIVE_SPEED,
    );

    const travelSeg = (i: number, tr: Travel, gait: Gait, bias: number, kind: string, blend = 0.2, extra?: (t: number, p: Pose) => void) => {
      this.push(i, tr.t0, tr.t1, kind, blend, (t, p) => {
        resetPose(p);
        const s = travelDist(tr, t);
        tr.path.point(s, _p);
        p.x = _p.x;
        p.z = _p.y;
        p.heading = biased(tr.path.heading(s), bias);
        applyGait(p, s, gait, t);
        p.mouth = gait === "skip" ? "grin" : p.mouth;
        extra?.(t, p);
      });
      return tr.t1;
    };

    travelSeg(SWINGER, arrSwing, "skip", 0.35, "arrive", 0);
    travelSeg(SLIDER, arrSlide, "skip", 0.35, "arrive", 0);
    travelSeg(SEESAW_RIDER, arrSeesaw, "skip", 0.35, "arrive", 0);

    // ---------------------------------------------------------- arg'imchoqqa o'tirish
    const b = this.bounce;
    const tSeeMount = arrSeesaw.t1;
    this.seesawPlay = tSeeMount + 0.6;
    this.push(SEESAW_RIDER, tSeeMount, this.seesawPlay, "mount", 0.15, (t, p) => {
      const u = (t - tSeeMount) / 0.6;
      this.standAt(this.tmp, seatX - 0.32, 0.1, RIGHT - 0.25);
      this.seesawRider(p, 0, 0, t);
      mixPose(p, this.tmp, p, smooth(u));
      p.x = lerp(seatX - 0.32, seatX, smooth(u));
      p.z = lerp(0.1, 0, smooth(u));
      p.y = lerp(0, seatRest.y, smooth(u)) + 0.14 * bump(u);
      p.heading = lerp(RIGHT - 0.25, RIGHT, smooth(u));
    });

    // ---------------------------------------------------------- halinchakka o'tirish
    const tSwTurn = arrSwing.t1;
    this.swingMount = tSwTurn + 0.35;
    this.swingPlay = this.swingMount + 0.5;
    const swingArriveHeading = biased(arrSwing.path.heading(arrSwing.path.length), 0.35);
    this.push(SWINGER, tSwTurn, this.swingMount, "turn", 0.15, (t, p) => {
      this.standAt(p, swingFront.x, swingFront.z, lerpAngle(swingArriveHeading, LEFT, smooth((t - tSwTurn) / 0.35)));
    });
    this.push(SWINGER, this.swingMount, this.swingPlay, "mount", 0, (t, p) => {
      const u = (t - this.swingMount) / 0.5;
      this.standAt(this.tmp, swingFront.x, swingFront.z, LEFT);
      this.chainTargets(this.tmp, 0, 0.46);
      this.tmp.wHandL = this.tmp.wHandR = smooth(u / 0.4);
      this.swinger(p, 0, t);
      mixPose(p, this.tmp, p, smooth((u - 0.2) / 0.8));
      const seat = swingPoint(this.swingAngle(t), SWING.chain, _p);
      p.x = lerp(swingFront.x, lo.swingX + seat.x, smooth(u));
      p.z = lerp(swingFront.z, 0, smooth(u));
      p.y = lerp(0, seat.y, smooth(u)) + 0.08 * bump(u);
    });

    // ---------------------------------------------------------- sirg'anchiq
    const tSlTurn = arrSlide.t1;
    const tSlide0 = tSlTurn + 0.4;
    const slideArriveHeading = biased(arrSlide.path.heading(arrSlide.path.length), 0.35);
    this.push(SLIDER, tSlTurn, tSlide0, "turn", 0.15, (t, p) => {
      this.standAt(p, slideBase.x, slideBase.z, lerpAngle(slideArriveHeading, H_CLIMB, smooth((t - tSlTurn) / 0.4)));
    });

    // ---------------------------------------------------------- quvlash vaqti
    const playAll = Math.max(this.seesawPlay, this.swingPlay, tSlide0);
    // Sirg'anchiq sikllari quvlashdan qat'i nazar oldindan ma'lum. Bananli
    // minion shunday chiqadiki, sirg'anchiqdagi uni tarnov tepasida o'tirgan
    // paytda sezadi — darhol sirg'anib, quvlovchidan uzoqlashadi.
    const sim = simulateSlide(0.35);
    const cycleSegs: Seg[] = [];
    let tc = tSlide0;
    while (tc < playAll + PLAY_TIME + 12) tc = this.slideCycle(cycleSegs, tc, sim, H_CLIMB);
    const sitSeg = cycleSegs.find((sg) => sg.kind === "sit" && sg.t0 >= playAll + PLAY_TIME) ?? cycleSegs[cycleSegs.length - 1];
    const nSl = sitSeg.t0 + 0.15;
    const slideSpot = lo.slideX + (SLIDE_GEO.deckLeft + SLIDE_GEO.stairEnd) / 2;
    this.chaseStart = nSl - Math.max(0, (lo.rightIn - (slideSpot + NOTICE_SLIDE)) / CHASE_SPEED);
    const Tc = this.chaseStart;
    const noticeAt = (x: number, dist: number) => Math.max(Tc, Tc + (lo.rightIn - (x + dist)) / CHASE_SPEED);
    const chaseEnd = Tc + (lo.rightIn - (lo.leftOut - 1.4)) / CHASE_SPEED;

    // Quvlovchi: o'ngdan chapga, banani tepada
    const chaseTr = travel(new Path([[lo.rightIn, LANE_CHASE], [lo.leftOut - 1.4, LANE_CHASE]]), Tc, CHASE_SPEED, 0.2);
    travelSeg(CHASER, chaseTr, "chase", 0.45, "chase", 0, (t, p) => {
      p.mouth = "shout";
      p.lid = 0.82;
      p.look.set(p.x - 3, 0.7, LANE_FLEE);
      p.wLook = 1;
    });

    // Qochish yo'li: avval kameraga tomon (jihozlardan chiqib), keyin chapga.
    // Hozircha faqat yig'iladi — oxirida bir-biriga urilmasligi tekshiriladi.
    const pendingFlee: Array<{ i: number; x0: number; z0: number; t0: number; delay: number }> = [];
    const flee = (i: number, x0: number, z0: number, t0: number) => {
      pendingFlee.push({ i, x0, z0, t0, delay: 0 });
      return t0;
    };
    // Jihozlar orasida turgan bo'lsa — avval oldinga chiqadi; allaqachon
    // oldinda bo'lsa (halinchakdan sakrab tushgan) — to'g'ri chapga yuguradi
    const fleePath = (f: { x0: number; z0: number }) =>
      new Path(
        f.z0 >= 0.5
          ? [
              [f.x0, f.z0],
              [f.x0 - 0.8, LANE_FLEE],
              [lo.leftOut - 0.8, LANE_FLEE],
            ]
          : [
              [f.x0, f.z0],
              [f.x0 + 0.05, Math.max(f.z0, 0.75)],
              [f.x0 - 0.55, LANE_FLEE],
              [lo.leftOut - 0.8, LANE_FLEE],
            ],
      );

    // ---------------------------------------------------------- arg'imchoq: o'yin va qochish
    const nSee = noticeAt(seatX, NOTICE_SEESAW);
    const cycles = Math.max(1, Math.ceil((nSee - this.seesawPlay) / b.total));
    this.seesawStop = this.seesawPlay + cycles * b.total;
    this.push(SEESAW_RIDER, this.seesawPlay, this.seesawStop, "play", 0, (t, p) => {
      const k = Math.floor((t - this.seesawPlay) / b.total);
      this.seesawRider(p, t - this.seesawPlay - k * b.total, k, t);
      if (t >= nSee) this.scared(p, t, 1, nSee);
    });
    const tSeeOff = this.seesawStop + 0.55;
    this.push(SEESAW_RIDER, this.seesawStop, tSeeOff, "dismount", 0, (t, p) => {
      const u = (t - this.seesawStop) / 0.55;
      this.seesawRider(this.tmp, b.total - 1e-3, 0, t);
      this.scared(this.tmp, t, 1);
      this.standAt(p, seatX - 0.4, 0.32, LEFT + 0.45);
      this.scared(p, t, 1);
      set(p.armL, 2.2, 0.45, 0.4);
      set(p.armR, 2.2, 0.45, 0.4);
      mixPose(p, this.tmp, p, smooth(u));
      p.heading = lerp(RIGHT, LEFT + 0.45, smooth(u));
      p.x = lerp(seatX, seatX - 0.4, smooth(u));
      p.z = lerp(0, 0.32, smooth(u));
      p.y = lerp(seatRest.y, 0, smooth(u)) + 0.12 * bump(u);
    });
    flee(SEESAW_RIDER, seatX - 0.4, 0.32, tSeeOff);

    // ---------------------------------------------------------- halinchak: o'yin, sakrash, qochish
    // Sakrash faqat oldinga ko'tarilayotganda (θ ≈ 0.72A) mumkin — bu oyna har
    // tebranishda bir marta keladi. Quvlovchi yetib kelmasdan eng so'nggi
    // oynani tanlaymiz; tor ekranda minion hayqiriqni ekran tashqarisidan eshitadi.
    const aRel = Math.asin(0.72);
    const win = (k: number) => this.swingPlay + (aRel + Math.PI * 2 * k) / SWING_OMEGA;
    const tLimit = Tc + (lo.rightIn - (lo.swingX - 0.1)) / CHASE_SPEED - 0.7;
    let kWin = Math.floor(((tLimit - this.swingPlay) * SWING_OMEGA - aRel) / (Math.PI * 2));
    while (kWin > 0 && win(kWin) > tLimit) kWin--;
    while (win(kWin) < this.swingPlay + 3.5) kWin++;
    const tauR = win(kWin) - this.swingPlay;
    this.swingRelease = win(kWin);
    const nSw = Math.min(noticeAt(lo.swingX, NOTICE_SWING), this.swingRelease - 0.45);
    const ampR = SWING_AMP * (1 - Math.exp(-tauR / 3.2));
    const thR = ampR * Math.sin(aRel);
    const dthR = ampR * SWING_OMEGA * Math.cos(aRel);
    this.swingFree = { th0: thR, dth0: -0.6 * dthR };
    this.push(SWINGER, this.swingPlay, this.swingRelease, "play", 0, (t, p) => {
      this.swinger(p, t - this.swingPlay, t);
      if (t >= nSw) {
        this.scared(p, t, 1, nSw);
        // Ortiga — bananli minionga qaraydi, oyoqlarini silkitmay qo'yadi
        // Ortiga — asosan ko'zlari bilan qaraydi, gavdasi biroz buriladi:
        // qo'llari zanjirni qo'yib yubormaydi
        p.twist = 0.62 + 0.3 * smooth((t - nSw) / 0.35);
        set(p.legL, 1.3, 0.12, 1.0);
        set(p.legR, 1.3, 0.12, 1.0);
      }
    });
    // Sakrash: o'rindiq tezligi + oyoq bilan itarilish, kameraga tomon
    swingPoint(thR, SWING.chain, _p);
    const L = SWING.chain;
    const x0 = lo.swingX + _p.x;
    const y0 = _p.y - 0.14;
    const vx = -Math.cos(thR) * L * dthR - 0.35;
    const vy = Math.sin(thR) * L * dthR + 0.6;
    const vz = 1.25;
    const tf = (vy + Math.sqrt(vy * vy + 2 * G * y0)) / G;
    const land = { x: x0 + vx * tf, z: vz * tf };
    const tLand = this.swingRelease + tf;
    this.push(SWINGER, this.swingRelease, tLand, "jump", 0, (t, p) => {
      const u = t - this.swingRelease;
      this.swinger(this.tmp, tauR, t);
      this.scared(this.tmp, t, 1);
      this.tmp.twist = 0.92;
      resetPose(p);
      this.scared(p, t, 1);
      set(p.armL, 2.7, 0.55, 0.3);
      set(p.armR, 2.7, 0.55, 0.3);
      set(p.legL, 0.45, 0.12, 0.55);
      set(p.legR, 0.3, 0.12, 0.45);
      p.heading = lerpAngle(LEFT, LEFT + 0.45, smooth(u / tf));
      mixPose(p, this.tmp, p, smooth(u / 0.22));
      p.x = x0 + vx * u;
      // Tayanch nuqta o'rindiqdan oyoq tagiga o'tadi — tos joyidan siljimaydi
      p.y = Math.max(0, y0 + vy * u - 0.5 * G * u * u) + 0.14 * (1 - smooth(u / 0.22));
      p.z = vz * u;
      p.pitch = lerp(-thR, 0, smooth(u / 0.3));
    });
    const tSwRun = tLand + 0.22;
    this.push(SWINGER, tLand, tSwRun, "land", 0, (t, p) => this.landing(p, land.x, land.z, LEFT + 0.45, (t - tLand) / 0.22, t));
    flee(SWINGER, land.x, land.z, tSwRun);

    // ---------------------------------------------------------- sirg'anchiq: reaksiya
    const hit = cycleSegs.findIndex((sg) => nSl >= sg.t0 && nSl < sg.t1);
    const current = cycleSegs[hit];
    for (let i = 0; i < hit; i++) this.tracks[SLIDER].push(cycleSegs[i]);
    const snapshot = createPose();
    // Qotib qolish holati — ko'rinib turgan holatning o'zi (silliq o'tish ham hisobda)
    const takeSnapshot = () => this.sample(SLIDER, nSl - 1e-4, snapshot);
    const scaredAfter = (sg: Seg): Seg => ({
      ...sg,
      fn: (t, p) => {
        sg.fn(t, p);
        if (t >= nSl) this.scared(p, t, 1, nSl);
      },
    });

    if (current.kind === "slide" || current.kind === "exit") {
      // Sirpanib ketyapti — oxirigacha tushadi, pastda to'xtamay qochadi
      const slideSeg = current.kind === "slide" ? current : cycleSegs[hit - 1];
      if (current.kind === "exit") this.tracks[SLIDER].pop();
      this.tracks[SLIDER].push(scaredAfter(slideSeg));
      this.hopOffAndFlee(slideSeg.t1, sim.exitSpeed, flee);
    } else if (current.kind.startsWith("hop")) {
      // Zinapoyada — qochish yo'li sirg'anchiqdan: qolgan pog'onalarni tez-tez
      // sakrab chiqib, darhol sirg'anib tushadi (quvlovchidan uzoqlashadi)
      this.tracks[SLIDER].push(scaredAfter(current));
      const level = Number(current.kind.slice(3)) + 1;
      let tt = current.t1;
      for (let j = level; j <= SLIDE.steps; j++) tt = this.pushHop(this.tracks[SLIDER], tt, j, H_CLIMB, true);
      this.panicSlide(tt, flee);
    } else if (current.kind === "transfer" || current.kind === "sit" || current.kind === "wiggle") {
      // Maydonchada — bir seskanib, darhol o'tirib sirg'anadi
      this.push(SLIDER, current.t0, nSl, current.kind, current.blend, current.fn);
      takeSnapshot();
      this.push(SLIDER, nSl, nSl + 0.25, "startle", 0, (t, p) => {
        copyPose(p, snapshot);
        this.scared(p, t, 1, nSl);
      });
      this.panicSlide(nSl + 0.25, flee);
    } else {
      // Yerda — bir lahza qotib qoladi, keyin qochadi
      this.push(SLIDER, current.t0, nSl, current.kind, current.blend, current.fn);
      takeSnapshot();
      this.push(SLIDER, nSl, nSl + 0.3, "startle", 0, (t, p) => {
        copyPose(p, snapshot);
        p.y = 0;
        this.startle(p, t, nSl);
        this.scared(p, t, 1, nSl);
      });
      flee(SLIDER, snapshot.x, snapshot.z, nSl + 0.3);
    }

    // ---------------------------------------------------------- qochish: to'qnashuvsiz
    // Ikki minion bir joyga bir vaqtda yetsa, keyinroq qochgani bir lahza
    // ortiga qarab turadi — keyin yuguradi
    const at = (f: (typeof pendingFlee)[number], t: number) => {
      const tr = travel(fleePath(f), f.t0 + f.delay, FLEE_SPEED, 0.3);
      if (t < tr.t0 || t > tr.t1) return null;
      return fleePath(f).point(travelDist(tr, t), { x: 0, y: 0 });
    };
    for (let iter = 0; iter < 12; iter++) {
      let moved = false;
      for (let a = 0; a < pendingFlee.length && !moved; a++) {
        for (let b = a + 1; b < pendingFlee.length && !moved; b++) {
          const A = pendingFlee[a];
          const B = pendingFlee[b];
          const from = Math.max(A.t0 + A.delay, B.t0 + B.delay);
          for (let t = from; t < from + 6 && !moved; t += 0.03) {
            const pa = at(A, t);
            const pb = at(B, t);
            if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) < 0.68) {
              (A.t0 + A.delay > B.t0 + B.delay ? A : B).delay += 0.12;
              moved = true;
            }
          }
        }
      }
      if (!moved) break;
    }
    for (const f of pendingFlee) {
      const t0 = f.t0 + f.delay;
      if (f.delay > 0) {
        this.push(f.i, f.t0, t0, "wait", 0.15, (t, p) => {
          this.standAt(p, f.x0, f.z0, LEFT + 0.9);
          this.startle(p, t, f.t0);
          this.scared(p, t, 1);
        });
      }
      travelSeg(f.i, travel(fleePath(f), t0, FLEE_SPEED, 0.3), "panic", 0.4, "flee", 0.22, (t, p) => {
        this.scared(p, t, 0.6);
        // Har 1.1 soniyada ortiga qarab oladi
        const w = bump(((t - t0) % 1.1) / 0.45) * ((t - t0) % 1.1 < 0.45 ? 1 : 0);
        p.twist += 1.05 * w;
      });
    }

    // ---------------------------------------------------------- davr
    const ends = this.tracks.map((tr) => (tr.length ? tr[tr.length - 1].t1 : 0));
    this.period = Math.max(chaseEnd, ...ends) + 1.3;
    this.startTime = playAll + 1.2;
    this.staticTime = playAll + 3.1;
  }

  private push(i: number, t0: number, t1: number, kind: string, blend: number, fn: Seg["fn"]) {
    if (t1 > t0) this.tracks[i].push({ t0, t1, blend, kind, fn });
  }

  /* ---------------------------------------------------------------- holatlar */

  private standAt(p: Pose, x: number, z: number, heading: number) {
    resetPose(p);
    p.x = x;
    p.z = z;
    p.heading = heading;
  }

  /** Bananli minionning boshi — qo'rqqanlar shunga qaraydi */
  chaserHead(t: number, out: Vector3) {
    const x = this.lo.rightIn - Math.max(0, t - this.chaseStart) * CHASE_SPEED;
    return out.set(x, 1.0, LANE_CHASE);
  }

  /** Qo'rqqan yuz: ko'zlar olayadi, qorachiq kichrayadi, baqiradi */
  private scared(p: Pose, t: number, w: number, since = -Infinity) {
    this.chaserHead(t, p.look);
    p.wLook = Math.max(p.wLook, w);
    p.lid = lerp(p.lid, 1.38, w);
    p.pupil = lerp(p.pupil, 0.58, w);
    p.mouth = "scream";
    // Ko'rgan zahoti seskanib ketadi
    const u = (t - since) / 0.28;
    if (u >= 0 && u <= 1) {
      p.squash *= 1 + 0.08 * bump(u);
      p.lean -= 0.12 * bump(u);
    }
  }

  /** Tik turgan joyida seskanib, biroz sakrab tushadi */
  private startle(p: Pose, t: number, since: number) {
    const u = (t - since) / 0.3;
    p.y += 0.06 * bump(u);
    set(p.armL, lerp(p.armL.pitch, 2.4, smooth(u)), 0.5, 0.4);
    set(p.armR, lerp(p.armR.pitch, 2.4, smooth(u)), 0.5, 0.4);
  }

  /** Yerga tushish: tizzalar bukiladi, tana biroz siqiladi, oyoqlar aniq joyida */
  private landing(p: Pose, x: number, z: number, heading: number, u: number, t: number) {
    this.standAt(p, x, z, heading);
    this.scared(p, t, 1);
    const k = bump(u);
    p.hip = STAND_HIP - 0.07 * k;
    p.squash = 1 - 0.14 * k;
    p.lean = 0.2 * k;
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    // Oyoqlar tana ostida, yelka kengligida
    p.footL.set(x + 0.09 * c + 0.03 * s, 0, z - 0.09 * s + 0.03 * c);
    p.footR.set(x - 0.09 * c + 0.03 * s, 0, z + 0.09 * s + 0.03 * c);
    p.wFootL = p.wFootR = 1;
    set(p.armL, 2.3, 0.6, 0.4);
    set(p.armR, 2.3, 0.6, 0.4);
  }

  private seesawRider(p: Pose, tau: number, k: number, t: number) {
    const b = this.bounce;
    resetPose(p);
    const phi = b.angle(tau);
    const sx = this.lo.seesawX;
    plankPoint(phi, SEAT_LOCAL.x, SEAT_LOCAL.y, _p);
    p.x = sx + _p.x;
    // Tutqichni ushlab turgani uchun qo'l bo'shlig'idan ortiq ko'tarila olmaydi
    p.y = _p.y + Math.min(b.lift(tau), 0.04);
    p.z = 0;
    p.heading = RIGHT;
    p.pitch = phi;
    p.hip = SIT_HIP;
    // Yuzi biroz kameraga (ko'proq burilsa o'ng qo'l tutqichga yetmaydi)
    p.twist = -0.12;
    const prepU = clamp(tau / b.prep, 0, 1);
    const landU = clamp((tau - (b.total - b.land)) / b.land, 0, 1);
    p.lean = 0.12 - 0.3 * phi + 0.26 * bump(prepU) * (tau < b.prep ? 1 : 0) + 0.14 * bump(landU);
    p.squash = 1 - 0.1 * bump(landU * 1.4) + 0.04 * bump((tau - b.prep) / 0.18);

    // Qo'llar tutqichda
    plankPoint(phi, HANDLE_LOCAL.x, HANDLE_LOCAL.y, _p);
    p.handL.set(sx + _p.x, _p.y, -0.15);
    p.handR.set(sx + _p.x, _p.y, 0.15);
    p.wHandL = 1;
    p.wHandR = 1;
    // Pastda oyoqlar yerda (itarilish), tepada osilib, tipirchilaydi
    // Taxta oyoqlar orasida: pastda oyoqlar uning ikki yonida yerga tiraladi
    const ground = 1 - smooth((phi + b.phiM) / 0.08);
    p.footL.set(p.x + 0.05, 0, -0.15);
    p.footR.set(p.x + 0.05, 0, 0.15);
    p.wFootL = ground;
    p.wFootR = ground;
    const kick = Math.sin(t * 9);
    set(p.legL, 0.55 + 0.12 * kick, 0.42, 0.35 + 0.2 * kick);
    set(p.legR, 0.55 - 0.12 * kick, 0.42, 0.35 - 0.2 * kick);
    // Har ikkinchi sakrashda tepada bir qo'lini ko'tarib qichqiradi
    if (k % 2 === 1) {
      const w = bump((tau - b.prep - b.T1 * 0.4) / (b.T1 * 0.6 + b.T2 * 0.6));
      p.wHandL = 1 - w;
      set(p.armL, 2.75, 0.5, 0.25);
    }
    const up = tau > b.prep && tau < b.total - b.land;
    p.mouth = up ? "grin" : "smile";
    p.look.set(sx + 0.9, 0.5, 0);
    p.wLook = 0.5;
  }

  /** Halinchak zanjirlaridagi kaft nuqtalari */
  private chainTargets(p: Pose, theta: number, above: number) {
    swingPoint(theta, SWING.chain - above, _p);
    p.handL.set(this.lo.swingX + _p.x, _p.y, SWING.chainZ);
    p.handR.set(this.lo.swingX + _p.x, _p.y, -SWING.chainZ);
    p.wHandL = 1;
    p.wHandR = 1;
  }

  private swinger(p: Pose, tau: number, t: number) {
    resetPose(p);
    const phase = SWING_OMEGA * tau;
    const amp = SWING_AMP * (1 - Math.exp(-tau / 3.2));
    const theta = amp * Math.sin(phase);
    swingPoint(theta, SWING.chain, _p);
    p.x = this.lo.swingX + _p.x;
    p.y = _p.y;
    p.z = 0;
    p.heading = LEFT;
    p.pitch = -theta;
    p.hip = SIT_HIP;
    // Yuzi kameraga — ikkala ko'zi ko'rinsin
    p.twist = 0.62;
    // Silkitish: oldinga borganda oyoqlar oldinga cho'ziladi, gavda orqaga;
    // orqaga ketganda oyoqlar o'rindiq ostiga, gavda oldinga
    const ext = (Math.sin(phase) * clamp(tau / 2, 0, 1) + 1) / 2;
    set(p.legL, lerp(1.34, 1.2, ext), 0.1, lerp(1.9, 0.12, ext));
    set(p.legR, lerp(1.34, 1.2, ext), 0.1, lerp(1.9, 0.12, ext));
    p.lean = lerp(0.2, -0.34, ext);
    this.chainTargets(p, theta, 0.46);
    p.mouth = ext > 0.7 ? "grin" : "smile";
    p.lookPitch = 0.12;
  }

  /** Tarnovda: s — tarnov bo'ylab masofa */
  private slidePose(p: Pose, s: number, tau: number, t: number, panic: boolean) {
    resetPose(p);
    chuteAt(s, _c);
    p.x = this.lo.slideX + _c.x;
    p.y = _c.y + 0.004;
    p.z = 0;
    p.heading = LEFT + 0.1;
    // Butun gavda tarnov bilan qiyshayadi, tana esa orqaga tashlanadi
    p.pitch = _c.slope;
    p.hip = SIT_HIP;
    p.lean = -0.7 * _c.slope - 0.12;
    p.twist = 0.3;
    set(p.legL, 1.5, 0.12, 0.06);
    set(p.legR, 1.5, 0.12, 0.06);
    const f = Math.sin(t * (panic ? 13 : 7));
    set(p.armL, 2.6 + 0.25 * f, 0.55, 0.25);
    set(p.armR, 2.6 - 0.25 * f, 0.55, 0.25);
    p.mouth = "grin";
    // Tushishning boshida qo'llar hali tarnov devorida
    if (tau < 0.25 && !panic) {
      const w = 1 - smooth(tau / 0.25);
      chuteAt(0.12, _c);
      p.handL.set(this.lo.slideX + _c.x, _c.y + SLIDE.wallH, SLIDE.bedW / 2);
      p.handR.set(this.lo.slideX + _c.x, _c.y + SLIDE.wallH, -SLIDE.bedW / 2);
      p.wHandL = w;
      p.wHandR = w;
    }
  }

  /**
   * Zinapoyada bitta sakrash: level-1 → level. O'tirib olish (tizzalar
   * bukiladi, qo'llar orqaga) → sakrash (parabola, qo'llar oldinga-tepaga
   * siltanadi, oyoqlar yig'iladi) → qo'nish (zarbni tizzalar yutadi).
   * Oyoqlar yerda turganda pog'onada aniq joyida (IK).
   */
  private pushHop(out: Seg[], t0: number, level: number, heading: number, panic: boolean): number {
    const a = stairSpot(level - 1, { x: 0, y: 0 });
    const b = stairSpot(level, { x: 0, y: 0 });
    const X = this.lo.slideX;
    const apex = 0.06;
    const dy = b.y - a.y;
    const vy = Math.sqrt(2 * G * (dy + apex));
    const flight = (vy + Math.sqrt(2 * G * apex)) / G;
    const crouch = panic ? 0.1 : 0.2;
    const land = panic ? 0.1 : 0.18;
    const dur = crouch + flight + land;
    // Oyoqlar tos ostida: chap oyoq minionning chap tomonida (heading bo'yicha)
    const lx = Math.cos(heading) * 0.09;
    const lz = -Math.sin(heading) * 0.09;
    const feet = (p: Pose, x: number, y: number) => {
      p.footL.set(X + x + lx, y, lz);
      p.footR.set(X + x - lx, y, -lz);
      p.wFootL = 1;
      p.wFootR = 1;
    };
    out.push({
      t0,
      t1: t0 + dur,
      blend: level === 1 ? 0.2 : 0,
      kind: `hop${level}`,
      fn: (t, p) => {
        resetPose(p);
        const tau = t - t0;
        p.heading = heading;
        p.z = 0;
        p.mouth = panic ? "scream" : "smile";
        p.look.set(X + SLIDE_GEO.deckLeft, SLIDE.deckY + 0.7, 0);
        p.wLook = panic ? 0 : 0.6;
        if (tau < crouch) {
          const u = smooth(tau / crouch);
          p.x = X + a.x;
          p.y = a.y;
          p.hip = STAND_HIP - 0.055 * u;
          p.lean = 0.28 * u;
          p.squash = 1 - 0.06 * u;
          set(p.armL, -0.75 * u, 0.2, 0.3);
          set(p.armR, -0.75 * u, 0.2, 0.3);
          feet(p, a.x, a.y);
        } else if (tau < crouch + flight) {
          const f = tau - crouch;
          const u = f / flight;
          p.x = X + lerp(a.x, b.x, smooth(u));
          p.y = a.y + vy * f - 0.5 * G * f * f;
          // Itarilish: tos bukilgan holatdan to'g'rilanib boradi
          p.hip = STAND_HIP - 0.055 * (1 - smooth(f / 0.09));
          p.lean = lerp(0.28, 0.08, smooth(u / 0.3));
          p.squash = 1 + 0.06 * bump(u);
          set(p.armL, lerp(-0.75, 1.7, smooth(u / 0.35)), 0.25, 0.3);
          set(p.armR, lerp(-0.75, 1.7, smooth(u / 0.35)), 0.25, 0.3);
          set(p.legL, 0.38 * bump(u), 0.08, 0.9 * bump(u));
          set(p.legR, 0.38 * bump(u), 0.08, 0.9 * bump(u));
          // Oyoqlar yerdan asta uziladi, qo'nishdan oldin pog'onani oldindan "topadi"
          const off = 1 - smooth(f / 0.08);
          const on = smooth((u - 0.82) / 0.18);
          if (off > 0.001) {
            feet(p, a.x, a.y);
            p.wFootL = off;
            p.wFootR = off;
          } else if (on > 0.001) {
            feet(p, b.x, b.y);
            p.wFootL = on;
            p.wFootR = on;
          }
        } else {
          const u = (tau - crouch - flight) / land;
          const k = bump(u);
          p.x = X + b.x;
          p.y = b.y;
          p.hip = STAND_HIP - 0.06 * k;
          p.squash = 1 - 0.12 * k;
          p.lean = 0.2 * k + 0.08 * (1 - u);
          set(p.armL, lerp(1.7, 0.3, smooth(u)), 0.25, 0.3);
          set(p.armR, lerp(1.7, 0.3, smooth(u)), 0.25, 0.3);
          feet(p, b.x, b.y);
        }
      },
    });
    return t0 + dur;
  }

  /** Maydonchadan darhol o'tirib, qo'rquvdan qichqirib sirg'anadi, pastda qochadi */
  private panicSlide(t0: number, flee: (i: number, x0: number, z0: number, t0: number) => number) {
    const tSit = t0 + 0.32;
    this.push(SLIDER, t0, tSit, "sit", 0.22, (t, p) => {
      this.slidePose(p, 0, 0, t, true);
      this.scared(p, t, 1);
    });
    const fast = simulateSlide(0.9);
    const tDown = tSit + fast.duration;
    this.push(SLIDER, tSit, tDown, "slide", 0, (t, p) => {
      const st = fast.at(t - tSit);
      this.slidePose(p, st.s, t - tSit, t, true);
      this.scared(p, t, 1);
    });
    this.hopOffAndFlee(tDown, fast.exitSpeed, flee);
  }

  /**
   * Sirg'anchiqning bitta sikli: zinapoyadan sakrab chiqish → maydonchada
   * yurish → o'tirish → itarilish → sirpanish → sakrab tushish → xursand
   * bo'lish → zinapoyaga qaytish → burilish.
   */
  private slideCycle(out: Seg[], T: number, sim: ReturnType<typeof simulateSlide>, H_CLIMB: number): number {
    const lo = this.lo;
    const X = lo.slideX;
    const deckL = X + SLIDE_GEO.deckLeft;
    let t = T;
    const add = (dur: number, kind: string, blend: number, fn: (u: number, tt: number, p: Pose) => void) => {
      const t0 = t;
      out.push({ t0, t1: t0 + dur, blend, kind, fn: (tt, p) => fn(clamp((tt - t0) / dur, 0, 1), tt, p) });
      t += dur;
    };

    for (let j = 1; j <= SLIDE.steps + 1; j++) t = this.pushHop(out, t, j, H_CLIMB, false);

    // Maydonchada ikki kichik qadam — tarnov boshiga
    const top = stairSpot(SLIDE.steps + 1, { x: 0, y: 0 });
    const dStart = X + top.x;
    const dEnd = deckL + 0.16;
    add(0.5, "transfer", 0.12, (u, tt, p) => {
      resetPose(p);
      p.x = lerp(dStart, dEnd, smooth(u));
      p.y = SLIDE.deckY;
      p.heading = LEFT + 0.25;
      applyGait(p, dStart - p.x, "walk", tt);
      p.mouth = "grin";
    });

    // Tarnov boshiga o'tiradi, qo'llari tarnov devorida
    add(0.45, "sit", 0.2, (u, tt, p) => {
      this.slidePose(p, 0, 0, tt, false);
      set(p.armL, 0.4, 0.3, 0.3);
      set(p.armR, 0.4, 0.3, 0.3);
      chuteAt(0.12, _c);
      p.handL.set(X + _c.x, _c.y + SLIDE.wallH, SLIDE.bedW / 2);
      p.handR.set(X + _c.x, _c.y + SLIDE.wallH, -SLIDE.bedW / 2);
      p.wHandL = smooth(u / 0.6);
      p.wHandR = smooth(u / 0.6);
      p.mouth = "smile";
    });

    // Itarilishdan oldin orqaga-oldinga chayqaladi
    add(0.35, "wiggle", 0.1, (u, tt, p) => {
      this.slidePose(p, 0, 0, tt, false);
      chuteAt(0.12, _c);
      p.handL.set(X + _c.x, _c.y + SLIDE.wallH, SLIDE.bedW / 2);
      p.handR.set(X + _c.x, _c.y + SLIDE.wallH, -SLIDE.bedW / 2);
      p.wHandL = 1;
      p.wHandR = 1;
      p.lean += -0.12 * bump(u * 2) + 0.2 * bump(u * 2 - 1);
      p.mouth = "grin";
    });

    add(sim.duration, "slide", 0.1, (u, tt, p) => {
      const tau = u * sim.duration;
      const st = sim.at(tau);
      this.slidePose(p, st.s, tau, tt, false);
    });

    // Labdan sakrab tushadi: tezlik ishqalanish bilan so'nadi
    const v = sim.exitSpeed;
    const dec = 7.5;
    const xStop = X - (v * v) / (2 * dec);
    add(0.34, "exit", 0, (u, tt, p) => {
      const tau = u * 0.34;
      const tm = Math.min(tau, v / dec);
      this.slidePose(this.tmp, SLIDE_GEO.length, 1, tt, false);
      resetPose(p);
      const k = bump(clamp(tau / 0.3, 0, 1));
      p.heading = LEFT + 0.1;
      p.hip = STAND_HIP - 0.06 * k;
      p.squash = 1 - 0.12 * k;
      set(p.legL, 0.3, 0.1, 0.6 * k);
      set(p.legR, 0.3, 0.1, 0.6 * k);
      set(p.armL, 2.6, 0.55, 0.25);
      set(p.armR, 2.6, 0.55, 0.25);
      p.mouth = "grin";
      mixPose(p, this.tmp, p, smooth(tau / 0.18));
      p.x = X - (v * tm - 0.5 * dec * tm * tm);
      p.y = lerp(SLIDE.lipY + 0.004, 0, smooth(tau / 0.2));
      p.z = 0;
      p.pitch = 0;
    });

    // "Yashasin!" — qo'llar tepada, kameraga qarab sakraydi
    add(0.6, "celebrate", 0.3, (u, tt, p) => {
      this.standAt(p, xStop, 0, LEFT + 1.2);
      p.y = 0.07 * bump(u);
      set(p.armL, 2.95, 0.6 + 0.15 * Math.sin(tt * 12), 0.2);
      set(p.armR, 2.95, 0.6 + 0.15 * Math.sin(tt * 12 + 1), 0.2);
      p.squash = 1 + 0.05 * bump(u);
      p.mouth = "grin";
    });

    // Tarnov oldidan aylanib, zinapoyaga qaytadi
    const baseX = X + SLIDE_GEO.base;
    const back = travel(
      new Path([
        [xStop, 0],
        [xStop + 0.15, 0.62],
        [baseX + 0.05, 0.62],
        [baseX, 0.02],
      ]),
      t,
      WALK_SPEED,
      0.3,
    );
    add(back.t1 - back.t0, "walk", 0.2, (u, tt, p) => {
      resetPose(p);
      const s = travelDist(back, tt);
      back.path.point(s, _p);
      p.x = _p.x;
      p.z = _p.y;
      p.heading = biased(back.path.heading(s), 0.3);
      applyGait(p, s, "walk", tt);
    });

    const endHeading = biased(back.path.heading(back.path.length), 0.3);
    add(0.45, "turn", 0.15, (u, tt, p) => {
      this.standAt(p, baseX, 0.02, lerpAngle(endHeading, H_CLIMB, smooth(u)));
    });
    return t;
  }

  /** Tarnov labidan sakrab, to'xtamasdan qochib ketadi */
  private hopOffAndFlee(t0: number, speed: number, flee: (i: number, x0: number, z0: number, t0: number) => number) {
    const X = this.lo.slideX;
    const dur = 0.24;
    const x1 = X - speed * dur * 0.8;
    this.push(SLIDER, t0, t0 + dur, "hop", 0, (t, p) => {
      const u = (t - t0) / dur;
      this.slidePose(this.tmp, SLIDE_GEO.length, 1, t, true);
      this.scared(this.tmp, t, 1);
      this.landing(p, lerp(X, x1, u), 0, LEFT + 0.3, u, t);
      mixPose(p, this.tmp, p, smooth(u / 0.5));
      p.x = lerp(X, x1, u);
      p.y = lerp(SLIDE.lipY, 0, smooth(u / 0.6));
      p.z = 0;
    });
    flee(SLIDER, x1, 0, t0 + dur);
  }

  /* ---------------------------------------------------------------- jihozlar */

  /** Arg'imchoq taxtasi burchagi (φ > 0 — chap uchi tepada) */
  plankAngle(t: number): number {
    if (t < this.seesawPlay || t >= this.seesawStop) return -SEESAW_TILT;
    const tau = (t - this.seesawPlay) % this.bounce.total;
    return this.bounce.angle(tau);
  }

  /** Halinchak burchagi (θ > 0 — o'rindiq chapda) */
  swingAngle(t: number): number {
    if (t < this.swingMount) return 0;
    if (t < this.swingPlay) return -0.07 * bump((t - this.swingMount) / 0.5);
    if (t < this.swingRelease) {
      const tau = t - this.swingPlay;
      return SWING_AMP * (1 - Math.exp(-tau / 3.2)) * Math.sin(SWING_OMEGA * tau);
    }
    // Minion sakrab ketdi: o'rindiq orqaga tepiladi va so'nib boradi
    const tau = t - this.swingRelease;
    const beta = 0.55;
    const { th0, dth0 } = this.swingFree;
    const w = SWING_OMEGA_EMPTY;
    return Math.exp(-beta * tau) * (th0 * Math.cos(w * tau) + ((dth0 + beta * th0) / w) * Math.sin(w * tau));
  }

  /* ---------------------------------------------------------------- baholash */

  /** Tekshirish uchun: har bir minionning bo'laklari (nomi va vaqti) */
  timeline() {
    return this.tracks.map((tr) => tr.map((sg) => ({ kind: sg.kind, t0: sg.t0, t1: sg.t1 })));
  }

  evaluate(t: number, poses: Pose[]) {
    for (let i = 0; i < this.tracks.length; i++) this.sample(i, t, poses[i]);
  }

  /** Bitta minionning t paytdagi holati (bo'laklar orasidagi silliq o'tish bilan) */
  private sample(i: number, t: number, p: Pose) {
    const track = this.tracks[i];
    let idx = -1;
    for (let j = 0; j < track.length; j++) {
      if (t >= track[j].t0 && t < track[j].t1) {
        idx = j;
        break;
      }
    }
    if (idx < 0) {
      p.visible = false;
      return;
    }
    const seg = track[idx];
    seg.fn(t, p);
    p.visible = true;
    if (seg.blend > 0 && idx > 0 && t - seg.t0 < seg.blend) {
      const prev = track[idx - 1];
      if (Math.abs(prev.t1 - seg.t0) < 1e-6) {
        prev.fn(prev.t1 - 1e-4, this.prevPose);
        this.prevPose.visible = true;
        mixPose(p, this.prevPose, p, smooth((t - seg.t0) / seg.blend));
      }
    }
  }
}
