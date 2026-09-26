/**
 * Minionlar o'yin maydonchasi — 3D sahna (three.js).
 *
 * Faqat dinamik `import()` orqali, brauzerda yuklanadi (minion-playground.tsx):
 * kutubxona og'ir va sahifaning birinchi chizilishini ushlab turmasligi kerak.
 * Fon shaffof — sahifaning oq foni ko'rinadi, yerda faqat soyalar qoladi.
 *
 * Kamera yon tomondan, sal yuqoridan qaraydi; ko'rinadigan balandlik
 * o'zgarmas, kenglik esa ekranga qarab o'zgaradi — jihozlar dims.ts'dagi
 * `computeLayout` bo'yicha joylashadi.
 */
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CHASER, Choreography } from "./choreo";
import { MIN_VISIBLE_WIDTH, computeLayout, clamp } from "./dims";
import { createMaterials } from "./materials";
import { buildBanana, buildPlayground } from "./props";
import { MinionRig, createPose, type MinionSpec } from "./rig";

export interface MinionSceneOptions {
  reducedMotion: boolean;
  onReady(): void;
  onSlow(): void;
}

export interface MinionSceneHandle {
  dispose(): void;
}

/** To'rt minion: har birining bo'yi, ko'zi va sochi boshqacha */
const SPECS: MinionSpec[] = [
  // Arg'imchoqdagi — novcha, ikki ko'zli, sochlari tik
  {
    radius: 0.27,
    length: 0.44,
    eyes: 2,
    seed: 11,
    hair: [
      { yaw: 0, tilt: 0.05, len: 0.1, bend: 0.2 },
      { yaw: 0.9, tilt: 0.3, len: 0.085, bend: -0.3 },
      { yaw: -0.8, tilt: 0.28, len: 0.09, bend: 0.35 },
      { yaw: 2.4, tilt: 0.25, len: 0.08, bend: 0.2 },
      { yaw: -2.2, tilt: 0.22, len: 0.075, bend: -0.25 },
    ],
  },
  // Sirg'anchiqdagi — pakana, bir ko'zli, ikki tola soch
  {
    radius: 0.29,
    length: 0.3,
    eyes: 1,
    seed: 23,
    hair: [
      { yaw: 0.3, tilt: 0.12, len: 0.09, bend: 0.5 },
      { yaw: -0.4, tilt: 0.15, len: 0.08, bend: -0.45 },
    ],
  },
  // Halinchakdagi — o'rta bo'yli, ikki ko'zli, sochi yon tomonga taralgan
  {
    radius: 0.28,
    length: 0.36,
    eyes: 2,
    seed: 37,
    hair: [
      { yaw: 0.2, tilt: 0.35, len: 0.1, bend: 0.9 },
      { yaw: -0.1, tilt: 0.38, len: 0.1, bend: 0.95 },
      { yaw: 0.5, tilt: 0.33, len: 0.095, bend: 0.85 },
    ],
  },
  // Bananli — bir ko'zli, sochlari tikandek
  {
    radius: 0.28,
    length: 0.38,
    eyes: 1,
    seed: 53,
    hair: [0, 0.8, -0.8, 1.6, -1.6, 2.5, -2.5].map((yaw, i) => ({ yaw, tilt: i === 0 ? 0.04 : 0.34, len: 0.085, bend: 0.05 })),
  },
];

const FOV = 20;
/** Ko'rinadigan balandlik (m) — keng ekranlarda */
const VIEW_HEIGHT = 3.3;
/** Jihozlar turgan yer chizig'i kadrning pastidan qancha yuqorida */
const GROUND_FRAC = 0.16;

