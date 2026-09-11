/**
 * Kirish sahifasining 3D bog'cha hovlisi (three.js).
 *
 * Bu modul faqat dinamik `import()` orqali, brauzerda yuklanadi (qarang:
 * kindergarten-backdrop.tsx): kutubxona og'ir va kirish sahifasining birinchi
 * chizilishini ushlab turmasligi kerak. Sahnadagi hamma narsa shu yerda kod
 * bilan quriladi — tashqi model, rasm yoki shrift yuklanmaydi.
 *
 * Koordinatalar: bog'cha binosi (0, 0, 0) da, yer y = 0, kamera +z tomonda
 * turib binoga qaraydi. 1 birlik ≈ tekis sahnadagi 100px, shuning uchun
 * narsalarning joylashuvi SVG versiyasi bilan bir xil: chapda daraxt va
 * arg'imchoqlar, markazda bino, o'ngda sirpanchiq.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  type Material,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Texture,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export interface KindergartenSceneOptions {
  /** Uy peshtoqidagi lavha matni. Hali yuklanmagan bo'lsa lavha bo'sh turadi. */
  name: string | null;
  /** Harakatni kamaytirish yoqilgan: sahna bir marta chiziladi, jonlanmaydi. */
  reducedMotion: boolean;
  /** Birinchi kadr tayyor — endi uni ko'rsatsa bo'ladi. */
  onReady: () => void;
  /** Qurilma sahnani tortolmayapti — tekis rasmga qaytish kerak. */
  onSlow: () => void;
}

export interface KindergartenSceneHandle {
  setName(name: string | null): void;
  dispose(): void;
}

const FONT = `ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", "Segoe UI", system-ui, sans-serif`;

const PALETTE = {
  wall: 0xfff1dc,
  band: 0x7fd1c1,
  foundation: 0xe4d6c0,
  ridge: 0xc9493f,
  trim: 0xffffff,
  flowerBox: 0xb9763f,
  door: 0x13796f,
  gold: 0xffc94a,
  brick: 0xc8664f,
  trunk: 0x8a5a36,
  leaves: [0x4caf50, 0x5dbb63, 0x43a047, 0x69c46e],
  apple: 0xe53935,
  plank: 0xffc233,
  orange: 0xff9f43,
  orangeDark: 0xe07b1a,
  chute: 0xffcf3f,
  sand: 0xf1dfb0,
  wood: 0xc8955e,
  path: 0xeadcb8,
  rope: 0xd9c8a4,
  blossoms: [0xff8fc0, 0xffd166, 0x7ad3ff, 0xc4b5fd, 0xff6b6b, 0xffffff],
} as const;

/** Har yuklashda sahna bir xil chiqsin — tasodif urug'dan olinadi. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Yer balandligi. Bino atrofidagi o'yin maydoni tekis (narsalar y = 0 da
 * turadi), undan uzoqlashgan sari yengil to'lqin, orqada esa tepaliklar.
 */
function groundHeight(x: number, z: number): number {
  const play = 1 - MathUtils.smoothstep(Math.hypot(x * 0.55, z - 1), 4.5, 9);
  const ripple = (Math.sin(x * 0.45 + z * 0.35) * 0.05 + Math.cos(x * 0.23 - z * 0.5) * 0.04) * (1 - play);
  const far = MathUtils.smoothstep(-z, 6, 24);
  const rolling =
    1.2 + Math.sin(x * 0.16 + 0.6) * 1.1 + Math.sin(x * 0.07 - 1.2) * 1.4 + Math.cos(z * 0.18 + x * 0.04) * 0.5;
  return ripple + far * rolling;
}

/** Eshikdan old tomonga buralib tushadigan qumli so'qmoq. */
const PATH_CURVE = new CatmullRomCurve3([
  new Vector3(0, 0, 1.55),
  new Vector3(-0.3, 0, 3.0),
  new Vector3(-1.15, 0, 4.7),
  new Vector3(-2.2, 0, 6.6),
  new Vector3(-3.1, 0, 8.8),
  new Vector3(-4.1, 0, 11.5),
]);
const pathHalfWidth = (u: number) => MathUtils.lerp(0.42, 0.95, u);

/** Maysa va gullar ekilmaydigan joylar: [x, z, radius]. */
const OBSTACLES: ReadonlyArray<readonly [number, number, number]> = [
  [-3.4, 4.3, 1.15], // qum maydonchasi
  [-2.0, 2.6, 0.4], // tarozi tayanchi
  [-4.3, -0.35, 0.42], // daraxt tanasi
  [-4.0, 1.92, 0.55], // kubiklar
  [2.25, -0.3, 0.45], // narvon
  [3.2, 0.35, 0.5], // sirpanchiq o'rtasi
  [4.2, 0.9, 0.45], // sirpanchiq oxiri
];

