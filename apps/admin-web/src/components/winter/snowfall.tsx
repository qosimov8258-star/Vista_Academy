"use client";

import { useEffect, useRef } from "react";

/**
 * Qor yog'ishi — butun panel ustida, hech narsani to'smaydi (bosilmaydi).
 * Ota-ona kabineti va xodimlar paneli birga ishlatadi: qatlam joyi
 * (`className`) va qor qo'nadigan kartalar (`surfaces`) har biriniki.
 *
 * Uch qatlam chuqurlik beradi: uzoqdagi mayda va sekin, o'rtadagi, yaqindagi
 * kattaroq va tezroq zarrachalar; ular orasida bir nechta katta, sekin
 * aylanadigan qor parchasi (olti nurli kristall). Shamol yumshoq tebranadi —
 * qor bir tekis emas, jonli tushadi.
 *
 * Qor jonli:
 *  - barmoq (yoki sichqoncha) tekkan joydan qor parchalari qochadi, bosilganda
 *    atrofga sochiladi;
 *  - telefon silkitilsa — «qor shari»dagidek bo'ron turadi, keyin asta tinadi
 *    (Android; iPhone bunga alohida ruxsat so'raydi — u yerda so'ralmaydi);
 *  - yaqin qatlamdagi parchalar qor qatlamli kartalar ustiga qo'nadi, bir
 *    necha soniyada erib yo'qoladi.
 *
 * Oq fonda ham ko'rinsin deb har parchaning atrofida juda nozik ko'kish soya
 * bor (qorong'ida — yengil nur). Parchalar oldindan bir marta chizilib
 * (sprite), keyin faqat ko'chiriladi — telefonda ham yengil ishlaydi.
 * Soni ekran o'lchamiga qarab; «harakatni kamaytirish» yoqilgan qurilmada
 * qor yog'maydi (qishki fon va qor qatlamlari baribir qoladi).
 */

interface Layer {
  size: [number, number];
  speed: [number, number];
  alpha: number;
  share: number;
}

const LAYERS: Layer[] = [
  { size: [0.9, 1.6], speed: [12, 22], alpha: 0.65, share: 0.5 },
  { size: [1.7, 2.7], speed: [22, 36], alpha: 0.9, share: 0.36 },
  { size: [2.9, 4.2], speed: [34, 50], alpha: 1, share: 0.14 },
];

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  amp: number;
  freq: number;
  phase: number;
  alpha: number;
  crystal: HTMLCanvasElement | null;
  rot: number;
  vr: number;
  /** Turtki (barmoq, bo'ron) tezligi — asta so'nadi */
  ix: number;
  iy: number;
  /** Bo'ronda qo'shilgan parcha — ekrandan chiqsa qaytib tushmaydi */
  extra: boolean;
}

/** Karta ustiga qo'ngan parcha — karta bilan birga suriladi va eriydi */
interface Landed {
  surface: Surface;
  dx: number;
  dy: number;
  r: number;
  alpha: number;
  life: number;
  age: number;
}

