/**
 * Materiallar va kod bilan chiziladigan teksturalar — tashqi rasm yuklanmaydi.
 *
 * Realizm shu yerdan: mato to'qimasi (diagonal "twill" + bo'rttirma), yog'och
 * tolasi, ko'z pardasining nurli tolalari, og'izning to'rt holati (tabassum,
 * xursand kulgi, qo'rquvdan baqirish, jangovar hayqiriq).
 */
import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import type { Expression, RigMaterials } from "./rig";

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2D canvas yo'q");
  return [c, g];
}

function texture(c: HTMLCanvasElement, color = true): CanvasTexture {
  const t = new CanvasTexture(c);
  if (color) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Jinsi mato: diagonal to'qima, mayda dog'lar, bo'rttirma xaritasi bilan */
function denim(): { map: CanvasTexture; bump: CanvasTexture } {
  const size = 256;
  const [c, g] = canvas2d(size, size);
  const [bc, bg] = canvas2d(size, size);
  g.fillStyle = "#315f94";
  g.fillRect(0, 0, size, size);
  bg.fillStyle = "#808080";
  bg.fillRect(0, 0, size, size);
  for (let i = -size; i < size * 2; i += 3) {
    const light = i % 6 === 0;
    g.strokeStyle = light ? "rgba(190,215,245,0.16)" : "rgba(10,25,50,0.2)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + size, size);
    g.stroke();
    bg.strokeStyle = light ? "#b0b0b0" : "#4a4a4a";
    bg.lineWidth = 1.4;
    bg.beginPath();
    bg.moveTo(i, 0);
    bg.lineTo(i + size, size);
    bg.stroke();
  }
  const rand = seeded(7);
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const map = texture(c);
  const bump = texture(bc, false);
  for (const t of [map, bump]) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(3, 3);
  }
  return { map, bump };
}

/** Bo'yalgan yog'och taxta: tolalari ko'rinib turadi, chetlari biroz ko'chgan */
function wood(): CanvasTexture {
  const [c, g] = canvas2d(512, 64);
  g.fillStyle = "#f1b83a";
  g.fillRect(0, 0, 512, 64);
  const rand = seeded(19);
  for (let i = 0; i < 26; i++) {
    const y = rand() * 64;
    g.strokeStyle = `rgba(150,90,20,${0.08 + rand() * 0.12})`;
    g.lineWidth = 0.8 + rand() * 1.4;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * (1 + rand() * 2.5));
    g.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = rand() * 512;
    const y = 12 + rand() * 40;
    g.fillStyle = "rgba(140,85,25,0.18)";
    g.beginPath();
    g.ellipse(x, y, 7 + rand() * 5, 2.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

/** Ko'z pardasi: jigarrang, markazdan tarqaluvchi tolalar, qoramtir hoshiya */
function iris(): CanvasTexture {
  const [c, g] = canvas2d(128, 128);
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 63);
  grad.addColorStop(0, "#2b170a");
  grad.addColorStop(0.3, "#6d4119");
  grad.addColorStop(0.72, "#90592a");
  grad.addColorStop(0.9, "#5a3413");
  grad.addColorStop(1, "#24140a");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 63, 0, Math.PI * 2);
  g.fill();
  const rand = seeded(3);
  for (let i = 0; i < 140; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = 12 + rand() * 10;
    const r1 = 40 + rand() * 20;
    g.strokeStyle = rand() > 0.5 ? "rgba(235,190,120,0.16)" : "rgba(40,20,5,0.22)";
    g.lineWidth = 0.6 + rand();
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0);
    g.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1);
    g.stroke();
  }
  return texture(c);
}