// ---------------------------------------------------------------------------
// Kanvas teksturalari
// ---------------------------------------------------------------------------

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas mavjud emas");
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Quyosh yog'dusi: markazi oq-sariq, chetiga qarab erib ketadi. */
function glowTexture(): CanvasTexture {
  const [canvas, ctx] = canvas2d(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,250,225,1)");
  g.addColorStop(0.2, "rgba(255,236,160,0.85)");
  g.addColorStop(0.45, "rgba(255,221,120,0.28)");
  g.addColorStop(1, "rgba(255,221,120,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(canvas);
}

/** Quyoshning o'zi — chekkasi yumshoq gardish. */
function discTexture(): CanvasTexture {
  const [canvas, ctx] = canvas2d(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "#fffbe8");
  g.addColorStop(0.62, "#ffe38a");
  g.addColorStop(0.8, "rgba(255,214,102,0.9)");
  g.addColorStop(1, "rgba(255,214,102,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas);
}

/**
 * Tom cherepitsasi. Qatorlar tizma bo'ylab, har bir cherepitsa pastga —
 * nov tomonga qaraydi. Ikki nishab uchun burilishi qarama-qarshi.
 */
function roofTexture(rotation: number): CanvasTexture {
  const [canvas, ctx] = canvas2d(256, 256);
  ctx.fillStyle = "#d9574b";
  ctx.fillRect(0, 0, 256, 256);
  const rows = 8;
  const cols = 8;
  const rh = 256 / rows;
  const cw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + (r % 2 ? cw / 2 : 0);
      const y = r * rh;
      const grad = ctx.createLinearGradient(0, y, 0, y + rh);
      grad.addColorStop(0, "#f58474");
      grad.addColorStop(1, "#dc5a4d");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cw, y);
      ctx.lineTo(x + cw, y + rh * 0.5);
      ctx.quadraticCurveTo(x + cw, y + rh, x + cw / 2, y + rh);
      ctx.quadraticCurveTo(x, y + rh, x, y + rh * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(140,40,30,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  const texture = toTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.center.set(0.5, 0.5);
  texture.rotation = rotation;
  texture.repeat.set(3, 3.4);
  return texture;
}

/** Harfli kubik yuzasi. */
function blockTexture(letter: string, bg: string, fg: string): CanvasTexture {
  const [canvas, ctx] = canvas2d(256, 256);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(22, 22, 212, 212, 26);
  ctx.stroke();
  ctx.font = `900 150px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillText(letter, 131, 142);
  ctx.fillStyle = fg;
  ctx.fillText(letter, 128, 136);
  return toTexture(canvas);
}

// ---------------------------------------------------------------------------
// Geometriya yordamchilari
// ---------------------------------------------------------------------------

/**
 * Harakatsiz guruhdagi meshlarni material bo'yicha bittaga birlashtiradi.
 * Bino, daraxt, panjara kabi narsalar o'nlab bo'laklardan iborat — har biri
 * alohida chizilsa telefonda kadr tezligi tushadi.
 */
function mergeStatic(group: Group): void {
  group.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<Material, { parts: BufferGeometry[]; cast: boolean; receive: boolean }>();
  const originals = new Set<BufferGeometry>();

  group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || (object as InstancedMesh).isInstancedMesh) return;
    const source = mesh.geometry;
    const part = source.index ? source.toNonIndexed() : source.clone();
    for (const key of Object.keys(part.attributes)) {
      if (key !== "position" && key !== "normal" && key !== "uv") part.deleteAttribute(key);
    }
    if (!part.getAttribute("uv")) {
      part.setAttribute("uv", new Float32BufferAttribute(new Float32Array(part.getAttribute("position").count * 2), 2));
    }
    part.clearGroups();
    part.applyMatrix4(new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    const material = mesh.material as Material;
    const bucket = buckets.get(material) ?? { parts: [], cast: false, receive: false };
    bucket.parts.push(part);
    bucket.cast ||= mesh.castShadow;
    bucket.receive ||= mesh.receiveShadow;
    buckets.set(material, bucket);
    originals.add(source);
  });

  group.clear();
  for (const [material, bucket] of buckets) {
    const merged = mergeGeometries(bucket.parts, false);
    bucket.parts.forEach((part) => part.dispose());
    if (!merged) continue;
    const mesh = new Mesh(merged, material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    group.add(mesh);
  }
  originals.forEach((geometry) => geometry.dispose());
}

// ---------------------------------------------------------------------------
// Sahna
// ---------------------------------------------------------------------------

interface Kid {
  root: Group;
  head: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
}

interface KidLook {
  skin: number;
  hair: number;
  hairStyle: "short" | "bob" | "pigtails" | "curly";
  shirt: number;
  pants: number;
  shoe: number;
}

export function mountKindergarten3D(host: HTMLElement, options: KindergartenSceneOptions): KindergartenSceneHandle {
  // Telefonmi — joyning kengligiga emas, qurilma ekraniga qaraymiz: sahna
  // yashirin varaqda ochilsa, joy vaqtincha tor bo'lib, kompyuterda ham
  // past sifat tanlanib qolardi.
  const narrow = Math.min(window.screen.width, window.screen.height) < 700;
  const rng = mulberry32(20260911);
  const updaters: Array<(t: number, dt: number) => void> = [];
  const materials = new Map<string, MeshStandardMaterial>();
  const loose: Array<{ dispose(): void }> = [];

  const std = (color: number, roughness = 0.8, flat = false): MeshStandardMaterial => {
    const key = `${color}:${roughness}:${flat}`;
    let material = materials.get(key);
    if (!material) {
      material = new MeshStandardMaterial({ color, roughness, flatShading: flat });
      materials.set(key, material);
    }
    return material;
  };

  const mesh = (
    geometry: BufferGeometry,
    material: Material,
    x = 0,
    y = 0,
    z = 0,
    cast = true,
    receive = true,
  ): Mesh => {
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  };

  // ---------- Renderer, kamera ----------
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 400);

  // ---------- Osmon ----------
  const skyMaterial = new ShaderMaterial({
    uniforms: {
      top: { value: new Color(0x6fb8ff) },
      horizon: { value: new Color(0xe4f2ff) },
      glow: { value: new Color(0xfff0d2) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 glow;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld - cameraPosition).y;
        vec3 color = mix(horizon, top, pow(smoothstep(0.0, 0.6, h), 0.75));
        // Ufq ustidagi iliq tuman — tongdagi kabi yumshoq
        color = mix(color, glow, (1.0 - smoothstep(0.0, 0.14, abs(h))) * 0.35);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
    side: BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  const sky = new Mesh(new SphereGeometry(160, 32, 16), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new Fog(0xe4f2ff, 32, 120);

  // Osmon rangidagi yoritish: shisha va sharlarda osmon aks etadi
  const pmrem = new PMREMGenerator(renderer);
  const envScene = new Scene();
  const envSphere = new SphereGeometry(10, 32, 16);
  envScene.add(new Mesh(envSphere, skyMaterial));
  const envTarget = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  envSphere.dispose();
  loose.push(envTarget);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.55;

  // ---------- Quyosh va yorug'lik ----------
  const glowTex = glowTexture();
  const discTex = discTexture();
  const sunGlow = new Sprite(
    new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }),
  );
  sunGlow.position.set(-8, 14, -70);
  sunGlow.scale.setScalar(34);
  const sunDisc = new Sprite(new SpriteMaterial({ map: discTex, depthWrite: false, fog: false, toneMapped: false }));
  sunDisc.position.set(-8, 14, -69.5);
  sunDisc.scale.setScalar(8);
  scene.add(sunGlow, sunDisc);
  updaters.push((t) => sunGlow.scale.setScalar(34 + Math.sin(t * 0.8) * 1.6));

  scene.add(new HemisphereLight(0xd6ecff, 0x86c77e, 1.15));
  // Tasvirdagi quyosh orqada, lekin yorug'lik old-chapdan tushadi: bino
  // yuzi yorug' bo'lsin, soyalar orqaga-o'ngga cho'zilsin.
  const sun = new DirectionalLight(0xfff0d6, 2.5);
  sun.position.set(-7, 13, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const fill = new DirectionalLight(0xffe2c4, 0.35);
  fill.position.set(8, 5, 10);
  scene.add(fill);

  // ---------- Yer ----------
  {
    const geometry = new PlaneGeometry(90, 70, narrow ? 120 : 180, narrow ? 94 : 140);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -20);
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const a = new Color(0x6cc462);
    const b = new Color(0x86d376);
    const c = new Color(0x57ad52);
    const haze = new Color(0xa9dd9b);
    const tmp = new Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, groundHeight(x, z));
      const n = Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.5 + 0.5;
      const m = Math.sin(x * 0.23 + z * 0.31) * 0.5 + 0.5;
      tmp.copy(a).lerp(b, n * 0.6).lerp(c, m * 0.35).lerp(haze, MathUtils.smoothstep(-z, 8, 30) * 0.35);
      tmp.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const ground = mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 0, 0, 0, false, true);
    scene.add(ground);

    // Uzoqdagi ko'kimtir tepaliklar — tuman ichida
    const hillMaterial = std(0xa7d7a0, 1);
    for (const [x, y, z, sx, sy, sz] of [
      [-30, -8, -62, 38, 14, 10],
      [14, -9.5, -68, 46, 16, 12],
      [46, -8, -58, 30, 12, 10],
    ] as const) {
      const hill = mesh(new SphereGeometry(1, 32, 16), hillMaterial, x, y, z, false, false);
      hill.scale.set(sx, sy, sz);
      scene.add(hill);
    }
  }

  // So'qmoq namunalari — maysa va gullar uning ustiga ekilmasin
  const pathSamples = Array.from({ length: 80 }, (_, i) => {
    const u = i / 79;
    const p = PATH_CURVE.getPointAt(u);
    return { x: p.x, z: p.z, w: pathHalfWidth(u) };
  });
  const blocked = (x: number, z: number, pad = 0): boolean => {
    if (Math.abs(x) < 1.85 + pad && z > -1.45 - pad && z < 1.72 + pad) return true;
    for (const [ox, oz, r] of OBSTACLES) if (Math.hypot(x - ox, z - oz) < r + pad) return true;
    for (const s of pathSamples) if (Math.hypot(x - s.x, z - s.z) < s.w + pad) return true;
    return false;
  };

  // ---------- So'qmoq ----------
  {
    const segments = 64;
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const side = new Vector3();
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const p = PATH_CURVE.getPointAt(u);
      const tangent = PATH_CURVE.getTangentAt(u);
      side.set(-tangent.z, 0, tangent.x).normalize();
      const w = pathHalfWidth(u);
      for (const s of [-1, 1]) {
        const x = p.x + side.x * w * s;
        const z = p.z + side.z * w * s;
        vertices.push(x, groundHeight(x, z) + 0.014, z);
        normals.push(0, 1, 0);
        uvs.push(s < 0 ? 0 : 1, u * 8);
      }
      if (i < segments) {
        const k = i * 2;
        indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const material = new MeshStandardMaterial({
      color: PALETTE.path,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    scene.add(mesh(geometry, material, 0, 0, 0, false, true));

    // Chetidagi mayda toshlar
    const pebbles = new InstancedMesh(new SphereGeometry(0.06, 8, 6), std(0xcfc3a8, 0.95), 70);
    const dummy = new Object3D();
    const tint = new Color();
    for (let i = 0; i < pebbles.count; i++) {
      const u = rng();
      const p = PATH_CURVE.getPointAt(u);
      const tangent = PATH_CURVE.getTangentAt(u);
      side.set(-tangent.z, 0, tangent.x).normalize();
      const offset = (pathHalfWidth(u) + 0.02 + rng() * 0.08) * (rng() < 0.5 ? -1 : 1);
      dummy.position.set(p.x + side.x * offset, 0.02, p.z + side.z * offset);
      dummy.scale.set(0.7 + rng() * 0.8, 0.35 + rng() * 0.25, 0.7 + rng() * 0.8);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
      pebbles.setColorAt(i, tint.setHSL(0.1, 0.12, 0.72 + rng() * 0.12));
    }
    pebbles.receiveShadow = true;
    scene.add(pebbles);
  }

  // ---------- Bog'cha binosi ----------
  const glass = new MeshPhysicalMaterial({
    color: 0xcfeaff,
    roughness: 0.06,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.6,
  });
  const trim = std(PALETTE.trim, 0.55);
  const W = 3.1;
  const H = 2.0;
  const D = 2.3;
  const BASE = 0.18;
  const FRONT = D / 2;
  const WALL_TOP = BASE + H;
  const RISE = 1.0;

  const house = new Group();
  {
    const shell = new Group();
    shell.add(mesh(new RoundedBoxGeometry(W + 0.26, BASE, D + 0.26, 2, 0.04), std(PALETTE.foundation, 0.95), 0, BASE / 2, 0));
    shell.add(mesh(new RoundedBoxGeometry(W, H, D, 3, 0.05), std(PALETTE.wall, 0.9), 0, BASE + H / 2, 0));
    // Devor pastidagi yalpiz rang chiziq — bog'cha binosiga xos
    shell.add(mesh(new BoxGeometry(W + 0.02, 0.14, D + 0.02), std(PALETTE.band, 0.8), 0, BASE + 0.22, 0));
    shell.add(mesh(new BoxGeometry(W + 0.05, 0.08, D + 0.05), trim, 0, WALL_TOP - 0.04, 0));

    // Uchburchak peshtoq
    const gable = new Shape();
    gable.moveTo(-W / 2, 0);
    gable.lineTo(W / 2, 0);
    gable.lineTo(0, RISE);
    gable.closePath();
    const gableGeometry = new ExtrudeGeometry(gable, { depth: D, bevelEnabled: false });
    gableGeometry.translate(0, 0, -D / 2);
    shell.add(mesh(gableGeometry, std(PALETTE.wall, 0.9), 0, WALL_TOP, 0));

    // Tom nishablari: cherepitsa bilan, har ikki tomonga 0.3 osilib turadi
    const run = W / 2;
    const hyp = Math.hypot(RISE, run);
    const slope = Math.atan2(RISE, run);
    const thick = 0.12;
    for (const side of [-1, 1]) {
      const texture = roofTexture(side * (Math.PI / 2));
      texture.anisotropy = maxAnisotropy;
      const roofMaterial = new MeshStandardMaterial({ map: texture, roughness: 0.75 });
      const panel = mesh(new BoxGeometry(hyp + 0.3, thick, D + 0.42), roofMaterial);
      const dirX = (side * run) / hyp;
      const dirY = -RISE / hyp;
      const nX = (side * RISE) / hyp;
      const nY = run / hyp;
      panel.position.set(
        (side * run) / 2 + dirX * 0.15 + (nX * thick) / 2,
        WALL_TOP + RISE / 2 + dirY * 0.15 + (nY * thick) / 2,
        0,
      );
      panel.rotation.z = -side * slope;
      shell.add(panel);
    }
    const ridge = mesh(new CylinderGeometry(0.085, 0.085, D + 0.46, 12), std(PALETTE.ridge, 0.7), 0, WALL_TOP + RISE + 0.06, 0);
    ridge.rotation.x = Math.PI / 2;
    shell.add(ridge);

    // Mo'ri
    shell.add(mesh(new BoxGeometry(0.3, 0.62, 0.3), std(PALETTE.brick, 0.9), -0.82, WALL_TOP + 0.78, -0.45));
    shell.add(mesh(new BoxGeometry(0.38, 0.08, 0.38), std(0x9f4c3b, 0.85), -0.82, WALL_TOP + 1.12, -0.45));

    // Peshtoqdagi dumaloq deraza
    const attic = new Group();
    attic.position.set(0, WALL_TOP + 0.42, FRONT + 0.01);
    attic.add(mesh(new TorusGeometry(0.25, 0.045, 10, 32), trim, 0, 0, 0.02));
    attic.add(mesh(new CircleGeometry(0.24, 32), glass, 0, 0, 0.005, false, false));
    attic.add(mesh(new BoxGeometry(0.035, 0.48, 0.02), trim, 0, 0, 0.022));
    attic.add(mesh(new BoxGeometry(0.48, 0.035, 0.02), trim, 0, 0, 0.022));
    shell.add(attic);

    // Derazalar va gul qutilari
    for (const wx of [-0.98, 0.98]) {
      const win = new Group();
      win.position.set(wx, BASE + 1.1, FRONT);
      win.add(mesh(new RoundedBoxGeometry(0.82, 0.74, 0.08, 2, 0.025), trim, 0, 0, 0.01));
      win.add(mesh(new PlaneGeometry(0.68, 0.6), glass, 0, 0, 0.052, false, false));
      win.add(mesh(new BoxGeometry(0.035, 0.6, 0.02), trim, 0, 0, 0.062));
      win.add(mesh(new BoxGeometry(0.68, 0.035, 0.02), trim, 0, 0, 0.062));
      win.add(mesh(new RoundedBoxGeometry(0.94, 0.14, 0.2, 2, 0.03), std(PALETTE.flowerBox, 0.85), 0, -0.44, 0.1));
      const blossom = new SphereGeometry(0.05, 10, 8);
      const leaf = new SphereGeometry(0.045, 8, 6);
      for (let i = 0; i < 7; i++) {
        const x = -0.36 + i * 0.12;
        win.add(mesh(leaf, std(0x4fae57, 0.8), x + 0.05, -0.37, 0.12));
        win.add(mesh(blossom, std(PALETTE.blossoms[(i + (wx > 0 ? 2 : 0)) % 5], 0.6), x, -0.33, 0.14));
      }
      shell.add(win);
    }

    // Eshik: ravoqli, oynachali, oldida zinapoya
    const arch = (hw: number, h: number) => {
      const s = new Shape();
      s.moveTo(-hw, 0);
      s.lineTo(-hw, h - hw);
      s.absarc(0, h - hw, hw, Math.PI, 0, true);
      s.lineTo(hw, 0);
      s.closePath();
      return s;
    };
    const door = new Group();
    door.position.set(0, BASE, FRONT);
    door.add(
      mesh(
        new ExtrudeGeometry(arch(0.46, 1.3), { depth: 0.06, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 20 }),
        trim,
        0,
        0,
        -0.02,
      ),
    );
    door.add(
      mesh(
        new ExtrudeGeometry(arch(0.38, 1.2), { depth: 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 20 }),
        std(PALETTE.door, 0.45),
        0,
        0,
        0.02,
      ),
    );
    door.add(mesh(new CircleGeometry(0.11, 24), glass, 0, 0.88, 0.096, false, false));
    door.add(mesh(new TorusGeometry(0.11, 0.02, 8, 24), std(PALETTE.gold, 0.35), 0, 0.88, 0.096));
    const knob = mesh(new SphereGeometry(0.035, 12, 10), new MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.7, roughness: 0.3 }), 0.25, 0.56, 0.11);
    door.add(knob);
    shell.add(door);
    shell.add(mesh(new RoundedBoxGeometry(1.1, 0.12, 0.42, 2, 0.03), std(0xd9c9a8, 0.95), 0, 0.06, FRONT + 0.22));

    // Tomdagi bayroq ustuni
    shell.add(mesh(new CylinderGeometry(0.022, 0.026, 0.95, 8), std(0xb0b7c3, 0.4), 0, WALL_TOP + RISE + 0.5, FRONT - 0.1));
    shell.add(mesh(new SphereGeometry(0.04, 10, 8), std(PALETTE.gold, 0.35), 0, WALL_TOP + RISE + 0.99, FRONT - 0.1));

    mergeStatic(shell);
    house.add(shell);

    // Bayroq — shamolda hilpiraydi
    const flagGeometry = new PlaneGeometry(0.62, 0.4, 12, 6);
    flagGeometry.translate(0.31, 0, 0);
    const flagPosition = flagGeometry.getAttribute("position");
    const flagRest = Float32Array.from(flagPosition.array as ArrayLike<number>);
    const flag = mesh(
      flagGeometry,
      new MeshStandardMaterial({ color: 0xff5a5f, roughness: 0.7, side: DoubleSide }),
      0.025,
      WALL_TOP + RISE + 0.76,
      FRONT - 0.1,
    );
    house.add(flag);
    updaters.push((t) => {
      for (let i = 0; i < flagPosition.count; i++) {
        const x = flagRest[i * 3];
        const y = flagRest[i * 3 + 1];
        const k = x / 0.62;
        flagPosition.setZ(i, Math.sin(x * 7 - t * 5.5) * 0.07 * k + Math.sin(y * 6 - t * 3.1) * 0.015 * k);
        flagPosition.setY(i, y - k * k * 0.035);
      }
      flagPosition.needsUpdate = true;
      flagGeometry.computeVertexNormals();
    });
  }
  scene.add(house);

  // ---------- Peshtoqdagi lavha: tashkilot nomi ----------
  const sign = new Group();
  sign.position.set(0, BASE + 1.75, FRONT + 0.03);
  house.add(sign);
  const signBoardMaterial = std(0xf2b53a, 0.6);
  const signFaceMaterial = new MeshStandardMaterial({ roughness: 0.55 });
  let signBoard: Mesh | null = null;
  let signFace: Mesh | null = null;
  let signTexture: CanvasTexture | null = null;

  const setName = (name: string | null) => {
    const text = (name ?? "").trim().toLocaleUpperCase("uz");
    const height = 0.34;
    const width = MathUtils.clamp(0.42 + text.length * 0.12, 1.0, 2.5);

    const pxH = 128;
    const pxW = Math.round(pxH * (width / height));
    const [canvasEl, ctx] = canvas2d(pxW, pxH);
    const bg = ctx.createLinearGradient(0, 0, 0, pxH);
    bg.addColorStop(0, "#ffe08a");
    bg.addColorStop(1, "#ffc73d");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, pxW, pxH, 26);
    ctx.fill();
    ctx.strokeStyle = "#e2a22a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 8, pxW - 16, pxH - 16, 20);
    ctx.stroke();
    if (text) {
      let size = 66;
      ctx.font = `800 ${size}px ${FONT}`;
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "4px";
      const measured = ctx.measureText(text).width;
      const room = pxW - 56;
      if (measured > room) {
        size = Math.max(30, Math.floor((size * room) / measured));
        ctx.font = `800 ${size}px ${FONT}`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(text, pxW / 2, pxH / 2 + 3, room);
      ctx.fillStyle = "#7a4606";
      ctx.fillText(text, pxW / 2, pxH / 2, room);
    }

    signTexture?.dispose();
    signTexture = toTexture(canvasEl);
    signTexture.anisotropy = maxAnisotropy;
    signFaceMaterial.map = signTexture;
    signFaceMaterial.needsUpdate = true;

    if (signBoard) {
      sign.remove(signBoard);
      signBoard.geometry.dispose();
    }
    if (signFace) {
      sign.remove(signFace);
      signFace.geometry.dispose();
    }
    signBoard = mesh(new RoundedBoxGeometry(width + 0.06, height + 0.06, 0.06, 2, 0.025), signBoardMaterial, 0, 0, 0);
    signFace = mesh(new PlaneGeometry(width, height), signFaceMaterial, 0, 0, 0.032, false, true);
    sign.add(signBoard, signFace);
  };
  setName(options.name);

  // ---------- Daraxtlar ----------
  const blob = (radius: number): BufferGeometry => {
    let geometry: BufferGeometry = new IcosahedronGeometry(radius, 2);
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    geometry = mergeVertices(geometry);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const s = 1 + (rng() - 0.5) * 0.18;
      const y = position.getY(i);
      position.setXYZ(i, position.getX(i) * s, (y < -radius * 0.35 ? y * 0.8 : y) * s, position.getZ(i) * s);
    }
    geometry.computeVertexNormals();
    return geometry;
  };

  const makeTree = (scale: number, apples: boolean): Group => {
    const tree = new Group();
    const bark = std(PALETTE.trunk, 0.95);
    tree.add(mesh(new CylinderGeometry(0.13, 0.24, 2.4, 10), bark, 0, 1.2, 0));
    const b1 = mesh(new CylinderGeometry(0.045, 0.075, 0.8, 8), bark, -0.27, 2.2, 0.05);
    b1.rotation.z = 0.7;
    const b2 = mesh(new CylinderGeometry(0.045, 0.075, 0.75, 8), bark, 0.28, 2.3, -0.05);
    b2.rotation.z = -0.8;
    tree.add(b1, b2);
    const blobs: Array<[number, number, number, number]> = [
      [0, 3.1, 0, 1.05],
      [-0.78, 2.72, 0.12, 0.8],
      [0.8, 2.78, 0.06, 0.84],
      [0.12, 3.72, -0.08, 0.74],
      [-0.34, 2.58, 0.58, 0.64],
      [0.44, 2.62, 0.62, 0.62],
      [0.02, 2.9, -0.62, 0.82],
    ];
    for (const [x, y, z, r] of blobs) {
      tree.add(mesh(blob(r), std(PALETTE.leaves[Math.floor(rng() * PALETTE.leaves.length)], 0.9, true), x, y, z));
    }
    if (apples) {
      const appleGeometry = new SphereGeometry(0.075, 12, 10);
      const dir = new Vector3();
      for (let i = 0; i < 10; i++) {
        const [bx, by, bz, br] = blobs[Math.floor(rng() * blobs.length)];
        dir.set(rng() * 2 - 1, rng() * 1.4 - 0.4, 0.35 + rng()).normalize();
        tree.add(mesh(appleGeometry, std(PALETTE.apple, 0.45), bx + dir.x * br * 0.96, by + dir.y * br * 0.96, bz + dir.z * br * 0.96));
      }
    }
    tree.scale.setScalar(scale);
    mergeStatic(tree);
    return tree;
  };

  const bigTree = makeTree(1.12, true);
  bigTree.position.set(-4.3, 0, -0.35);
  scene.add(bigTree);
  updaters.push((t) => {
    bigTree.rotation.z = Math.sin(t * 0.7) * 0.006;
  });

  for (const [x, z, s] of [
    [-9, -9, 0.8],
    [-6.5, -13, 0.7],
    [-12, -14, 0.75],
    [-2.2, -16, 0.62],
    [3.5, -14, 0.7],
    [7.5, -10.5, 0.8],
    [10.5, -15, 0.72],
    [13.5, -9.5, 0.78],
  ] as const) {
    const tree = makeTree(s, false);
    tree.position.set(x, groundHeight(x, z) - 0.05, z);
    tree.rotation.y = rng() * Math.PI * 2;
    scene.add(tree);
  }

  // Bino yonidagi butalar
  {
    const bushes = new Group();
    for (const [x, y, z, r] of [
      [-1.98, 0.32, 0.95, 0.42],
      [-2.3, 0.24, 0.5, 0.3],
      [1.98, 0.3, 1.02, 0.4],
      [-1.95, 0.28, -0.9, 0.36],
    ] as const) {
      bushes.add(mesh(blob(r), std(PALETTE.leaves[Math.floor(rng() * PALETTE.leaves.length)], 0.9, true), x, y, z));
    }
    mergeStatic(bushes);
    scene.add(bushes);
  }

  // ---------- Bolalar ----------
  const makeKid = (look: KidLook): Kid => {
    const root = new Group();
    const skin = std(look.skin, 0.6);
    const shirt = std(look.shirt, 0.8);
    const pants = std(look.pants, 0.85);
    const shoe = std(look.shoe, 0.7);
    const hair = std(look.hair, 0.9);

    const makeLeg = (side: number) => {
      const pivot = new Group();
      pivot.position.set(0.065 * side, 0.4, 0);
      pivot.add(mesh(new CapsuleGeometry(0.055, 0.2, 4, 10), pants, 0, -0.16, 0));
      pivot.add(mesh(new RoundedBoxGeometry(0.1, 0.07, 0.15, 2, 0.03), shoe, 0, -0.3, 0.03));
      return pivot;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    const torso = mesh(new CapsuleGeometry(0.13, 0.16, 6, 14), shirt, 0, 0.58, 0);
    torso.scale.set(1, 1, 0.82);

    const makeArm = (side: number) => {
      const pivot = new Group();
      pivot.position.set(0.155 * side, 0.68, 0);
      pivot.add(mesh(new CapsuleGeometry(0.042, 0.17, 4, 10), shirt, 0, -0.11, 0));
      pivot.add(mesh(new SphereGeometry(0.048, 12, 10), skin, 0, -0.23, 0));
      return pivot;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    const head = new Group();
    head.position.y = 0.93;
    head.add(mesh(new SphereGeometry(0.19, 24, 18), skin));
    const eye = new SphereGeometry(0.024, 10, 8);
    const eyeMaterial = std(0x2a211c, 0.35);
    const glint = new SphereGeometry(0.008, 6, 5);
    const glintMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const cheek = new SphereGeometry(0.035, 10, 8);
    const cheekMaterial = std(0xffa8a0, 0.7);
    for (const s of [-1, 1]) {
      head.add(mesh(eye, eyeMaterial, 0.068 * s, 0.02, 0.172, false, false));
      head.add(mesh(glint, glintMaterial, 0.068 * s + 0.008, 0.03, 0.192, false, false));
      const c = mesh(cheek, cheekMaterial, 0.11 * s, -0.045, 0.148, false, false);
      c.scale.set(1, 0.6, 0.4);
      head.add(c);
    }
    const smile = mesh(new TorusGeometry(0.045, 0.01, 6, 16, Math.PI), eyeMaterial, 0, -0.055, 0.178, false, false);
    smile.rotation.set(-0.25, 0, Math.PI);
    head.add(smile);

    // Soch
    const cap = (theta: number, tilt: number, scale = 1) => {
      const m = mesh(new SphereGeometry(0.2, 24, 16, 0, Math.PI * 2, 0, theta), hair, 0, 0.012, -0.004);
      m.rotation.x = tilt;
      m.scale.setScalar(scale);
      return m;
    };
    if (look.hairStyle === "short") head.add(cap(Math.PI * 0.55, -0.5));
    if (look.hairStyle === "bob") head.add(cap(Math.PI * 0.62, -0.62, 1.04));
    if (look.hairStyle === "pigtails") {
      head.add(cap(Math.PI * 0.55, -0.5));
      for (const s of [-1, 1]) {
        head.add(mesh(new SphereGeometry(0.075, 12, 10), hair, 0.2 * s, -0.01, -0.05));
        head.add(mesh(new SphereGeometry(0.025, 8, 6), std(0xff6b9a, 0.6), 0.16 * s, 0.03, -0.03));
      }
    }
    if (look.hairStyle === "curly") {
      head.add(cap(Math.PI * 0.5, -0.45));
      const curl = new SphereGeometry(0.068, 10, 8);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        head.add(mesh(curl, hair, Math.cos(a) * 0.13, 0.13 + Math.sin(i * 1.7) * 0.02, Math.sin(a) * 0.12 - 0.03));
      }
    }

    root.add(legL, legR, torso, armL, armR, head);
    root.scale.setScalar(0.82);
    return { root, head, armL, armR, legL, legR };
  };

  const SKIN = [0xffd6b0, 0xf2c199, 0xd9a074, 0xb07a52];

  // ---------- Daraxtdagi arg'imchoq ----------
  {
    const branch = mesh(new CylinderGeometry(0.055, 0.075, 1.1, 8), std(PALETTE.trunk, 0.95), -3.78, 2.12, -0.35);
    branch.rotation.z = Math.PI / 2 - 0.1;
    scene.add(branch);

    const swing = new Group();
    swing.position.set(-3.72, 2.08, -0.35);
    const ropeMaterial = std(PALETTE.rope, 0.95);
    for (const s of [-1, 1]) swing.add(mesh(new CylinderGeometry(0.012, 0.012, 1.5, 6), ropeMaterial, 0.26 * s, -0.75, 0));
    swing.add(mesh(new RoundedBoxGeometry(0.62, 0.06, 0.26, 2, 0.02), std(0xa0663a, 0.8), 0, -1.5, 0));
    const kid = makeKid({ skin: SKIN[0], hair: 0x3b2a20, hairStyle: "short", shirt: 0xff9f43, pants: 0x3b5bdb, shoe: 0x4a3627 });
    kid.root.position.set(0, -1.47 - 0.37 * 0.82, 0.02);
    kid.armL.rotation.z = -2.43;
    kid.armR.rotation.z = 2.43;
    swing.add(kid.root);
    scene.add(swing);
    updaters.push((t) => {
      swing.rotation.x = Math.sin(t * 1.8) * 0.42;
      const kick = Math.sin(t * 1.8 + 0.6) * 0.35;
      kid.legL.rotation.x = -1.45 + kick;
      kid.legR.rotation.x = -1.45 + kick;
      kid.root.rotation.x = -0.1 - Math.sin(t * 1.8) * 0.08;
      kid.head.rotation.z = Math.sin(t * 0.9) * 0.06;
    });
  }

  // ---------- Tarozi-arg'imchoq ----------
  {
    const seesaw = new Group();
    seesaw.position.set(-2.0, 0, 2.6);
    // Chap uchi kameraga yaqinroq — arg'imchoqdagi bolani to'sib qo'ymasin
    seesaw.rotation.y = 0.35;
    const base = new Shape();
    base.moveTo(-0.2, 0);
    base.lineTo(0.2, 0);
    base.lineTo(0, 0.38);
    base.closePath();
    const baseGeometry = new ExtrudeGeometry(base, { depth: 0.3, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    baseGeometry.translate(0, 0, -0.15);
    seesaw.add(mesh(baseGeometry, std(PALETTE.orangeDark, 0.7)));

    const plank = new Group();
    plank.position.y = 0.4;
    plank.add(mesh(new RoundedBoxGeometry(2.2, 0.08, 0.32, 2, 0.03), std(PALETTE.plank, 0.6)));
    for (const s of [-1, 1]) {
      plank.add(mesh(new CylinderGeometry(0.022, 0.022, 0.24, 8), std(PALETTE.orangeDark, 0.5), 0.62 * s, 0.14, 0));
      const bar = mesh(new CylinderGeometry(0.02, 0.02, 0.26, 8), std(PALETTE.orangeDark, 0.5), 0.62 * s, 0.26, 0);
      bar.rotation.x = Math.PI / 2;
      plank.add(bar);
    }
    const kidA = makeKid({ skin: SKIN[2], hair: 0x1f1a17, hairStyle: "curly", shirt: 0x60a5fa, pants: 0x374151, shoe: 0x2b2b2b });
    const kidB = makeKid({ skin: SKIN[1], hair: 0xe0703a, hairStyle: "pigtails", shirt: 0xf472b6, pants: 0x7c3aed, shoe: 0x6b3a2a });
    for (const [kid, s] of [
      [kidA, -1],
      [kidB, 1],
    ] as const) {
      kid.root.position.set(0.88 * s, 0.04 - 0.37 * 0.82, 0);
      kid.root.rotation.y = -s * (Math.PI / 2 - 0.5);
      kid.legL.rotation.x = -1.15;
      kid.legR.rotation.x = -1.15;
      kid.armL.rotation.x = -1.25;
      kid.armR.rotation.x = -1.25;
      plank.add(kid.root);
    }
    seesaw.add(plank);
    scene.add(seesaw);
    updaters.push((t) => {
      plank.rotation.z = Math.sin(t * 1.25) * 0.2;
      kidA.head.rotation.z = Math.sin(t * 1.25 + 1) * 0.07;
      kidB.head.rotation.z = Math.sin(t * 1.25 + 2) * 0.07;
    });
  }

  // ---------- Sirpanchiq (tepasida qo'l silkitayotgan bola) ----------
  {
    const slide = new Group();
    slide.position.set(2.25, 0, -0.3);
    slide.rotation.y = -0.55;
    const frame = new Group();
    const rail = std(PALETTE.orange, 0.55);
    for (const s of [-1, 1]) frame.add(mesh(new CylinderGeometry(0.035, 0.035, 2.05, 10), rail, 0, 1.025, 0.24 * s));
    for (let i = 0; i < 5; i++) {
      const rung = mesh(new CylinderGeometry(0.025, 0.025, 0.48, 8), std(PALETTE.orangeDark, 0.55), 0, 0.3 + i * 0.3, 0);
      rung.rotation.x = Math.PI / 2;
      frame.add(rung);
    }
    frame.add(mesh(new RoundedBoxGeometry(0.5, 0.07, 0.56, 2, 0.02), std(PALETTE.orangeDark, 0.6), 0.25, 1.62, 0));
    const chute = new Group();
    chute.position.set(1.25, 0.94, 0);
    chute.rotation.z = -0.758;
    const chuteMaterial = std(PALETTE.chute, 0.4);
    chute.add(mesh(new RoundedBoxGeometry(2.07, 0.05, 0.46, 2, 0.02), chuteMaterial));
    for (const s of [-1, 1]) chute.add(mesh(new RoundedBoxGeometry(2.07, 0.14, 0.04, 2, 0.015), chuteMaterial, 0, 0.07, 0.23 * s));
    frame.add(chute);
    frame.add(mesh(new RoundedBoxGeometry(0.36, 0.05, 0.46, 2, 0.02), chuteMaterial, 2.14, 0.2, 0));
    for (const s of [-1, 1]) frame.add(mesh(new CylinderGeometry(0.025, 0.025, 0.2, 8), rail, 2.2, 0.1, 0.18 * s));
    mergeStatic(frame);
    slide.add(frame);

    const kid = makeKid({ skin: SKIN[3], hair: 0x2a1d17, hairStyle: "bob", shirt: 0x34d399, pants: 0x1e3a8a, shoe: 0x3f2a1f });
    kid.root.position.set(0.25, 1.655, 0);
    kid.root.rotation.y = 0.1;
    kid.armL.rotation.z = -0.18;
    slide.add(kid.root);
    scene.add(slide);
    updaters.push((t) => {
      kid.armR.rotation.z = 2.55 + Math.sin(t * 7) * 0.32;
      kid.head.rotation.z = Math.sin(t * 1.4) * 0.08;
    });

    // Sirpanchiq yonida sakrab turgan koptok
    const ball = mesh(new SphereGeometry(0.13, 20, 16), new MeshStandardMaterial({ color: 0xef476f, roughness: 0.35 }), 4.7, 0.13, 1.35);
    scene.add(ball);
    updaters.push((t) => {
      const hop = Math.abs(Math.sin(t * 2.3));
      ball.position.y = 0.13 + hop * 0.28;
      ball.scale.set(1 + (1 - hop) * 0.08, 1 - (1 - hop) * 0.1, 1 + (1 - hop) * 0.08);
    });
  }

  // ---------- Panjara ----------
  {
    const fence = new Group();
    const white = std(0xffffff, 0.6);
    for (let i = 0; i < 10; i++) {
      const x = -3.55 + i * 0.2;
      fence.add(mesh(new BoxGeometry(0.1, 0.46, 0.035), white, x, 0.23, -1.45));
      const tip = mesh(new BoxGeometry(0.07, 0.07, 0.035), white, x, 0.46, -1.45);
      tip.rotation.z = Math.PI / 4;
      fence.add(tip);
    }
    for (const y of [0.14, 0.34]) fence.add(mesh(new BoxGeometry(2.0, 0.05, 0.03), white, -2.65, y, -1.47));
    mergeStatic(fence);
    scene.add(fence);
  }

  // ---------- ABC kubiklari ----------
  {
    const blocks: Array<[string, string, string, number, number, number, number]> = [
      ["A", "#ff8fa3", "#ffffff", -4.25, 0.21, 1.85, 0.3],
      ["B", "#7ad3ff", "#ffffff", -3.78, 0.21, 2.0, -0.2],
      ["C", "#ffd166", "#9a5b00", -4.0, 0.63, 1.92, 0.55],
    ];
    const geometry = new RoundedBoxGeometry(0.42, 0.42, 0.42, 3, 0.05);
    for (const [letter, bg, fg, x, y, z, ry] of blocks) {
      const texture = blockTexture(letter, bg, fg);
      texture.anisotropy = maxAnisotropy;
      const block = mesh(geometry, new MeshStandardMaterial({ map: texture, roughness: 0.55 }), x, y, z);
      block.rotation.y = ry;
      scene.add(block);
    }
  }

  // ---------- Qum maydonchasi ----------
  {
    const box = new Group();
    box.position.set(-3.4, 0, 4.3);
    box.rotation.y = 0.22;
    const wood = std(PALETTE.wood, 0.85);
    for (const s of [-1, 1]) {
      box.add(mesh(new RoundedBoxGeometry(1.94, 0.22, 0.12, 2, 0.03), wood, 0, 0.11, 0.56 * s));
      box.add(mesh(new RoundedBoxGeometry(0.12, 0.22, 1.24, 2, 0.03), wood, 0.95 * s, 0.11, 0));
    }
    box.add(mesh(new BoxGeometry(1.8, 0.16, 1.02), std(PALETTE.sand, 1), 0, 0.08, 0));
    const mound = mesh(new SphereGeometry(1, 20, 12), std(0xead39c, 1), 0.38, 0.16, -0.12);
    mound.scale.set(0.46, 0.13, 0.32);
    box.add(mound);
    const castle = mesh(new CylinderGeometry(0.09, 0.12, 0.16, 14), std(0xe8cf92, 1), -0.05, 0.24, -0.2);
    box.add(castle);
    const bucket = new Group();
    bucket.position.set(-0.48, 0.16, 0.12);
    const red = new MeshStandardMaterial({ color: 0xef476f, roughness: 0.45, side: DoubleSide });
    bucket.add(mesh(new CylinderGeometry(0.14, 0.1, 0.22, 16, 1, true), red, 0, 0.11, 0));
    bucket.add(mesh(new CircleGeometry(0.1, 16), red, 0, 0.001, 0));
    const handle = mesh(new TorusGeometry(0.13, 0.01, 6, 16, Math.PI), std(0x9ca3af, 0.4), 0, 0.22, 0);
    bucket.add(handle);
    box.add(bucket);
    const shovel = new Group();
    shovel.position.set(0.15, 0.18, 0.28);
    shovel.rotation.set(0, 0.6, Math.PI / 2 - 0.15);
    shovel.add(mesh(new CylinderGeometry(0.018, 0.018, 0.34, 8), std(0x3b82f6, 0.5), 0, 0, 0));
    shovel.add(mesh(new RoundedBoxGeometry(0.12, 0.14, 0.02, 2, 0.008), std(0x3b82f6, 0.5), 0, 0.22, 0));
    box.add(shovel);
    mergeStatic(box);
    scene.add(box);
  }

  // ---------- Kamalak (bino ortida) ----------
  {
    const colors = [0xff8fa3, 0xffb703, 0xffe66d, 0x8ce99a, 0x74c0fc, 0xb197fc];
    colors.forEach((color, i) => {
      const arc = new Mesh(
        new TorusGeometry(5.6 - i * 0.19, 0.095, 8, 120, Math.PI),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false }),
      );
      arc.position.set(1.2, -0.4, -10.5);
      arc.renderOrder = 1;
      scene.add(arc);
    });
  }

  // ---------- Gullar (shamolda tebranadi) ----------
  {
    type Flower = { x: number; y: number; z: number; h: number; s: number; spin: number; phase: number };
    const flowers: Flower[] = [];
    const add = (x: number, z: number) => {
      flowers.push({ x, y: groundHeight(x, z), z, h: 0.2 + rng() * 0.16, s: 0.85 + rng() * 0.35, spin: rng() * Math.PI, phase: rng() * Math.PI * 2 });
    };
    // Bino oldidagi gulzor — eshik oldini bo'sh qoldirib
    for (let i = 0; i < 16; i++) {
      const x = -1.45 + (i / 15) * 2.9;
      if (Math.abs(x) < 0.66) continue;
      add(x + (rng() - 0.5) * 0.08, 1.52 + rng() * 0.18);
    }
    const scatter = (count: number, x0: number, x1: number, z0: number, z1: number) => {
      let placed = 0;
      for (let tries = 0; placed < count && tries < count * 20; tries++) {
        const x = MathUtils.lerp(x0, x1, rng());
        const z = MathUtils.lerp(z0, z1, rng());
        if (blocked(x, z, 0.12)) continue;
        add(x, z);
        placed++;
      }
    };
    scatter(10, -6.4, -4.6, 0.6, 3.2);
    scatter(10, 2.6, 6.0, 1.4, 3.8);
    scatter(12, 4.5, 9.5, -1.2, 3.2);
    scatter(8, -1.2, 2.0, 3.2, 6.5);
    scatter(6, -7.5, -5.2, 4.0, 7.0);

    const stems = new InstancedMesh(new CylinderGeometry(0.012, 0.016, 1, 5, 1).translate(0, 0.5, 0), std(0x4aa957, 0.8), flowers.length);
    const petalParts: BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new SphereGeometry(0.05, 10, 8);
      petal.scale(1, 0.45, 1);
      petal.translate(Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055);
      petalParts.push(petal);
    }
    const petalGeometry = mergeGeometries(petalParts) ?? new SphereGeometry(0.08, 10, 8);
    petalParts.forEach((p) => p.dispose());
    const petals = new InstancedMesh(petalGeometry, std(0xffffff, 0.6), flowers.length);
    const centers = new InstancedMesh(new SphereGeometry(0.036, 10, 8).translate(0, 0.012, 0), std(0xffc93c, 0.5), flowers.length);
    const tint = new Color();
    flowers.forEach((_, i) => petals.setColorAt(i, tint.setHex(PALETTE.blossoms[i % PALETTE.blossoms.length])));
    for (const m of [stems, petals, centers]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.castShadow = true;
      scene.add(m);
    }
    const dummy = new Object3D();
    const up = new Vector3();
    const place = (t: number) => {
      flowers.forEach((f, i) => {
        const sx = Math.sin(t * 1.4 + f.phase) * 0.1;
        const sz = Math.cos(t * 1.1 + f.phase * 1.3) * 0.06;
        dummy.position.set(f.x, f.y, f.z);
        dummy.rotation.set(sz, 0, sx);
        dummy.scale.set(1, f.h, 1);
        dummy.updateMatrix();
        stems.setMatrixAt(i, dummy.matrix);
        up.set(0, f.h, 0).applyEuler(dummy.rotation);
        dummy.position.set(f.x + up.x, f.y + up.y, f.z + up.z);
        dummy.rotation.set(sz + 0.45, f.spin, sx);
        dummy.scale.setScalar(f.s);
        dummy.updateMatrix();
        petals.setMatrixAt(i, dummy.matrix);
        centers.setMatrixAt(i, dummy.matrix);
      });
      stems.instanceMatrix.needsUpdate = true;
      petals.instanceMatrix.needsUpdate = true;
      centers.instanceMatrix.needsUpdate = true;
    };
    place(0);
    updaters.push(place);
  }

  // ---------- Maysa (shamolda chayqaladi) ----------
  const timeUniform = { value: 0 };
  {
    const blade = new PlaneGeometry(0.045, 0.26, 1, 3);
    blade.translate(0, 0.13, 0);
    const position = blade.getAttribute("position");
    const normal = blade.getAttribute("normal");
    for (let i = 0; i < position.count; i++) {
      const k = 1 - position.getY(i) / 0.26;
      position.setX(i, position.getX(i) * (0.25 + 0.75 * k));
      // Normal tepaga — o'tloq yer bilan bir xil yorug'likda ko'rinsin
      normal.setXYZ(i, 0, 1, 0);
    }
    const material = new MeshStandardMaterial({ roughness: 0.92, side: DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying float vBladeH;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vBladeH = uv.y;
          #ifdef USE_INSTANCING
            vec3 root = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 root = vec3(0.0);
          #endif
          float gust = sin(uTime * 1.3 + root.x * 0.45 + root.z * 0.3) * 0.5 + 0.5;
          float sway = (sin(uTime * 2.1 + root.x * 1.7 + root.z * 1.1) * 0.05 + gust * 0.07) * uv.y * uv.y;
          transformed.x += sway;
          transformed.z += sway * 0.5;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vBladeH;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.55, 1.1, vBladeH);");
    };
    const count = narrow ? 1100 : 2600;
    const grass = new InstancedMesh(blade, material, count);
    const dummy = new Object3D();
    const tint = new Color();
    const shades = [0x4fa845, 0x63b957, 0x78c86a, 0x8ad37a];
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 6; tries++) {
      const x = MathUtils.lerp(-10, 12, rng());
      // Kameraga yaqin joyda zichroq — uzoqdagisi baribir ko'rinmaydi
      const z = -4 + 14 * Math.sqrt(rng());
      if (blocked(x, z, 0.04)) continue;
      dummy.position.set(x, groundHeight(x, z), z);
      dummy.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI, (rng() - 0.5) * 0.35);
      const tall = 0.7 + rng() * 0.65;
      dummy.scale.set(0.8 + rng() * 0.5, tall, 1);
      dummy.updateMatrix();
      grass.setMatrixAt(placed, dummy.matrix);
      grass.setColorAt(placed, tint.setHex(shades[Math.floor(rng() * shades.length)]).offsetHSL(0, 0, (rng() - 0.5) * 0.06));
      placed++;
    }
    grass.count = placed;
    grass.receiveShadow = true;
    scene.add(grass);

    // Romashkalar — old planda
    const parts: BufferGeometry[] = [];
    const petalColor = new Color(0xffffff);
    const centerColor = new Color(0xffc93c);
    const colored = (geometry: BufferGeometry, color: Color) => {
      const n = geometry.getAttribute("position").count;
      const data = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) color.toArray(data, i * 3);
      geometry.setAttribute("color", new Float32BufferAttribute(data, 3));
      return geometry;
    };
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new SphereGeometry(0.035, 8, 6);
      petal.scale(1.4, 0.3, 0.7);
      petal.rotateY(-a);
      petal.translate(Math.cos(a) * 0.045, 0.02, Math.sin(a) * 0.045);
      parts.push(colored(petal, petalColor));
    }
    parts.push(colored(new SphereGeometry(0.025, 8, 6).translate(0, 0.03, 0), centerColor));
    const daisyGeometry = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    if (daisyGeometry) {
      const daisies = new InstancedMesh(daisyGeometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 90);
      let n = 0;
      for (let tries = 0; n < daisies.count && tries < 900; tries++) {
        const x = MathUtils.lerp(-8, 10, rng());
        const z = MathUtils.lerp(2.4, 9, rng());
        if (blocked(x, z, 0.08)) continue;
        dummy.position.set(x, groundHeight(x, z), z);
        dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3);
        dummy.scale.setScalar(0.75 + rng() * 0.45);
        dummy.updateMatrix();
        daisies.setMatrixAt(n++, dummy.matrix);
      }
      daisies.count = n;
      daisies.receiveShadow = true;
      scene.add(daisies);
    }
  }

  // ---------- Bulutlar ----------
  {
    const puffs: Array<[number, number, number, number]> = [
      [0, 0, 0, 1.0],
      [-1.1, -0.25, 0.1, 0.75],
      [1.15, -0.2, 0, 0.8],
      [0.45, 0.45, -0.1, 0.72],
      [-0.5, 0.35, 0.15, 0.62],
      [1.9, -0.45, 0.05, 0.5],
      [-1.8, -0.45, 0, 0.5],
    ];
    const parts = puffs.map(([x, y, z, r]) => new SphereGeometry(r, 18, 14).translate(x, y, z));
    const cloudGeometry = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    if (cloudGeometry) {
      cloudGeometry.scale(1, 0.82, 0.7);
      const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.32, fog: false });
      const clouds = (
        [
          [-18, 11, -38, 2.6, 0.32],
          [4, 14.5, -52, 3.0, 0.26],
          [9, 10.5, -34, 2.2, 0.4],
          [22, 12.5, -44, 3.0, 0.3],
          [-30, 9.5, -40, 2.4, 0.36],
          [34, 10, -36, 2.0, 0.42],
          [-15, 12.2, -66, 3.0, 0.22],
        ] as const
      ).map(([x, y, z, s, speed]) => {
        const cloud = new Mesh(cloudGeometry, material);
        cloud.position.set(x, y, z);
        cloud.scale.setScalar(s);
        scene.add(cloud);
        return { cloud, speed };
      });
      updaters.push((_, dt) => {
        for (const { cloud, speed } of clouds) {
          cloud.position.x += speed * dt;
          if (cloud.position.x > 48) cloud.position.x = -48;
        }
      });
    }
  }

  // ---------- Havo sharlari ----------
  {
    const balloons = [
      { x: -0.7, z: -2.6, color: 0xff6b8a, speed: 0.32, phase: 0, floor: 0.9, y: 1.4 },
      { x: 0.9, z: -3.2, color: 0xffd166, speed: 0.27, phase: 2.1, floor: 0.9, y: 5.8 },
      { x: -4.1, z: -1.9, color: 0x5ec8ff, speed: 0.3, phase: 4.2, floor: 2.9, y: 9.2 },
    ].map((b) => {
      const group = new Group();
      const body = mesh(
        new SphereGeometry(0.32, 28, 20),
        new MeshPhysicalMaterial({ color: b.color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }),
        0,
        0,
        0,
        false,
        false,
      );
      body.scale.set(1, 1.18, 1);
      group.add(body);
      group.add(mesh(new CylinderGeometry(0.02, 0.05, 0.07, 8), body.material as Material, 0, -0.39, 0, false, false));
      const points = new CatmullRomCurve3([
        new Vector3(0, -0.42, 0),
        new Vector3(0.05, -0.75, 0),
        new Vector3(-0.04, -1.1, 0),
        new Vector3(0.03, -1.45, 0),
      ]).getPoints(16);
      const string = new Line(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color: 0x9ca3af }));
      group.add(string);
      group.position.set(b.x, b.y, b.z);
      scene.add(group);
      return { ...b, group };
    });
    updaters.push((t, dt) => {
      for (const b of balloons) {
        b.y += b.speed * dt;
        if (b.y > 13) b.y = b.floor;
        b.group.position.set(b.x + Math.sin(t * 0.6 + b.phase) * 0.35, b.y, b.z);
        b.group.rotation.z = Math.sin(t * 0.8 + b.phase) * 0.08;
      }
    });
  }

  // ---------- Qushlar galasi ----------
  {
    const wing = new Shape();
    wing.moveTo(0, 0);
    wing.quadraticCurveTo(0.25, 0.14, 0.6, 0.05);
    wing.lineTo(0.18, -0.03);
    wing.closePath();
    const wingGeometry = new ShapeGeometry(wing, 6);
    const material = new MeshBasicMaterial({ color: 0x51607a, side: DoubleSide });
    const flock = new Group();
    flock.position.set(-30, 10.5, -42);
    const birds = (
      [
        [0, 0, 0],
        [1.2, 0.5, 0.4],
        [2.3, -0.2, -0.3],
        [3.4, 0.7, 0.2],
        [-1.1, 0.6, -0.2],
      ] as const
    ).map(([x, y, z], i) => {
      const bird = new Group();
      bird.position.set(x, y, z);
      const right = new Mesh(wingGeometry, material);
      const left = new Mesh(wingGeometry, material);
      left.scale.x = -1;
      bird.add(right, left);
      bird.rotation.x = -1.2;
      flock.add(bird);
      return { right, left, phase: i * 0.9 };
    });
    scene.add(flock);
    updaters.push((t, dt) => {
      flock.position.x += 1.1 * dt;
      if (flock.position.x > 42) flock.position.x = -42;
      for (const b of birds) {
        const flap = Math.sin(t * 6 + b.phase) * 0.55;
        b.right.rotation.y = flap;
        b.left.rotation.y = -flap;
      }
    });
  }

  // ---------- Kapalaklar ----------
  {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.05, 0.12, 0.2, 0.16, 0.22, 0.06);
    shape.bezierCurveTo(0.24, 0.0, 0.16, -0.02, 0.1, -0.02);
    shape.bezierCurveTo(0.18, -0.06, 0.16, -0.16, 0.08, -0.13);
    shape.bezierCurveTo(0.04, -0.11, 0.01, -0.05, 0, 0);
    const wingGeometry = new ShapeGeometry(shape, 12);
    wingGeometry.rotateX(-Math.PI / 2);
    const bodyGeometry = new CapsuleGeometry(0.012, 0.09, 4, 6).rotateX(Math.PI / 2);
    const bodyMaterial = std(0x3a2e2a, 0.6);
    const flutters = [
      { cx: 1.3, cy: 1.0, cz: 2.3, color: 0xff8fc0, phase: 0 },
      { cx: -1.4, cy: 0.9, cz: 3.1, color: 0xfcd34d, phase: 2.5 },
    ].map((b) => {
      const group = new Group();
      const material = new MeshStandardMaterial({ color: b.color, roughness: 0.6, side: DoubleSide, emissive: b.color, emissiveIntensity: 0.15 });
      const right = new Mesh(wingGeometry, material);
      const left = new Mesh(wingGeometry, material);
      left.scale.x = -1;
      group.add(right, left, new Mesh(bodyGeometry, bodyMaterial));
      group.scale.setScalar(1.4);
      scene.add(group);
      return { ...b, group, right, left, last: new Vector3(b.cx, b.cy, b.cz) };
    });
    updaters.push((t) => {
      for (const b of flutters) {
        const x = b.cx + Math.sin(t * 0.45 + b.phase) * 1.3;
        const y = b.cy + Math.sin(t * 1.7 + b.phase) * 0.18 + Math.sin(t * 0.6) * 0.2;
        const z = b.cz + Math.sin(t * 0.31 + b.phase * 1.3) * 0.9;
        const dx = x - b.last.x;
        const dz = z - b.last.z;
        if (dx * dx + dz * dz > 1e-6) b.group.rotation.y = Math.atan2(dx, dz);
        b.last.set(x, y, z);
        b.group.position.set(x, y, z);
        const open = 0.2 + (Math.sin(t * 16 + b.phase) * 0.5 + 0.5) * 1.2;
        b.right.rotation.z = open;
        b.left.rotation.z = -open;
      }
    });
  }

  // ---------- Kamera: kompozitsiya va sichqonchaga ergashish ----------
  const baseCamera = new Vector3();
  const baseTarget = new Vector3();
  const pointer = { x: 0, y: 0, active: false };
  const offset = { x: 0, y: 0 };

  let laidOutW = 0;
  let laidOutH = 0;
  const layout = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    laidOutW = w;
    laidOutH = h;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const tanHalf = Math.tan(MathUtils.degToRad(camera.fov / 2));
    // Bino tekisligida kamida ~9.2 birlik balandlik va ~10.5 kenglik ko'rinsin
    const distance = Math.max(9.2 / (2 * tanHalf), 10.5 / (2 * tanHalf * aspect));
    const visibleWidth = 2 * distance * tanHalf * aspect;
    // Keng ekranda o'ng yarmida kirish kartasi turadi — bino chapga suriladi
    const wide = w >= 1024 && aspect > 1.25;
    const shift = wide ? 0.14 * visibleWidth : 0.25;
    baseCamera.set(shift, 3.0, distance);
    baseTarget.set(shift, 2.25, 0);
    camera.updateProjectionMatrix();
  };

  const aim = (t: number, dt: number) => {
    const k = dt > 0 ? 1 - Math.exp(-dt * 2.5) : 1;
    const tx = pointer.active ? pointer.x * 0.55 : Math.sin(t * 0.21) * 0.3;
    const ty = pointer.active ? -pointer.y * 0.25 : Math.sin(t * 0.17) * 0.08;
    offset.x += (tx - offset.x) * k;
    offset.y += (ty - offset.y) * k;
    camera.position.set(baseCamera.x + offset.x, baseCamera.y + offset.y, baseCamera.z);
    camera.lookAt(baseTarget.x + offset.x * 0.35, baseTarget.y + offset.y * 0.3, baseTarget.z);
  };

  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    pointer.active = true;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  // ---------- Kadrlar sikli ----------
  let disposed = false;
  let raf = 0;
  let running = false;
  let inView = true;
  let last = 0;
  let elapsed = 0;
  // Kadr tezligi nazorati: dastlabki kadrlar (shader kompilyatsiyasi)
  // hisobga olinmaydi, keyingi 90 tasi o'rtacha 28 fps dan past bo'lsa —
  // bu qurilmada tekis rasm yaxshiroq.
  let warm = 0;
  let samples = 0;
  let sampleSum = 0;
  let guardDone = options.reducedMotion;

  const step = (t: number, dt: number) => {
    timeUniform.value = t;
    for (const update of updaters) update(t, dt);
    aim(t, dt);
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    // ResizeObserver sahifa chizilmayotganda kechikishi mumkin — arzon tekshiruv
    if (host.clientWidth !== laidOutW || host.clientHeight !== laidOutH) layout();
    const raw = now - last;
    last = now;
    const dt = Math.min(0.05, raw / 1000);
    elapsed += dt;
    step(elapsed, dt);
    renderer.render(scene, camera);
    if (!guardDone) {
      warm++;
      if (warm > 24) {
        samples++;
        sampleSum += Math.min(raw, 200);
        if (samples >= 90) {
          guardDone = true;
          if (sampleSum / samples > 1000 / 28) {
            stop();
            options.onSlow();
          }
        }
      }
    }
  };

  const start = () => {
    if (running || disposed || options.reducedMotion) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const sync = () => {
    if (document.visibilityState === "visible" && inView) start();
    else stop();
  };

  document.addEventListener("visibilitychange", sync);
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? true;
    sync();
  });
  intersection.observe(host);
  const resize = new ResizeObserver(() => {
    layout();
    if (!running) {
      aim(elapsed, 0);
      renderer.render(scene, camera);
    }
  });
  resize.observe(host);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    if (!disposed) options.onSlow();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  layout();
  step(0, 0);

  void (async () => {
    try {
      // Shader'lar asosiy oqimni to'xtatmay tayyorlansin — foydalanuvchi shu
      // paytda parol yozayotgan bo'lishi mumkin
      await renderer.compileAsync(scene, camera);
    } catch {
      // compileAsync bo'lmasa, birinchi render o'zi kompilyatsiya qiladi
    }
    if (disposed) return;
    layout();
    aim(0, 0);
    renderer.render(scene, camera);
    // requestAnimationFrame emas: yashirin varaqda u ishlamaydi
    window.setTimeout(() => {
      if (!disposed) options.onReady();
    }, 0);
    sync();
  })();

  return {
    setName(name) {
      if (disposed) return;
      setName(name);
      if (!running) renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      intersection.disconnect();
      resize.disconnect();

      const geometries = new Set<BufferGeometry>();
      const materialSet = new Set<Material>();
      const textures = new Set<Texture>();
      scene.traverse((object) => {
        const m = object as Mesh;
        if (m.geometry) geometries.add(m.geometry);
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => materialSet.add(x));
        if ((object as InstancedMesh).isInstancedMesh) (object as InstancedMesh).dispose();
      });
      materialSet.forEach((material) => {
        for (const value of Object.values(material)) {
          if (value && typeof value === "object" && (value as Texture).isTexture) textures.add(value as Texture);
        }
        material.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      textures.forEach((texture) => texture.dispose());
      signTexture?.dispose();
      glowTex.dispose();
      discTex.dispose();
      skyMaterial.dispose();
      loose.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
