/**
 * O'yin jihozlari va banan — o'lchamlar dims.ts'dan, shuning uchun minion
 * o'rindiq, tutqich, zanjir va zinapoya pog'onalarini aniq topadi.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { SEESAW, SLIDE, SLIDE_GEO, SWING, chuteAt, type Layout } from "./dims";
import type { PlaygroundMaterials } from "./materials";

const UP = new Vector3(0, 1, 0);

export interface Playground {
  group: Group;
  /** rotation.z = −φ (φ > 0 — chap uchi tepada) */
  plank: Group;
  /** rotation.z = −θ (θ > 0 — o'rindiq chapda) */
  swing: Group;
  setLayout(layout: Layout): void;
  dispose(): void;
}

export function buildPlayground(m: PlaygroundMaterials): Playground {
  const geos = new Set<BufferGeometry>();
  const group = new Group();

  const mesh = (geo: BufferGeometry, mat: Material, parent: Object3D, cast = true) => {
    geos.add(geo);
    const x = new Mesh(geo, mat);
    x.castShadow = cast;
    x.receiveShadow = true;
    parent.add(x);
    return x;
  };

  /** Ikki nuqta orasidagi quvur */
  const tube = (a: Vector3, b: Vector3, r: number, mat: Material, parent: Object3D) => {
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    const x = mesh(new CylinderGeometry(r, r, len, 18), mat, parent);
    x.position.copy(a).addScaledVector(dir, 0.5);
    x.quaternion.setFromUnitVectors(UP, dir.normalize());
    return x;
  };

  // ------------------------------------------------------------ arg'imchoq
  const seesaw = new Group();
  group.add(seesaw);
  for (const z of [-0.16, 0.16]) {
    tube(new Vector3(-0.36, 0, z), new Vector3(0, SEESAW.pivotY, z), 0.03, m.paintOrange, seesaw);
    tube(new Vector3(0.36, 0, z), new Vector3(0, SEESAW.pivotY, z), 0.03, m.paintOrange, seesaw);
    tube(new Vector3(-0.42, 0.022, z), new Vector3(0.42, 0.022, z), 0.022, m.paintOrange, seesaw);
    const cap = mesh(new CylinderGeometry(0.05, 0.05, 0.05, 20), m.paintOrange, seesaw);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, SEESAW.pivotY, z);
  }
  tube(new Vector3(0, SEESAW.pivotY, -0.2), new Vector3(0, SEESAW.pivotY, 0.2), SEESAW.axleR, m.steel, seesaw);

  const plank = new Group();
  plank.position.y = SEESAW.pivotY;
  seesaw.add(plank);
  const board = mesh(new RoundedBoxGeometry(SEESAW.half * 2, SEESAW.thick, SEESAW.width, 3, 0.02), m.plank, plank);
  board.position.y = SEESAW.axleR + SEESAW.thick / 2;
  const top = SEESAW.axleR + SEESAW.thick;
  for (const s of [-1, 1]) {
    const seat = mesh(new RoundedBoxGeometry(SEESAW.seatLen, SEESAW.seatH, SEESAW.width * 0.94, 3, 0.02), m.seatRed, plank);
    seat.position.set(s * SEESAW.seatD, top + SEESAW.seatH / 2, 0);
    tube(new Vector3(s * SEESAW.handleD, top, 0), new Vector3(s * SEESAW.handleD, top + SEESAW.handleH, 0), 0.017, m.steel, plank);
    tube(
      new Vector3(s * SEESAW.handleD, top + SEESAW.handleH, -SEESAW.gripHalf),
      new Vector3(s * SEESAW.handleD, top + SEESAW.handleH, SEESAW.gripHalf),
      0.017,
      m.steel,
      plank,
    );
    for (const z of [-1, 1]) {
      const grip = mesh(new CylinderGeometry(0.022, 0.022, 0.06, 14), m.rubber, plank);
      grip.rotation.x = Math.PI / 2;
      grip.position.set(s * SEESAW.handleD, top + SEESAW.handleH, z * (SEESAW.gripHalf - 0.03));
    }
    // Uchi yerga urilganda zarbni yutadigan rezina
    const bumperGeo = new CylinderGeometry(SEESAW.bumperDrop, SEESAW.bumperDrop, SEESAW.width * 0.8, 16, 1, false, -Math.PI / 2, Math.PI);
    bumperGeo.rotateX(Math.PI / 2);
    const bumper = mesh(bumperGeo, m.rubber, plank);
    bumper.position.set(s * (SEESAW.half - SEESAW.bumperIn), SEESAW.axleR, 0);
  }

  // ------------------------------------------------------------ sirg'anchiq
  const slide = new Group();
  group.add(slide);
  const { deckLeft, deckRight, stairEnd, rise } = SLIDE_GEO;
  const deck = mesh(new RoundedBoxGeometry(SLIDE.deckW, 0.05, SLIDE.deckD, 2, 0.014), m.paintYellow, slide);
  deck.position.set((deckLeft + deckRight) / 2, SLIDE.deckY - 0.025, 0);
  const postTop = SLIDE.deckY + 0.36;
  for (const x of [deckLeft + 0.03, deckRight - 0.03]) {
    for (const z of [-1, 1]) {
      tube(new Vector3(x, 0, z * SLIDE.railZ), new Vector3(x, postTop, z * SLIDE.railZ), 0.03, m.paintMint, slide);
    }
  }
  for (const z of [-1, 1]) {
    const zz = z * SLIDE.railZ;
    for (const y of [SLIDE.deckY + 0.18, postTop]) {
      tube(new Vector3(deckLeft + 0.03, y, zz), new Vector3(deckRight - 0.03, y, zz), 0.018, m.paintMint, slide);
    }
    // Zinapoya: ostidan qiya tayanch, ustidan qiya tutqich
    tube(new Vector3(stairEnd - 0.01, 0, z * (SLIDE.stairW / 2 - 0.03)), new Vector3(deckRight + 0.02, SLIDE.steps * rise - 0.03, z * (SLIDE.stairW / 2 - 0.03)), 0.026, m.paintMint, slide);
    tube(new Vector3(stairEnd + 0.03, 0, zz), new Vector3(stairEnd + 0.03, SLIDE.railH, zz), 0.022, m.paintMint, slide);
    tube(
      new Vector3(stairEnd + 0.03, SLIDE.railH, zz),
      new Vector3(deckRight - 0.03, SLIDE.steps * rise + SLIDE.railH + ((0.03 + 0.03) * rise) / SLIDE.tread, zz),
      0.02,
      m.paintMint,
      slide,
    );
  }
  // Ochiq pog'onalar — orasidan minionning oyoqlari ko'rinib turadi
  for (let j = 1; j <= SLIDE.steps; j++) {
    const step = mesh(new RoundedBoxGeometry(SLIDE.tread + 0.012, 0.04, SLIDE.stairW, 2, 0.012), m.paintOrange, slide);
    step.position.set(deckRight + (SLIDE.steps + 0.5 - j) * SLIDE.tread, j * rise - 0.02, 0);
  }

  // Tarnov: U-shaklidagi kesim tarnov yo'li bo'ylab suriladi
  const w = SLIDE.bedW / 2;
  const profile: Array<[number, number]> = [[-w, SLIDE.wallH]];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * (Math.PI / 2);
    profile.push([-w + 0.05 + Math.cos(a) * 0.05, 0.05 + Math.sin(a) * 0.05]);
  }
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    profile.push([w - 0.05 + Math.cos(a) * 0.05, 0.05 + Math.sin(a) * 0.05]);
  }
  profile.push([w, SLIDE.wallH]);
  const rows = 64;
  const positions: number[] = [];
  const indices: number[] = [];
  const cp = { x: 0, y: 0, slope: 0 };
  const cn = { x: 0, y: 0, slope: 0 };
  const wallTops: [Vector3[], Vector3[]] = [[], []];
  for (let i = 0; i <= rows; i++) {
    const s = (i / rows) * SLIDE_GEO.length;
    chuteAt(s, cp);
    chuteAt(Math.min(SLIDE_GEO.length, s + 0.01), cn);
    let tx = cn.x - cp.x;
    let ty = cn.y - cp.y;
    if (i === rows) {
      tx = -1;
      ty = 0;
    }
    const tl = Math.hypot(tx, ty) || 1;
    // Tubga tik, yuqoriga qaragan yo'nalish
    const nx = ty / tl;
    const ny = -tx / tl;
    for (const [z, n] of profile) positions.push(cp.x + nx * n, cp.y + ny * n, z);
    wallTops[0].push(new Vector3(cp.x + nx * SLIDE.wallH, cp.y + ny * SLIDE.wallH, -w));
    wallTops[1].push(new Vector3(cp.x + nx * SLIDE.wallH, cp.y + ny * SLIDE.wallH, w));
  }
  const cols = profile.length;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + cols;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const chute = new BufferGeometry();
  chute.setAttribute("position", new Float32BufferAttribute(positions, 3));
  chute.setIndex(indices);
  chute.computeVertexNormals();
  mesh(chute, m.plastic, slide);
  for (const pts of wallTops) mesh(new TubeGeometry(new CatmullRomCurve3(pts), 64, 0.018, 8), m.plastic, slide);
  // Tarnovni pastdan ushlab turuvchi ustun
  chuteAt(SLIDE_GEO.straight * 0.7, cp);
  tube(new Vector3(cp.x, 0, 0), new Vector3(cp.x, cp.y - 0.03, 0), 0.028, m.paintMint, slide);

  // ------------------------------------------------------------ halinchak
  const swingSet = new Group();
  group.add(swingSet);
  const beamY = SWING.pivotY + 0.03;
  for (const z of [-SWING.frameZ, SWING.frameZ]) {
    for (const s of [-1, 1]) {
      tube(new Vector3(s * SWING.footX, 0, z), new Vector3(0, beamY, z), SWING.tubeR, m.paintMint, swingSet);
      const foot = mesh(new RoundedBoxGeometry(0.16, 0.08, 0.16, 2, 0.02), m.anchor, swingSet);
      foot.position.set(s * SWING.footX, 0.04, z);
    }
  }
  tube(new Vector3(0, beamY, -SWING.frameZ - 0.12), new Vector3(0, beamY, SWING.frameZ + 0.12), 0.05, m.paintYellow, swingSet);

  const swing = new Group();
  swing.position.y = SWING.pivotY;
  swingSet.add(swing);
  const pitch = 0.052;
  const links = Math.round((SWING.chain - 0.02) / pitch);
  const linkGeo = new TorusGeometry(0.016, 0.0045, 6, 12);
  linkGeo.scale(1, 1.55, 1);
  geos.add(linkGeo);
  const chains = new InstancedMesh(linkGeo, m.steel, links * 2);
  chains.castShadow = true;
  const mtx = new Matrix4();
  const q = new Quaternion();
  const turn = new Quaternion().setFromAxisAngle(UP, Math.PI / 2);
  const one = new Vector3(1, 1, 1);
  let n = 0;
  for (const z of [-SWING.chainZ, SWING.chainZ]) {
    for (let i = 0; i < links; i++) {
      q.copy(i % 2 ? turn : new Quaternion());
      mtx.compose(new Vector3(0, -0.02 - i * pitch - pitch / 2, z), q, one);
      chains.setMatrixAt(n++, mtx);
    }
    const hook = mesh(new TorusGeometry(0.022, 0.006, 8, 16), m.steel, swing, false);
    hook.position.set(0, -0.005, z);
  }
  swing.add(chains);
  const seatGeo = new RoundedBoxGeometry(SWING.seatDepth, SWING.seatT, SWING.seatW, 3, 0.014);
  // Rezina o'rindiq o'rtasi biroz egilgan
  const sp = seatGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const z = sp.getZ(i) / (SWING.seatW / 2);
    sp.setY(i, sp.getY(i) + 0.03 * z * z);
  }
  seatGeo.computeVertexNormals();
  const seat = mesh(seatGeo, m.rubber, swing);
  seat.position.y = -SWING.chain - SWING.seatT / 2;
  for (const z of [-SWING.chainZ, SWING.chainZ]) {
    const clampPart = mesh(new RoundedBoxGeometry(0.05, 0.05, 0.03, 2, 0.008), m.steel, swing);
    clampPart.position.set(0, -SWING.chain + 0.005, z);
  }

  return {
    group,
    plank,
    swing,
    setLayout(layout) {
      seesaw.position.x = layout.seesawX;
      slide.position.x = layout.slideX;
      swingSet.position.x = layout.swingX;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      chains.dispose();
    },
  };
}