/** Og'iz: to'rt holat. Kenglik 256 — tana atrofida ~0.26 m yoy */
function mouths(): Record<Expression, CanvasTexture> {
  const make = (draw: (g: CanvasRenderingContext2D) => void) => {
    const [c, g] = canvas2d(256, 128);
    g.lineJoin = "round";
    draw(g);
    return texture(c);
  };
  const dark = "#2a0f0c";
  const tongue = "#c84a44";
  const teethRow = (g: CanvasRenderingContext2D, clip: () => void, y: number, h: number) => {
    g.save();
    clip();
    g.clip();
    g.fillStyle = "#fbf7ee";
    g.fillRect(0, y, 256, h);
    g.strokeStyle = "rgba(120,110,100,0.35)";
    g.lineWidth = 1.2;
    for (let x = 70; x < 200; x += 18) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + h);
      g.stroke();
    }
    g.restore();
  };
  return {
    smile: make((g) => {
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(78, 58);
      g.quadraticCurveTo(128, 104, 178, 58);
      g.quadraticCurveTo(128, 80, 78, 58);
      g.fill();
    }),
    grin: make((g) => {
      const shape = () => {
        g.beginPath();
        g.moveTo(72, 50);
        g.quadraticCurveTo(128, 60, 184, 50);
        g.quadraticCurveTo(178, 106, 128, 110);
        g.quadraticCurveTo(78, 106, 72, 50);
        g.closePath();
      };
      g.fillStyle = dark;
      shape();
      g.fill();
      g.save();
      shape();
      g.clip();
      g.fillStyle = tongue;
      g.beginPath();
      g.ellipse(128, 100, 30, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      teethRow(g, shape, 48, 14);
    }),
    scream: make((g) => {
      const shape = () => {
        g.beginPath();
        g.ellipse(128, 70, 30, 42, 0, 0, Math.PI * 2);
      };
      g.fillStyle = dark;
      shape();
      g.fill();
      g.fillStyle = tongue;
      g.save();
      shape();
      g.clip();
      g.beginPath();
      g.ellipse(128, 106, 24, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      teethRow(g, shape, 26, 11);
    }),
    shout: make((g) => {
      const shape = () => {
        g.beginPath();
        g.moveTo(66, 44);
        g.quadraticCurveTo(128, 34, 190, 44);
        g.quadraticCurveTo(186, 112, 128, 116);
        g.quadraticCurveTo(70, 112, 66, 44);
        g.closePath();
      };
      g.fillStyle = dark;
      shape();
      g.fill();
      g.fillStyle = tongue;
      g.save();
      shape();
      g.clip();
      g.beginPath();
      g.ellipse(128, 108, 36, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      teethRow(g, shape, 38, 13);
      teethRow(g, shape, 100, 8);
    }),
  };
}

/** Yerdagi yumshoq soya — minion ostida, sakraganda xiralashadi */
function blob(): CanvasTexture {
  const [c, g] = canvas2d(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.25)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return texture(c, false);
}

export interface PlaygroundMaterials {
  rig: RigMaterials;
  paintMint: MeshStandardMaterial;
  paintOrange: MeshStandardMaterial;
  paintYellow: MeshStandardMaterial;
  plank: MeshStandardMaterial;
  plastic: MeshPhysicalMaterial;
  steel: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  seatRed: MeshStandardMaterial;
  anchor: MeshStandardMaterial;
  banana: MeshStandardMaterial;
  stem: MeshStandardMaterial;
  blob: Texture;
  dispose(): void;
}

export function createMaterials(): PlaygroundMaterials {
  const jeans = denim();
  const mouthMaps = mouths();
  const irisMap = iris();
  const woodMap = wood();
  const blobMap = blob();

  const skin = new MeshPhysicalMaterial({
    color: new Color("#f8cd2f"),
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new Color("#fff0b0"),
  });
  const denimMat = new MeshStandardMaterial({ map: jeans.map, bumpMap: jeans.bump, bumpScale: 0.6, roughness: 0.92 });
  const denimDark = new MeshStandardMaterial({ map: jeans.map, bumpMap: jeans.bump, bumpScale: 0.6, roughness: 0.9, color: "#9fb3cc" });
  const glove = new MeshStandardMaterial({ color: "#1c1d21", roughness: 0.46 });
  const shoe = new MeshPhysicalMaterial({ color: "#121316", roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const metal = new MeshStandardMaterial({ color: "#c9ced6", metalness: 1, roughness: 0.24, side: DoubleSide });
  const metalDark = new MeshStandardMaterial({ color: "#41454c", metalness: 0.8, roughness: 0.5 });
  const strap = new MeshStandardMaterial({ color: "#232326", roughness: 0.78 });
  const glass = new MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.02,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    depthWrite: false,
  });
  const eyeWhite = new MeshPhysicalMaterial({ color: "#f6f3ec", roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const irisMat = new MeshStandardMaterial({ map: irisMap, roughness: 0.3 });
  const pupil = new MeshPhysicalMaterial({ color: "#07080a", roughness: 0.15, clearcoat: 1 });
  const hair = new MeshStandardMaterial({ color: "#17130f", roughness: 0.7 });

  const paint = (color: string, roughness = 0.42) =>
    new MeshPhysicalMaterial({ color, roughness, metalness: 0.15, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  const paintMint = paint("#58c9a8");
  const paintOrange = paint("#ef8a3a");
  const paintYellow = paint("#f5c23d");
  const plank = new MeshStandardMaterial({ map: woodMap, roughness: 0.55 });
  const plastic = new MeshPhysicalMaterial({ color: "#2f98d4", roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.12, side: DoubleSide });
  const steel = new MeshStandardMaterial({ color: "#c7ccd3", metalness: 0.9, roughness: 0.32 });
  const rubber = new MeshStandardMaterial({ color: "#26272b", roughness: 0.75 });
  const seatRed = new MeshStandardMaterial({ color: "#d9483b", roughness: 0.55 });
  const anchor = new MeshStandardMaterial({ color: "#a15c3e", roughness: 0.8 });
  const banana = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const stem = new MeshStandardMaterial({ color: "#6b5a2a", roughness: 0.8 });

  const all = [
    skin, denimMat, denimDark, glove, shoe, metal, metalDark, strap, glass, eyeWhite, irisMat, pupil, hair,
    paintMint, paintOrange, paintYellow, plank, plastic, steel, rubber, seatRed, anchor, banana, stem,
  ];
  const textures: Texture[] = [jeans.map, jeans.bump, irisMap, woodMap, blobMap, ...Object.values(mouthMaps)];

  return {
    rig: {
      skin,
      denim: denimMat,
      denimDark,
      glove,
      shoe,
      metal,
      metalDark,
      strap,
      glass,
      eyeWhite,
      iris: irisMat,
      pupil,
      hair,
      mouthMaps,
    },
    paintMint,
    paintOrange,
    paintYellow,
    plank,
    plastic,
    steel,
    rubber,
    seatRed,
    anchor,
    banana,
    stem,
    blob: blobMap,
    dispose() {
      all.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