interface Surface {
  el: Element;
  top: number;
  left: number;
  right: number;
  /** Ekranda ko'rinadi (qo'ngan qor chiziladi) */
  visible: boolean;
  /** Yangi parcha qo'nishi mumkin */
  ok: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Turtki qanchalik tez so'nadi (1/s) */
const IMPULSE_DAMPING = 2.2;
const PUSH_RADIUS = 80;
const BURST_RADIUS = 120;
const MAX_LANDED = 70;
const MAX_EXTRA = 80;
/** Eriy boshlagandan to yo'qolguncha (s) */
const MELT = 1.2;

/** Yumshoq qirrali dumaloq parcha, atrofida nozik soya/nur */
function makeDot(r: number, dpr: number, dark: boolean): HTMLCanvasElement {
  const halo = r * 2.6;
  const size = Math.ceil(halo * 2 * dpr) + 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const glow = ctx.createRadialGradient(c, c, r * 0.5 * dpr, c, c, halo * dpr);
  glow.addColorStop(0, dark ? "rgba(255,255,255,0.18)" : "rgba(80,116,168,0.3)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  const core = ctx.createRadialGradient(c, c, 0, c, c, r * dpr);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.65, "rgba(255,255,255,0.96)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(c, c, r * dpr, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** Olti nurli qor parchasi (har nurda ikki shoxcha) */
function makeCrystal(radius: number, dpr: number, dark: boolean): HTMLCanvasElement {
  const size = Math.ceil((radius + 3) * 2 * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  ctx.scale(dpr, dpr);
  const arms = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((Math.PI / 3) * i);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -radius);
      for (const at of [0.45, 0.72]) {
        const len = radius * (at === 0.45 ? 0.32 : 0.22);
        ctx.moveTo(0, -radius * at);
        ctx.lineTo(-len * 0.8, -radius * at - len * 0.75);
        ctx.moveTo(0, -radius * at);
        ctx.lineTo(len * 0.8, -radius * at - len * 0.75);
      }
      ctx.stroke();
      ctx.restore();
    }
  };
  // Avval keng xira chiziq (soya/nur), ustidan oq — oq fonda ham ko'rinadi
  arms(2.8, dark ? "rgba(255,255,255,0.16)" : "rgba(80,116,168,0.3)");
  arms(1.15, "rgba(255,255,255,0.95)");
  return canvas;
}

export function Snowfall({
  dark,
  className,
  surfaces: surfaceSelector,
}: {
  dark: boolean;
  /** Qatlam: `position: fixed`, `pointer-events: none`, `[data-on="1"]` da ko'rinadi */
  className: string;
  /** Qor qo'nadigan kartalar — CSS selektor (pastki panel va oynalar baribir chiqariladi) */
  surfaces: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let flakes: Flake[] = [];
    let dotCache = new Map<number, HTMLCanvasElement>();
    let crystals: HTMLCanvasElement[] = [];
    /** Bo'ron kuchi 0..1 — silkitganda ko'tariladi, asta tinadi */
    let storm = 0;
    let lastShake = 0;
    let landed: Landed[] = [];
    let surfaces: Surface[] = [];
    let surfacesAt = -Infinity;
    let rectsDirty = true;

    const dot = (r: number) => {
      const key = Math.round(r * 4) / 4;
      let sprite = dotCache.get(key);
      if (!sprite) {
        sprite = makeDot(key, dpr, dark);
        dotCache.set(key, sprite);
      }
      return sprite;
    };

    const spawn = (anywhere: boolean, crystal = false, extra = false): Flake => {
      const pick = Math.random();
      const layer = pick < LAYERS[0].share ? LAYERS[0] : pick < LAYERS[0].share + LAYERS[1].share ? LAYERS[1] : LAYERS[2];
      const r = crystal ? rand(5, 8) : rand(layer.size[0], layer.size[1]);
      return {
        x: rand(-10, w + 10),
        y: anywhere ? rand(-20, h) : rand(-40, -10),
        r,
        vy: crystal ? rand(18, 28) : rand(layer.speed[0], layer.speed[1]),
        amp: crystal ? rand(10, 18) : rand(6, 16) * (r / 3 + 0.5),
        freq: rand(0.35, 0.9),
        phase: rand(0, Math.PI * 2),
        alpha: crystal ? rand(0.75, 0.95) : layer.alpha * rand(0.85, 1),
        crystal: crystal ? crystals[Math.floor(Math.random() * crystals.length)] : null,
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.35, 0.35),
        ix: 0,
        iy: 0,
        extra,
      };
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      dotCache = new Map();
      crystals = [makeCrystal(5.5, dpr, dark), makeCrystal(6.5, dpr, dark), makeCrystal(7.5, dpr, dark)];
      const count = Math.round(Math.min(120, Math.max(36, (w * h) / 10500)));
      const crystalCount = w < 640 ? 4 : 7;
      flakes = [
        ...Array.from({ length: count }, () => spawn(true)),
        ...Array.from({ length: crystalCount }, () => spawn(true, true)),
      ];
      rectsDirty = true;
    };

    // --- Qo'nish joylari: qor qatlamli kartalar (pastki panel va oynalar emas) ---
    const collectSurfaces = (now: number) => {
      surfacesAt = now;
      const found = document.querySelectorAll(surfaceSelector);
      const next: Surface[] = [];
      found.forEach((el) => {
        if (el.closest('nav, [role="dialog"]')) return;
        const old = surfaces.find((s) => s.el === el);
        next.push(old ?? { el, top: 0, left: 0, right: 0, visible: false, ok: false });
      });
      surfaces = next;
      rectsDirty = true;
    };

    const measureSurfaces = () => {
      rectsDirty = false;
      for (const s of surfaces) {
        const rect = s.el.getBoundingClientRect();
        s.top = rect.top;
        s.left = rect.left;
        s.right = rect.right;
        s.visible = s.el.isConnected && rect.width > 0 && rect.top > -20 && rect.top < h + 20;
        // Qo'nish — faqat ekranda ko'rinadigan va pastki panelga yaqin bo'lmagan kartalarga
        s.ok = s.visible && rect.width > 24 && rect.top > 8 && rect.top < h - 140;
      }
    };

    const tryLand = (f: Flake, prevY: number) => {
      if (f.crystal || f.r < 1.7 || storm > 0.15 || landed.length >= MAX_LANDED || f.x < 0 || f.x > w) return;
      for (const s of surfaces) {
        if (!s.ok) continue;
        const y = s.top - 3;
        if (prevY >= y || f.y < y) continue;
        const inset = Math.min(12, (s.right - s.left) * 0.2);
        if (f.x < s.left + inset || f.x > s.right - inset) continue;
        // Har parcha emas — ba'zilari qo'nadi, qolgani o'tib ketadi
        if (Math.random() > (f.r > 2.9 ? 0.8 : 0.5)) return;
        landed.push({
          surface: s,
          dx: f.x - s.left,
          dy: -3 + rand(-1.2, 1),
          r: f.r * 0.9,
          alpha: f.alpha,
          life: rand(3, 6),
          age: 0,
        });
        // Qo'ngan parcha o'rniga tepadan yangisi tushadi
        Object.assign(f, spawn(false, false, f.extra));
        return;
      }
    };

    // --- Barmoq / sichqoncha: yaqin parchalar qochadi, bosilganda sochiladi ---
    let px = 0;
    let py = 0;
    let pt = 0;
    const push = (x: number, y: number, radius: number, force: number, vx: number, vy: number) => {
      const r2 = radius * radius;
      for (const f of flakes) {
        const dx = f.x - x;
        const dy = f.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        const d = Math.sqrt(d2) || 1;
        const k = 1 - d / radius;
        f.ix = clamp(f.ix + (dx / d) * force * k + vx * 0.22 * k, -420, 420);
        f.iy = clamp(f.iy + (dy / d) * force * k + vy * 0.22 * k, -420, 420);
        if (f.crystal) f.vr = clamp(f.vr + (Math.random() - 0.5) * 4 * k, -3, 3);
      }
    };
    const move = (x: number, y: number) => {
      const now = performance.now();
      const dt = Math.max(0.008, (now - pt) / 1000);
      const vx = pt && now - pt < 120 ? clamp((x - px) / dt, -1500, 1500) : 0;
      const vy = pt && now - pt < 120 ? clamp((y - py) / dt, -1500, 1500) : 0;
      px = x;
      py = y;
      pt = now;
      push(x, y, PUSH_RADIUS, 130, vx, vy);
    };
    const burst = (x: number, y: number) => {
      px = x;
      py = y;
      pt = performance.now();
      push(x, y, BURST_RADIUS, 320, 0, 0);
    };
    // Sichqoncha/qalam — pointer; barmoq — touch (sahifa surilayotganda ham ishlaydi)
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") move(e.clientX, e.clientY);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") burst(e.clientX, e.clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) burst(touch.clientX, touch.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) move(touch.clientX, touch.clientY);
    };