export function mountMinionPlayground(host: HTMLElement, options: MinionSceneOptions): MinionSceneHandle {
  const narrow = Math.min(window.screen.width, window.screen.height) < 700;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);

  // Metall ko'zoynak va yaltiroq tana atrofni aks ettirsin
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.45;

  const hemi = new HemisphereLight(0xeaf4ff, 0xf2e2c4, 0.6);
  scene.add(hemi);
  const sun = new DirectionalLight(0xfff3e0, 2.4);
  sun.position.set(-3.5, 7, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 512 : 1024);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // Yer ko'rinmaydi — faqat soyasi tushadi (sahifa foni oq)
  const groundGeo = new PlaneGeometry(200, 40);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new ShadowMaterial({ opacity: 0.2 });
  const ground = new Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  const mats = createMaterials();
  const playground = buildPlayground(mats);
  scene.add(playground.group);

  const rigs = SPECS.map((spec) => new MinionRig(spec, mats.rig));
  rigs.forEach((rig) => scene.add(rig.root));
  const poses = SPECS.map(() => createPose());
  const banana = buildBanana(mats);
  // Banan o'rtasidan ushlangan, uchlari tepaga qaragan
  banana.group.position.set(0, -0.04, 0.025);
  banana.group.rotation.set(0, Math.PI / 2, Math.PI);
  rigs[CHASER].rightHand.add(banana.group);

  // Oyoq ostidagi yumshoq soya — sakraganda xiralashadi
  const blobGeo = new PlaneGeometry(0.62, 0.42);
  blobGeo.rotateX(-Math.PI / 2);
  const blobs = rigs.map(() => {
    const mat = new MeshBasicMaterial({ map: mats.blob, transparent: true, depthWrite: false, opacity: 0.5 });
    const mesh = new Mesh(blobGeo, mat);
    mesh.renderOrder = 1;
    scene.add(mesh);
    return mesh;
  });

  // ---------- Joylashuv va kamera ----------
  let choreo = new Choreography(computeLayout(MIN_VISIBLE_WIDTH));
  let layoutW = 0;
  let layoutH = 0;
  let clock = choreo.startTime;

  const layout = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    layoutW = w;
    layoutH = h;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const viewH = Math.max(VIEW_HEIGHT, MIN_VISIBLE_WIDTH / aspect);
    const dist = viewH / (2 * Math.tan((FOV * Math.PI) / 360));
    const cy = viewH / 2 - GROUND_FRAC * viewH;
    camera.aspect = aspect;
    camera.position.set(0, cy + 0.35 * (viewH / VIEW_HEIGHT), dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();

    const L = viewH * aspect;
    const next = computeLayout(L);
    const phase = (clock % choreo.period) / choreo.period;
    choreo = new Choreography(next);
    clock = phase * choreo.period;
    playground.setLayout(next);

    const sc = sun.shadow.camera;
    sc.left = -(L / 2 + 2);
    sc.right = L / 2 + 2;
    sc.top = 4;
    sc.bottom = -3;
    sc.near = 0.5;
    sc.far = 30;
    sc.updateProjectionMatrix();
  };

  const step = (t: number, time: number, dt: number) => {
    choreo.evaluate(t, poses);
    for (let i = 0; i < rigs.length; i++) {
      rigs[i].apply(poses[i], time, dt);
      const p = poses[i];
      const blob = blobs[i];
      blob.visible = p.visible;
      if (p.visible) {
        const hgt = clamp(p.y, 0, 1.5);
        blob.position.set(p.x, 0.003, p.z);
        const s = 1 - (hgt / 1.5) * 0.45;
        blob.scale.set(s, 1, s);
        (blob.material as MeshBasicMaterial).opacity = 0.5 * (1 - clamp(hgt / 1.1, 0, 0.85));
      }
    }
    playground.plank.rotation.z = -choreo.plankAngle(t);
    playground.swing.rotation.z = -choreo.swingAngle(t);
  };

  // ---------- Kadrlar sikli ----------
  let disposed = false;
  let raf = 0;
  let running = false;
  let inView = true;
  let last = 0;
  let elapsed = 0;
  let paused = false;
  // Kadr tezligi nazorati: dastlabki kadrlar (shader kompilyatsiyasi)
  // hisobga olinmaydi, keyingi 90 tasi o'rtacha 28 fps dan past bo'lsa —
  // bu qurilmada oddiy (CSS) versiya yaxshiroq.
  let warm = 0;
  let samples = 0;
  let sampleSum = 0;
  let guardDone = options.reducedMotion;

  const render = (dt: number) => {
    const t = ((clock % choreo.period) + choreo.period) % choreo.period;
    step(t, elapsed, dt);
    renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (host.clientWidth !== layoutW || host.clientHeight !== layoutH) layout();
    const raw = now - last;
    last = now;
    const dt = Math.min(0.05, raw / 1000);
    elapsed += dt;
    if (!paused) clock += dt;
    render(dt);
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
    if (!running) render(0);
  });
  resize.observe(host);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    if (!disposed) options.onSlow();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  // Faqat ishlab chiqishda: vaqtni boshqarib, har bir lahzani tekshirish uchun
  const debug = process.env.NODE_ENV !== "production";
  if (debug) {
    (window as unknown as { __minions?: unknown }).__minions = {
      get period() {
        return choreo.period;
      },
      get time() {
        return ((clock % choreo.period) + choreo.period) % choreo.period;
      },
      seek(t: number) {
        clock = t;
        render(1 / 60);
      },
      pause() {
        paused = true;
      },
      play() {
        paused = false;
      },
      /** Kamerani (x, y) atrofidagi h balandlikdagi hududga yaqinlashtirish; yaw — yon tomondan */
      view(x: number, y: number, h: number, yaw = 0) {
        const dist = h / (2 * Math.tan((FOV * Math.PI) / 360));
        camera.position.set(x + Math.sin(yaw) * dist, y + 0.2, Math.cos(yaw) * dist);
        camera.lookAt(x, y, 0);
        camera.updateProjectionMatrix();
        render(1 / 60);
      },
      reset() {
        layout();
        render(1 / 60);
      },
      get layout() {
        return choreo.lo;
      },
      get timeline() {
        return choreo.timeline();
      },
      /** Sahnani (tekshirish uchun) vaqtincha kattalashtirish — CSS balandligi */
      grow(px: number) {
        host.parentElement?.style.setProperty("height", `${px}px`);
      },
    };
  }

  layout();
  clock = options.reducedMotion ? choreo.staticTime : choreo.startTime;
  // Soch prujinasi va ko'z pirpiratishi birinchi kadrdan tinch tursin
  for (let i = 0; i < 3; i++) render(1 / 60);

  void (async () => {
    try {
      // Shader'lar asosiy oqimni to'xtatmay tayyorlansin
      await renderer.compileAsync(scene, camera);
    } catch {
      // compileAsync bo'lmasa, birinchi render o'zi kompilyatsiya qiladi
    }
    if (disposed) return;
    layout();
    render(0);
    window.setTimeout(() => {
      if (!disposed) options.onReady();
    }, 0);
    sync();
  })();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      intersection.disconnect();
      resize.disconnect();
      if (debug) delete (window as unknown as { __minions?: unknown }).__minions;
      rigs.forEach((rig) => rig.dispose());
      playground.dispose();
      banana.dispose();
      blobs.forEach((b) => (b.material as MeshBasicMaterial).dispose());
      blobGeo.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      mats.dispose();
      envMap.dispose();
      pmrem.dispose();
      room.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