/**
 * Banan: yoy bo'ylab egilgan, ikki uchi ingichkalashgan, besh qirrali —
 * haqiqiy banandek. Rangi: sariq, bandi yashilroq, uchi jigarrang.
 */
export function buildBanana(m: PlaygroundMaterials): { group: Group; dispose(): void } {
  const group = new Group();
  const R = 0.2;
  const arc = 1.3;
  const pts: Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = -arc / 2 + (arc * i) / 16;
    pts.push(new Vector3(Math.sin(a) * R, (1 - Math.cos(a)) * R, 0));
  }
  const curve = new CatmullRomCurve3(pts);
  const tubular = 48;
  const radial = 7;
  const geo = new TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const center = new Vector3();
  const yellow = new Color("#f3cf3a");
  const green = new Color("#b9c43a");
  const brown = new Color("#5a3a18");
  const col = new Color();
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    curve.getPointAt(u, center);
    const radius = Math.max(0.004, 0.031 * Math.pow(Math.sin(Math.PI * u), 0.6));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const v = new Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(center);
      pos.setXYZ(k, center.x + v.x * radius, center.y + v.y * radius, center.z + v.z * radius);
      col.copy(yellow);
      if (u < 0.18) col.lerp(green, (0.18 - u) / 0.18);
      if (u > 0.93) col.lerp(brown, (u - 0.93) / 0.07);
      colors.push(col.r, col.g, col.b);
    }
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const body = new Mesh(geo, m.banana);
  body.castShadow = true;
  group.add(body);
  const stemGeo = new CylinderGeometry(0.008, 0.012, 0.05, 10);
  const stem = new Mesh(stemGeo, m.stem);
  const start = curve.getPointAt(0);
  const dir = curve.getTangentAt(0).negate();
  stem.position.copy(start).addScaledVector(dir, 0.022);
  stem.quaternion.setFromUnitVectors(UP, dir);
  group.add(stem);
  return {
    group,
    dispose() {
      geo.dispose();
      stemGeo.dispose();
    },
  };
}