    // --- Silkitish: qor shari kabi bo'ron ---
    const shake = (power: number) => {
      const now = performance.now();
      if (now - lastShake < 500) return;
      lastShake = now;
      storm = Math.min(1, storm + 0.35 + power * 0.4);
      for (const f of flakes) {
        f.ix = clamp(f.ix + rand(-1, 1) * 240 * storm, -420, 420);
        f.iy = clamp(f.iy + rand(-300, 40) * storm, -420, 420);
        if (f.crystal) f.vr = rand(-3, 3);
      }
      const extras = flakes.filter((f) => f.extra).length;
      for (let i = extras; i < MAX_EXTRA * storm; i++) {
        const f = spawn(true, Math.random() < 0.06, true);
        f.ix = rand(-200, 200);
        f.iy = rand(-260, 0);
        flakes.push(f);
      }
      // Qo'ngan qor ham silkinib to'kiladi
      landed = [];
    };
    const hasMotionPermissionGate =
      typeof DeviceMotionEvent !== "undefined" &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      let mag = 0;
      if (a && a.x != null && a.y != null && a.z != null) {
        mag = Math.hypot(a.x, a.y, a.z);
      } else {
        const g = e.accelerationIncludingGravity;
        if (!g || g.x == null || g.y == null || g.z == null) return;
        mag = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
      }
      if (mag > 14) shake(clamp((mag - 14) / 16, 0, 1));
    };

    const onScroll = () => {
      rectsDirty = true;
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const t = now / 1000;
      // Shamol: ikki sekin to'lqin — qor goh o'ngga, goh chapga og'adi; bo'ronda kuchayadi
      const wind = Math.sin(t * 0.09) * 7 + Math.sin(t * 0.023 + 1.3) * 5 + storm * 46 * Math.sin(t * 1.3);
      const damping = Math.exp(-IMPULSE_DAMPING * dt);
      storm = storm > 0.01 ? storm * Math.exp(-0.55 * dt) : 0;

      if (now - surfacesAt > 1000) collectSurfaces(now);
      if (rectsDirty) measureSurfaces();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        const prevY = f.y;
        f.y += (f.vy * (1 + storm * 0.6) + f.iy) * dt;
        f.x += (Math.sin(t * f.freq + f.phase) * f.amp * 0.6 + wind * (0.35 + f.r * 0.15) + f.ix) * dt;
        f.ix *= damping;
        f.iy *= damping;
        if (f.y - 14 > h) {
          if (f.extra) {
            flakes.splice(i, 1);
            i--;
          } else {
            flakes[i] = spawn(false, !!f.crystal);
          }
          continue;
        }
        if (f.x < -14) f.x += w + 28;
        else if (f.x > w + 14) f.x -= w + 28;
        tryLand(f, prevY);

        ctx.globalAlpha = f.alpha;
        if (f.crystal) {
          f.rot += f.vr * dt;
          f.vr += (Math.sign(f.vr) * 0.3 - f.vr) * Math.min(1, dt * 0.8);
          const s = f.crystal;
          ctx.setTransform(dpr, 0, 0, dpr, f.x * dpr, f.y * dpr);
          ctx.rotate(f.rot);
          ctx.drawImage(s, -s.width / dpr / 2, -s.height / dpr / 2, s.width / dpr, s.height / dpr);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else {
          const s = dot(f.r);
          ctx.drawImage(s, f.x * dpr - s.width / 2, f.y * dpr - s.height / 2);
        }
      }

      // Qo'ngan qor: karta bilan birga turadi, oxirgi soniyada kichrayib eriydi
      for (let i = landed.length - 1; i >= 0; i--) {
        const l = landed[i];
        l.age += dt;
        if (l.age >= l.life || !l.surface.visible) {
          landed.splice(i, 1);
          continue;
        }
        const left = l.life - l.age;
        const melt = left < MELT ? left / MELT : 1;
        const s = dot(l.r);
        const scale = 0.55 + 0.45 * melt;
        const size = (s.width / dpr) * scale;
        const x = l.surface.left + l.dx;
        const y = l.surface.top + l.dy;
        ctx.globalAlpha = l.alpha * melt;
        ctx.drawImage(s, (x - size / 2) * dpr, (y - size / 2) * dpr, size * dpr, size * dpr);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    const motion = typeof DeviceMotionEvent !== "undefined" && !hasMotionPermissionGate;
    if (motion) window.addEventListener("devicemotion", onMotion);
    raf = requestAnimationFrame(tick);
    // Kabinetga kirganda qor asta paydo bo'ladi
    canvas.dataset.on = "1";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      if (motion) window.removeEventListener("devicemotion", onMotion);
    };
  }, [dark, surfaceSelector]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
