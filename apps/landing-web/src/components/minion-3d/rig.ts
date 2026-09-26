/**
 * Minion — 3D model va "skelet".
 *
 * Tana kapsula; kombinezon, ko'zoynak tasmasi, og'iz va cho'ntak tana
 * sirtini aylanib chiqadigan (lathe) bo'laklar — sirtga yopishib turadi,
 * ko'tarilib qolmaydi. Ko'z — metall gardishli ko'zoynak ichidagi olma:
 * qorachig'i qaragan tomonga buriladi, qovoqlari yumiladi.
 *
 * Qo'l va oyoqlar ikki bo'g'imli. Odatda burchaklar bilan boshqariladi (FK);
 * tutqich, zanjir yoki narvon pog'onasini ushlashda esa kaft/tovon aniq
 * nuqtaga qo'yiladi (IK) — minion narsani "havoda" emas, haqiqatan ushlaydi.
 */
import {
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Euler,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";
import { clamp } from "./dims";

export type Expression = "smile" | "grin" | "scream" | "shout";

/** Yelka/son: oldinga (+), yonga (+ tashqariga); tirsak/tizza bukilishi */
export interface Limb {
  pitch: number;
  roll: number;
  bend: number;
}

export interface Pose {
  visible: boolean;
  /** Tayanch nuqta: tik turganda — oyoq ostidagi yer, o'tirganda — o'rindiq */
  x: number;
  y: number;
  z: number;
  /** Qayoqqa qarab turgani: 0 — kameraga, −π/2 — chapga, +π/2 — o'ngga */
  heading: number;
  /** Butun gavda og'ishi (+ oldinga) — halinchak, arg'imchoq, qiyalik */
  pitch: number;
  roll: number;
  /** Tos balandligi tayanch nuqtadan */
  hip: number;
  /** Tana: oldinga egilish, burilish (+ chapga), yonga qiyshayish */
  lean: number;
  twist: number;
  side: number;
  /** Siqilish-cho'zilish: 1 — oddiy, <1 — yerga tushgandagi zarb */
  squash: number;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  /** IK nishonlari (dunyo koordinatasi) va og'irligi: 0 — FK, 1 — aniq nuqta */
  handL: Vector3;
  handR: Vector3;
  footL: Vector3;
  footR: Vector3;
  wHandL: number;
  wHandR: number;
  wFootL: number;
  wFootR: number;
  /** Ko'zlar qaraydigan nuqta; wLook = 0 bo'lsa lookYaw/lookPitch */
  look: Vector3;
  wLook: number;
  lookYaw: number;
  lookPitch: number;
  /** Qovoq: 1 — oddiy, 0 — yumuq, 1.3 — ko'zi olayib ketgan */
  lid: number;
  /** Qorachiq: 1 — oddiy, 0.6 — qo'rqqan */
  pupil: number;
  mouth: Expression;
}

/** Tik turganda tos balandligi: son + boldir + botinka */
export const THIGH = 0.068;
export const SHIN = 0.068;
export const ANKLE = 0.047;
export const STAND_HIP = THIGH + SHIN + ANKLE;
/** O'tirganda tos o'rindiqdan shuncha yuqorida (tana tubi o'rindiqqa tegadi) */
export const SIT_HIP = 0.05;
/** Tana tubi tosdan qancha pastda */
const BODY_BOTTOM = -0.05;

const limb = (): Limb => ({ pitch: 0, roll: 0, bend: 0 });

export function createPose(): Pose {
  const p: Pose = {
    visible: false,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    hip: STAND_HIP,
    lean: 0,
    twist: 0,
    side: 0,
    squash: 1,
    armL: limb(),
    armR: limb(),
    legL: limb(),
    legR: limb(),
    handL: new Vector3(),
    handR: new Vector3(),
    footL: new Vector3(),
    footR: new Vector3(),
    wHandL: 0,
    wHandR: 0,
    wFootL: 0,
    wFootR: 0,
    look: new Vector3(),
    wLook: 0,
    lookYaw: 0,
    lookPitch: 0,
    lid: 1,
    pupil: 1,
    mouth: "smile",
  };
  resetPose(p);
  return p;
}

const setLimb = (l: Limb, pitch: number, roll: number, bend: number) => {
  l.pitch = pitch;
  l.roll = roll;
  l.bend = bend;
};

/** Tik, bo'sh turgan holat — boshqa hamma holat shundan boshlanadi */
export function resetPose(p: Pose) {
  p.visible = true;
  // Joy ham tozalanadi: bo'lak uni o'zi qo'yishi shart (eski qiymat qolmasin)
  p.x = 0;
  p.y = 0;
  p.z = 0;
  p.pitch = 0;
  p.roll = 0;
  p.hip = STAND_HIP;
  p.lean = 0.02;
  p.twist = 0;
  p.side = 0;
  p.squash = 1;
  setLimb(p.armL, 0.06, 0.14, 0.28);
  setLimb(p.armR, 0.06, 0.14, 0.28);
  setLimb(p.legL, 0, 0.05, 0.06);
  setLimb(p.legR, 0, 0.05, 0.06);
  p.wHandL = 0;
  p.wHandR = 0;
  p.wFootL = 0;
  p.wFootR = 0;
  p.wLook = 0;
  p.lookYaw = 0;
  p.lookPitch = 0;
  p.lid = 1;
  p.pupil = 1;
  p.mouth = "smile";
}

export function copyPose(dst: Pose, src: Pose) {
  mixPose(dst, src, src, 0);
}

const mixLimb = (d: Limb, a: Limb, b: Limb, w: number) => {
  d.pitch = a.pitch + (b.pitch - a.pitch) * w;
  d.roll = a.roll + (b.roll - a.roll) * w;
  d.bend = a.bend + (b.bend - a.bend) * w;
};

/** IK nishonini aralashtirish: og'irligi 0 bo'lgan tomonning nuqtasi ma'nosiz */
const mixTarget = (d: Vector3, a: Vector3, wa: number, b: Vector3, wb: number, w: number) => {
  if (wa <= 0) d.copy(b);
  else if (wb <= 0) d.copy(a);
  else d.lerpVectors(a, b, w);
};

/** d = a·(1−w) + b·w (d a yoki b bilan bir xil bo'lishi mumkin) */
export function mixPose(d: Pose, a: Pose, b: Pose, w: number) {
  const L = (x: number, y: number) => x + (y - x) * w;
  d.visible = a.visible || b.visible;
  d.x = L(a.x, b.x);
  d.y = L(a.y, b.y);
  d.z = L(a.z, b.z);
  // Burilish eng qisqa yo'l bilan (−π/π chegarasidan aylanib ketmasin)
  let dh = (b.heading - a.heading) % (Math.PI * 2);
  if (dh > Math.PI) dh -= Math.PI * 2;
  if (dh < -Math.PI) dh += Math.PI * 2;
  d.heading = a.heading + dh * w;
  d.pitch = L(a.pitch, b.pitch);
  d.roll = L(a.roll, b.roll);
  d.hip = L(a.hip, b.hip);
  d.lean = L(a.lean, b.lean);
  d.twist = L(a.twist, b.twist);
  d.side = L(a.side, b.side);
  d.squash = L(a.squash, b.squash);
  mixLimb(d.armL, a.armL, b.armL, w);
  mixLimb(d.armR, a.armR, b.armR, w);
  mixLimb(d.legL, a.legL, b.legL, w);
  mixLimb(d.legR, a.legR, b.legR, w);
  mixTarget(d.handL, a.handL, a.wHandL, b.handL, b.wHandL, w);
  mixTarget(d.handR, a.handR, a.wHandR, b.handR, b.wHandR, w);
  mixTarget(d.footL, a.footL, a.wFootL, b.footL, b.wFootL, w);
  mixTarget(d.footR, a.footR, a.wFootR, b.footR, b.wFootR, w);
  mixTarget(d.look, a.look, a.wLook, b.look, b.wLook, w);
  d.wHandL = L(a.wHandL, b.wHandL);
  d.wHandR = L(a.wHandR, b.wHandR);
  d.wFootL = L(a.wFootL, b.wFootL);
  d.wFootR = L(a.wFootR, b.wFootR);
  d.wLook = L(a.wLook, b.wLook);
  d.lookYaw = L(a.lookYaw, b.lookYaw);
  d.lookPitch = L(a.lookPitch, b.lookPitch);
  d.lid = L(a.lid, b.lid);
  d.pupil = L(a.pupil, b.pupil);
  d.mouth = w < 0.5 ? a.mouth : b.mouth;
}

/* ------------------------------------------------------------------ ikki bo'g'imli IK */

const _u = new Vector3();
const _perp = new Vector3();
const _upper = new Vector3();
const _elbow = new Vector3();
const _fore = new Vector3();
const _bx = new Vector3();
const _by = new Vector3();
const _bz = new Vector3();
const _basis = new Matrix4();

/**
 * Yelka (son) bo'g'imi uchun aylanish va tirsak (tizza) bukilishini topadi:
 * kaft (tovon) `target` ga yetadi, tirsak `pole` tomonga qaraydi.
 * Suyaklar tinch holatda −y bo'ylab osilgan; bukilish — bo'g'imning x o'qi atrofida.
 */
function solveTwoBone(
  root: Vector3,
  target: Vector3,
  a: number,
  b: number,
  pole: Vector3,
  outQuat: Quaternion,
): number {
  _u.subVectors(target, root);
  const dist = clamp(_u.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  if (_u.lengthSq() < 1e-10) _u.set(0, -1, 0);
  _u.normalize();
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
  const alpha = Math.acos(cosA);
  _perp.copy(pole).addScaledVector(_u, -pole.dot(_u));
  if (_perp.lengthSq() < 1e-8) _perp.set(0, 0, 1).addScaledVector(_u, -_u.z);
  _perp.normalize();
  _upper.copy(_u).multiplyScalar(Math.cos(alpha)).addScaledVector(_perp, Math.sin(alpha));
  _elbow.copy(root).addScaledVector(_upper, a);
  _fore.copy(root).addScaledVector(_u, dist).sub(_elbow).normalize();
  _bx.crossVectors(_upper, _fore);
  if (_bx.lengthSq() < 1e-8) _bx.crossVectors(_upper, _perp);
  _bx.normalize();
  _by.copy(_upper).negate();
  _bz.crossVectors(_bx, _by);
  _basis.makeBasis(_bx, _by, _bz);
  outQuat.setFromRotationMatrix(_basis);
  return Math.acos(clamp(_upper.dot(_fore), -1, 1));
}

/* ------------------------------------------------------------------ model */

export interface HairStrand {
  /** Boshning qaysi tomonida (0 — old) */
  yaw: number;
  /** Tikdan og'ishi */
  tilt: number;
  len: number;
  /** Uchining egilishi */
  bend: number;
}

export interface MinionSpec {
  /** Tana radiusi */
  radius: number;
  /** Kapsulaning silindr qismi */
  length: number;
  eyes: 1 | 2;
  hair: HairStrand[];
  seed: number;
}

export interface RigMaterials {
  skin: Material;
  denim: Material;
  denimDark: Material;
  glove: Material;
  shoe: Material;
  metal: Material;
  metalDark: Material;
  strap: Material;
  glass: Material;
  eyeWhite: Material;
  iris: Material;
  pupil: Material;
  hair: Material;
  mouthMaps: Record<Expression, Texture>;
}

interface Eye {
  mount: Group;
  ball: Group;
  upper: Mesh;
  lower: Mesh;
  pupil: Mesh;
}

const _a = new Vector3();
const _b = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _e = new Euler();
const _pole = new Vector3();

function rng32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MinionRig {
  readonly root = new Group();
  /** O'ng kaft — banan shu yerga biriktiriladi */
  readonly rightHand: Group;

  private readonly pelvis = new Group();
  private readonly torso = new Group();
  /** Siqilish-cho'zilish faqat tanaga (qo'llar cho'zilib ketmasin) */
  private readonly shape = new Group();
  private readonly shoulders: [Group, Group];
  private readonly elbows: [Group, Group];
  private readonly hands: [Group, Group];
  private readonly hips: [Group, Group];
  private readonly knees: [Group, Group];
  private readonly feet: [Group, Group];
  private readonly shoulderY: number;
  private readonly hairY: number;
  private readonly eyes: Eye[] = [];
  private readonly hair = new Group();
  private readonly mouthMat: MeshStandardMaterial;
  private readonly maps: Record<Expression, Texture>;
  private readonly geos: BufferGeometry[] = [];
  private readonly upperLen: number;
  private readonly reach: number;
  private readonly r: number;
  private readonly c: number;
  private mouth: Expression = "smile";

  // Soch prujinasi
  private readonly hairAngle = new Vector2();
  private readonly hairVel = new Vector2();
  private readonly prevHead = new Vector3();
  private readonly prevVel = new Vector3();
  private hasPrev = false;

  // Ko'z pirpiratish
  private readonly rand: () => number;
  private nextBlink: number;
  private blinkAt = -10;

  constructor(spec: MinionSpec, private readonly mats: RigMaterials) {
    const r = spec.radius;
    const c = spec.length;
    const k = r / 0.28;
    this.r = r;
    this.c = c;
    this.rand = rng32(spec.seed);
    this.nextBlink = 1 + this.rand() * 3;
    this.maps = mats.mouthMaps;

    const h = c + 2 * r;
    const at = (f: number) => BODY_BOTTOM + f * h;
    const waistY = at(0.3);
    const bibTop = at(0.47);
    const mouthY = at(0.575);
    const eyeY = at(0.71);
    this.shoulderY = at(0.43);
    this.hairY = BODY_BOTTOM + h - 0.004;

    this.root.add(this.pelvis);
    this.pelvis.add(this.torso);
    this.torso.add(this.shape);

    const add = (parent: Group, geo: BufferGeometry, mat: Material, shadow = true): Mesh => {
      this.geos.push(geo);
      const m = new Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // --- Tana ---
    const body = add(this.shape, new CapsuleGeometry(r, c, 16, 48), mats.skin);
    body.position.y = BODY_BOTTOM + r + c / 2;

    // Kombinezon shimi: tana tubidan belgacha, sirtni aylanib
    const pants: Vector2[] = [new Vector2(0, BODY_BOTTOM - 0.006)];
    for (let i = 1; i <= 14; i++) {
      const th = -Math.PI / 2 + (i / 14) * (Math.PI / 2);
      pants.push(new Vector2((r + 0.006) * Math.cos(th), BODY_BOTTOM + r + (r + 0.006) * Math.sin(th)));
    }
    if (waistY > BODY_BOTTOM + r) pants.push(new Vector2(r + 0.006, waistY));
    add(this.shape, new LatheGeometry(pants, 56), mats.denim);
    add(this.shape, this.lathe(waistY - 0.026, waistY + 0.004, 0.011, 3), mats.denimDark);

    // Ko'krakcha (old panel), cho'ntak, tasmalar, tugmalar
    add(this.shape, this.lathe(waistY, bibTop, 0.008, 6, -0.5, 1.0, 20), mats.denim);
    add(this.shape, this.lathe(bibTop - 0.012, bibTop, 0.012, 1, -0.5, 1.0, 20), mats.denimDark);
    const pocketY = (waistY + bibTop) / 2 + 0.006;
    add(this.shape, this.lathe(pocketY - 0.034, pocketY + 0.034, 0.012, 3, -0.19, 0.38, 10), mats.denimDark);
    for (const s of [-1, 1]) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const phi = s * (0.42 + t * 2.3);
        const y = bibTop + (waistY + 0.03 - bibTop) * t + 0.075 * Math.sin(Math.PI * t);
        const rr = this.surfR(y) + 0.012;
        pts.push(new Vector3(Math.sin(phi) * rr, y, Math.cos(phi) * rr));
      }
      add(this.shape, new TubeGeometry(new CatmullRomCurve3(pts), 40, 0.013 * k, 6), mats.denim);
      const bpY = bibTop - 0.016;
      const bR = this.surfR(bpY) + 0.016;
      const button = add(this.shape, new CylinderGeometry(0.017 * k, 0.017 * k, 0.012, 16), mats.metal, false);
      button.position.set(Math.sin(s * 0.42) * bR, bpY, Math.cos(s * 0.42) * bR);
      button.rotation.set(Math.PI / 2, s * 0.42, 0, "YXZ");
    }

    // --- Ko'zoynak tasmasi va ko'zlar ---
    add(this.shape, this.lathe(eyeY - 0.038 * k, eyeY + 0.038 * k, 0.007, 4), mats.strap);
    const eyeYaws = spec.eyes === 2 ? [0.34, -0.34] : [0];
    const rin = (spec.eyes === 2 ? 0.078 : 0.104) * k;
    for (const yaw of eyeYaws) this.buildEye(yaw, eyeY, rin);

    // --- Og'iz ---
    this.mouthMat = new MeshStandardMaterial({
      map: mats.mouthMaps.smile,
      transparent: true,
      roughness: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mh = 0.13 * k;
    add(this.shape, this.lathe(mouthY - mh / 2, mouthY + mh / 2, 0.004, 4, -0.5, 1.0, 20), this.mouthMat, false);

    // --- Soch ---
    this.torso.add(this.hair);
    this.hair.position.y = this.hairY;
    const top = new Vector3(0, BODY_BOTTOM + r + c, 0);
    for (const strand of spec.hair) {
      const n = new Vector3(
        Math.sin(strand.tilt) * Math.sin(strand.yaw),
        Math.cos(strand.tilt),
        Math.sin(strand.tilt) * Math.cos(strand.yaw),
      );
      const base = top.clone().addScaledVector(n, r - 0.006);
      const side = new Vector3(Math.cos(strand.yaw), 0, -Math.sin(strand.yaw));
      const mid = base.clone().addScaledVector(n, strand.len * 0.55).addScaledVector(side, strand.bend * strand.len * 0.25);
      const tip = base.clone().addScaledVector(n, strand.len).addScaledVector(side, strand.bend * strand.len);
      const pts = [base, mid, tip].map((p) => p.sub(new Vector3(0, this.hairY, 0)));
      add(this.hair, new TubeGeometry(new CatmullRomCurve3(pts), 10, 0.0058, 5), mats.hair, false);
    }

    // --- Qo'llar ---
    // Haqiqiy minionlardagidek qo'l tana bo'yining ~40% i
    this.upperLen = 0.165 * k;
    const foreLen = 0.155 * k;
    this.reach = foreLen + 0.034;
    const arm = (side: 1 | -1): [Group, Group, Group] => {
      const shoulder = new Group();
      shoulder.position.set(side * (this.surfR(this.shoulderY) - 0.014), this.shoulderY, -0.01);
      this.torso.add(shoulder);
      add(shoulder, new SphereGeometry(0.03, 12, 10), mats.skin);
      const up = add(shoulder, new CapsuleGeometry(0.027, this.upperLen - 0.03, 6, 14), mats.skin);
      up.position.y = -this.upperLen / 2;
      const elbow = new Group();
      elbow.position.y = -this.upperLen;
      shoulder.add(elbow);
      const fo = add(elbow, new CapsuleGeometry(0.026, foreLen - 0.03, 6, 14), mats.skin);
      fo.position.y = -foreLen / 2;
      const hand = new Group();
      hand.position.y = -foreLen;
      elbow.add(hand);
      const cuff = add(hand, new CylinderGeometry(0.033, 0.041, 0.034, 18), mats.glove);
      cuff.position.y = 0.004;
      const palm = add(hand, new SphereGeometry(0.046, 20, 16), mats.glove);
      palm.scale.set(0.95, 1.12, 0.8);
      palm.position.y = -0.034;
      const thumb = add(hand, new CapsuleGeometry(0.014, 0.03, 4, 10), mats.glove);
      thumb.position.set(side * 0.03, -0.028, 0.022);
      thumb.rotation.set(0.5, 0, side * 0.7);
      return [shoulder, elbow, hand];
    };
    const [sl, el, hl] = arm(1);
    const [sr, er, hr] = arm(-1);
    this.shoulders = [sl, sr];
    this.elbows = [el, er];
    this.hands = [hl, hr];
    this.rightHand = hr;

    // --- Oyoqlar (kombinezon shimi + botinka) ---
    const leg = (side: 1 | -1): [Group, Group, Group] => {
      const hip = new Group();
      hip.position.set(side * 0.095 * k, 0, 0.01);
      this.pelvis.add(hip);
      add(hip, new SphereGeometry(0.052, 16, 12), mats.denim);
      const th = add(hip, new CylinderGeometry(0.052, 0.048, THIGH, 18), mats.denim);
      th.position.y = -THIGH / 2;
      const knee = new Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      add(knee, new SphereGeometry(0.048, 14, 10), mats.denim);
      const sh = add(knee, new CylinderGeometry(0.047, 0.051, SHIN, 18), mats.denim);
      sh.position.y = -SHIN / 2;
      const cuff = add(knee, new CylinderGeometry(0.057, 0.057, 0.02, 18), mats.denimDark);
      cuff.position.y = -SHIN + 0.012;
      const foot = new Group();
      foot.position.y = -SHIN;
      knee.add(foot);
      const shoe = add(foot, new SphereGeometry(1, 24, 16), mats.shoe);
      shoe.scale.set(0.068, 0.04, 0.1);
      shoe.position.set(0, -ANKLE + 0.04, 0.03);
      return [hip, knee, foot];
    };
    const [hipL, kneeL, footL] = leg(1);
    const [hipR, kneeR, footR] = leg(-1);
    this.hips = [hipL, hipR];
    this.knees = [kneeL, kneeR];
    this.feet = [footL, footR];
  }

  /** Kapsula sirtining shu balandlikdagi radiusi */
  private surfR(y: number): number {
    const lo = BODY_BOTTOM + this.r;
    const hi = BODY_BOTTOM + this.r + this.c;
    if (y < lo) return Math.sqrt(Math.max(0, this.r * this.r - (lo - y) ** 2));
    if (y > hi) return Math.sqrt(Math.max(0, this.r * this.r - (y - hi) ** 2));
    return this.r;
  }

  /** Tana sirtiga yopishgan aylanma bo'lak (qisman ham bo'lishi mumkin) */
  private lathe(y0: number, y1: number, offset: number, steps: number, phiStart = 0, phiLength = Math.PI * 2, segments = 56) {
    const pts: Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
      const y = y0 + ((y1 - y0) * i) / steps;
      pts.push(new Vector2(this.surfR(y) + offset, y));
    }
    return new LatheGeometry(pts, segments, phiStart, phiLength);
  }

  private buildEye(yaw: number, eyeY: number, rin: number) {
    const mats = this.mats;
    const add = (parent: Group, geo: BufferGeometry, mat: Material, shadow = false): Mesh => {
      this.geos.push(geo);
      const m = new Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = false;
      parent.add(m);
      return m;
    };
    const mount = new Group();
    const rr = this.surfR(eyeY) - 0.012;
    mount.position.set(Math.sin(yaw) * rr, eyeY, Math.cos(yaw) * rr);
    const hi = BODY_BOTTOM + this.r + this.c;
    const tilt = eyeY > hi ? Math.asin(clamp((eyeY - hi) / this.r, 0, 1)) : 0;
    mount.rotation.set(-tilt, yaw, 0, "YXZ");
    this.shape.add(mount);

    // Metall korpus, gardish va orqa devor
    const housing = new CylinderGeometry(rin + 0.028, rin + 0.036, 0.075, 40, 1, true);
    housing.rotateX(Math.PI / 2);
    // Korpus ichi ham ko'rinadi — metall material ikki tomonlama (scene.ts)
    add(mount, housing, mats.metal, true);
    const back = new CylinderGeometry(rin + 0.03, rin + 0.03, 0.004, 32);
    back.rotateX(Math.PI / 2);
    add(mount, back, mats.metalDark).position.z = -0.036;
    const rim = add(mount, new TorusGeometry(rin + 0.02, 0.018, 16, 48), mats.metal, true);
    rim.position.z = 0.038;

    // Olma, rangdor parda (sferik qalpoq), qorachiq
    const re = rin * 0.95;
    const ball = new Group();
    ball.position.z = -0.016;
    mount.add(ball);
    add(ball, new SphereGeometry(re, 28, 20), mats.eyeWhite);
    const irisA = 0.56;
    const iris = new SphereGeometry(re * 1.004, 32, 10, 0, Math.PI * 2, 0, irisA);
    iris.rotateX(Math.PI / 2);
    // Tekis proyeksiya UV: parda rasmi dumaloq chiziladi
    const pos = iris.attributes.position;
    const uv = iris.attributes.uv;
    const ir = re * Math.sin(irisA);
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * ir), 0.5 + pos.getY(i) / (2 * ir));
    add(ball, iris, mats.iris);
    const pupilGeo = new SphereGeometry(re * 1.008, 24, 6, 0, Math.PI * 2, 0, 0.24);
    pupilGeo.rotateX(Math.PI / 2);
    const pupil = add(ball, pupilGeo, mats.pupil);

    // Qovoqlar — olmani o'rab turgan teri
    const upper = add(mount, new SphereGeometry(re * 1.07, 30, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.skin);
    upper.position.z = ball.position.z;
    const lower = add(mount, new SphereGeometry(re * 1.06, 30, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.skin);
    lower.position.z = ball.position.z;

    // Shisha — biroz qavariq, atrofni aks ettiradi
    const capA = 0.75;
    const rs = (rin + 0.012) / Math.sin(capA);
    const lens = new SphereGeometry(rs, 36, 10, 0, Math.PI * 2, 0, capA);
    lens.rotateX(Math.PI / 2);
    lens.translate(0, 0, 0.038 - rs * Math.cos(capA));
    const lensMesh = add(mount, lens, mats.glass);
    lensMesh.renderOrder = 2;

    this.eyes.push({ mount, ball, upper, lower, pupil });
  }

  apply(p: Pose, time: number, dt: number) {
    this.root.visible = p.visible;
    if (!p.visible) {
      this.hasPrev = false;
      return;
    }
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.set(p.pitch, p.heading, p.roll, "YXZ");
    this.pelvis.position.y = p.hip;
    this.torso.rotation.set(p.lean, p.twist, p.side, "YXZ");
    const sq = clamp(p.squash, 0.7, 1.3);
    const wide = 1 / Math.sqrt(sq);
    this.shape.scale.set(wide, sq, wide);
    // Yelka va soch siqilgan tana bilan birga pastlaydi
    for (let i = 0; i < 2; i++) this.shoulders[i].position.y = this.shoulderY * sq;
    this.hair.position.y = this.hairY * sq;

    // FK
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const arm = i === 0 ? p.armL : p.armR;
      this.shoulders[i].rotation.set(-arm.pitch, 0, side * arm.roll, "ZXY");
      this.elbows[i].rotation.set(-arm.bend, 0, 0);
      const leg = i === 0 ? p.legL : p.legR;
      this.hips[i].rotation.set(-leg.pitch, 0, side * leg.roll, "ZXY");
      this.knees[i].rotation.set(leg.bend, 0, 0);
      // Botinka tagini yerga parallel ushlab turamiz
      this.feet[i].rotation.set(leg.pitch - leg.bend, 0, 0);
    }

    this.root.updateMatrixWorld(true);

    // IK: qo'llar
    const handT = [p.handL, p.handR];
    const handW = [p.wHandL, p.wHandR];
    for (let i = 0; i < 2; i++) {
      const w = clamp(handW[i], 0, 1);
      if (w <= 0.001) continue;
      const side = i === 0 ? 1 : -1;
      const goal = this.hands[i].getWorldPosition(_a).lerp(handT[i], w);
      this.torso.worldToLocal(goal);
      _pole.set(side * 0.45, -0.55, -0.7).normalize();
      const bend = solveTwoBone(this.shoulders[i].position, goal, this.upperLen, this.reach, _pole, this.shoulders[i].quaternion);
      this.elbows[i].rotation.set(bend, 0, 0);
    }

    // IK: oyoqlar (tovon aniq nuqtada, botinka tagi yerga parallel)
    const footT = [p.footL, p.footR];
    const footW = [p.wFootL, p.wFootR];
    for (let i = 0; i < 2; i++) {
      const w = clamp(footW[i], 0, 1);
      if (w <= 0.001) continue;
      const side = i === 0 ? 1 : -1;
      const goal = this.feet[i].getWorldPosition(_a);
      _b.copy(footT[i]);
      _b.y += ANKLE;
      goal.lerp(_b, w);
      this.pelvis.worldToLocal(goal);
      _pole.set(side * 0.12, 0.15, 1).normalize();
      const bend = solveTwoBone(this.hips[i].position, goal, THIGH, SHIN, _pole, this.hips[i].quaternion);
      this.knees[i].rotation.set(bend, 0, 0);
      this.knees[i].updateWorldMatrix(true, false);
      this.knees[i].getWorldQuaternion(_q);
      _q2.setFromEuler(_e.set(0, p.heading, 0));
      this.feet[i].quaternion.copy(_q.invert().multiply(_q2));
    }

    // Ko'zlar: nuqtaga qarash, qovoq, qorachiq, pirpiratish
    if (time >= this.nextBlink) {
      this.blinkAt = time;
      this.nextBlink = time + 2.2 + this.rand() * 3.6;
    }
    const bu = (time - this.blinkAt) / 0.15;
    const blink = bu >= 0 && bu <= 1 ? 1 - Math.sin(Math.PI * bu) : 1;
    const lid = p.lid * blink;
    const upperAngle = lid <= 1 ? 1.5 + (-0.32 - 1.5) * lid : -0.32 - (lid - 1) * 1.6;
    const lowerAngle = 0.62 + clamp(p.lid - 1, 0, 0.5) * 0.3 - (1 - blink) * 0.25;
    for (const eye of this.eyes) {
      let yaw = p.lookYaw;
      let pitch = p.lookPitch;
      if (p.wLook > 0.001) {
        const local = eye.mount.worldToLocal(_a.copy(p.look)).sub(eye.ball.position);
        const ty = Math.atan2(local.x, Math.max(0.01, local.z));
        const tp = Math.atan2(local.y, Math.hypot(local.x, local.z));
        yaw += (ty - yaw) * p.wLook;
        pitch += (tp - pitch) * p.wLook;
      }
      eye.ball.rotation.set(-clamp(pitch, -0.45, 0.45), clamp(yaw, -0.6, 0.6), 0, "YXZ");
      eye.upper.rotation.x = upperAngle;
      eye.lower.rotation.x = lowerAngle;
      const ps = clamp(p.pupil, 0.45, 1.4);
      eye.pupil.scale.set(ps, ps, 1);
    }

    if (p.mouth !== this.mouth) {
      this.mouth = p.mouth;
      this.mouthMat.map = this.maps[p.mouth];
    }

    this.updateHair(p, dt);
  }

  /** Soch — prujina: tezlanishga qarshi og'adi, keyin tebranib joyiga qaytadi */
  private updateHair(p: Pose, dt: number) {
    const head = this.hair.getWorldPosition(_a);
    const step = clamp(dt, 0, 1 / 30);
    let ax = 0;
    let az = 0;
    if (this.hasPrev && step > 0) {
      const vel = _b.copy(head).sub(this.prevHead).divideScalar(step);
      const acc = vel.clone().sub(this.prevVel).divideScalar(step);
      this.prevVel.copy(vel);
      const c = Math.cos(p.heading);
      const s = Math.sin(p.heading);
      ax = acc.x * c - acc.z * s;
      az = acc.x * s + acc.z * c;
    } else {
      this.prevVel.set(0, 0, 0);
    }
    this.prevHead.copy(head);
    this.hasPrev = true;
    const tx = clamp(-az * 0.012 - (p.lean + p.pitch) * 0.45, -0.7, 0.7);
    const tz = clamp(ax * 0.012 + (p.side + p.roll) * 0.4, -0.7, 0.7);
    if (step > 0) {
      const kS = 110;
      const cS = 7;
      this.hairVel.x += (kS * (tx - this.hairAngle.x) - cS * this.hairVel.x) * step;
      this.hairVel.y += (kS * (tz - this.hairAngle.y) - cS * this.hairVel.y) * step;
      this.hairAngle.x = clamp(this.hairAngle.x + this.hairVel.x * step, -0.8, 0.8);
      this.hairAngle.y = clamp(this.hairAngle.y + this.hairVel.y * step, -0.8, 0.8);
    }
    this.hair.rotation.set(this.hairAngle.x, 0, this.hairAngle.y);
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mouthMat.dispose();
  }
}
