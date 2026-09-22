"use client";

import { useEffect, useRef } from "react";
import styles from "./baby-bottle-animation.module.css";

/**
 * "Bolani soska bilan ovqatlantirish" interaktiv o'yini.
 * Asl manba: public/animatsiya/baby_bottle_interactive.html
 * (rasmlar o'sha yerda base64 edi — bu yerda alohida PNG fayllardan o'qiladi).
 */

const IMAGE_SOURCES = {
  baby: "/animatsiya/baby.png",
  bottle: "/animatsiya/bottle.png",
  hl: "/animatsiya/hand-left.png",
  hr: "/animatsiya/hand-right.png",
} as const;

type ImageKey = keyof typeof IMAGE_SOURCES;

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;

// Shishaning tutqich nuqtasi rasm burchagidan qancha ichkarida ekanini bildiradi.
const TIP: [number, number] = [77.85355339059325, 0.7839648751429422];
const HAND_REST: [[number, number], [number, number]] = [
  [248, 605],
  [451, 605],
];
const GRIP: [[number, number], [number, number]] = [
  [-82, 216],
  [82, 216],
];
const SHOULDER: [[number, number], [number, number]] = [
  [250, 470],
  [450, 470],
];
const HOLD: [number, number] = [350, 344];
const HOME: [number, number] = [860, 440];

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function BabyBottleAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const resetButtonEl = resetButtonRef.current;
    if (!canvasEl || !resetButtonEl) return;

    const canvasCtx = canvasEl.getContext("2d");
    if (!canvasCtx) return;

    // Qayta bog'lash — pastdagi ichki funksiyalar (event handlerlar, rAF loop)
    // TypeScript'ning yuqoridagi null-tekshiruvini "yodda saqlamaydi", shuning
    // uchun ular allaqachon null bo'lmasligi aniqlangan o'zgaruvchilarga ishlaydi.
    const canvas = canvasEl;
    const resetButton = resetButtonEl;
    const ctx = canvasCtx;

    let rafId = 0;
    let disposed = false;
    let loaded = 0;

    const images = {} as Record<ImageKey, HTMLImageElement>;

    let tip: [number, number] = [...HOME];
    let dragging = false;
    let offset: [number, number] = [0, 0];
    let anim: { from: [number, number]; to: [number, number]; t: number; dur: number; drink: boolean } | null = null;
    let t0 = 0;
    let drinking = false;
    let openAmount = 0;
    let gripAmount = 0;

    function toCanvasPoint(event: PointerEvent): [number, number] {
      const rect = canvas.getBoundingClientRect();
      return [((event.clientX - rect.left) * canvas.width) / rect.width, ((event.clientY - rect.top) * canvas.height) / rect.height];
    }

    function overBottle(p: [number, number]) {
      const bottle = images.bottle;
      return (
        p[0] > tip[0] - TIP[0] &&
        p[0] < tip[0] - TIP[0] + bottle.width &&
        p[1] > tip[1] - TIP[1] &&
        p[1] < tip[1] - TIP[1] + bottle.height
      );
    }

    function distanceToHold() {
      return Math.hypot(tip[0] - HOLD[0], tip[1] - HOLD[1]);
    }

    function moveTo(dst: [number, number], drink: boolean) {
      anim = { from: [...tip], to: dst, t: performance.now(), dur: drink ? 350 : 450, drink };
    }

    function handlePointerDown(event: PointerEvent) {
      const p = toCanvasPoint(event);
      if (overBottle(p)) {
        dragging = true;
        anim = null;
        drinking = false;
        offset = [tip[0] - p[0], tip[1] - p[1]];
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const p = toCanvasPoint(event);
      if (dragging) {
        tip = [p[0] + offset[0], p[1] + offset[1]];
      } else {
        canvas.style.cursor = overBottle(p) ? "grab" : "default";
      }
    }

    function release() {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "default";
      if (distanceToHold() < 160) moveTo(HOLD, true);
      else moveTo(HOME, false);
    }

    function reset() {
      dragging = false;
      drinking = false;
      anim = null;
      tip = [...HOME];
    }

    function heart(x: number, y: number, s: number, color: string, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        if (i) ctx.lineTo(hx, hy);
        else ctx.moveTo(hx, hy);
      }
      ctx.fill();
      ctx.restore();
    }

    function frame(now: number) {
      if (disposed) return;

      if (anim) {
        const k = Math.min(1, (now - anim.t) / anim.dur);
        const e = ease(k);
        tip = [anim.from[0] + (anim.to[0] - anim.from[0]) * e, anim.from[1] + (anim.to[1] - anim.from[1]) * e];
        if (k >= 1) {
          if (anim.drink) {
            drinking = true;
            t0 = now;
          }
          anim = null;
        }
      }

      const d = distanceToHold();
      const targetOpen = drinking ? 1 : Math.max(0, Math.min(1, (260 - d) / 170));
      const targetGrip = drinking ? 1 : Math.max(0, Math.min(1, (330 - d) / 180));
      openAmount += (targetOpen - openAmount) * 0.2;
      gripAmount += (targetGrip - gripAmount) * 0.2;

      const phase = drinking ? ((now - t0) / 1000) * 2 * Math.PI * 1.3 : 0;
      const dy = drinking ? Math.sin(phase) * 2.5 : 0;

      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.save();
      ctx.translate(0, dy);
      ctx.drawImage(images.baby, 0, 0);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = "#ffa9c8";
      ctx.lineWidth = 5;
      ctx.setLineDash([2, 14]);
      ctx.lineCap = "round";
      ctx.globalAlpha = drinking ? 0.25 : 0.9;
      ctx.beginPath();
      ctx.moveTo(HOME[0], HOME[1]);
      ctx.bezierCurveTo(860, 250, 700, 250, 520, 340);
      ctx.stroke();
      ctx.restore();

      if (openAmount > 0.02) {
        ctx.fillStyle = "#f7d0c3";
        ctx.beginPath();
        ctx.ellipse(350, 368, 50, 30, 0, 0, 7);
        ctx.fill();
        const w = 10 + 14 * openAmount;
        const h = 4 + 15 * openAmount + (drinking ? 3 * Math.abs(Math.sin(phase / 2)) : 0);
        ctx.fillStyle = "#be645a";
        ctx.beginPath();
        ctx.ellipse(350, 364, w, h / 2 + 2, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#964646";
        ctx.beginPath();
        ctx.ellipse(350, 366, w - 4, Math.max(1, h / 2 - 2), 0, 0, 7);
        ctx.fill();
      }

      const bx = tip[0];
      const by = tip[1];
      const bottle = images.bottle;
      // Soska og'izga yaqinlashganda uchining bir qismi rasmdan kesib
      // tashlanadi (soxta rang bilan yopilmaydi) — shu tufayli u og'iz
      // ichiga kirib ketgandek ko'rinadi.
      const maxTipCrop = 34;
      const tipCrop = Math.max(0, Math.min(maxTipCrop, (maxTipCrop * (openAmount - 0.1)) / 0.3));
      ctx.save();
      ctx.translate(bx, by);
      if (drinking) ctx.rotate(Math.sin(phase) * 0.035);
      if (tipCrop > 0.5) {
        ctx.drawImage(
          bottle,
          0,
          tipCrop,
          bottle.width,
          bottle.height - tipCrop,
          -TIP[0],
          -TIP[1] + tipCrop,
          bottle.width,
          bottle.height - tipCrop,
        );
      } else {
        ctx.drawImage(bottle, -TIP[0], -TIP[1]);
      }
      ctx.restore();

      ([
        ["hl", 0],
        ["hr", 1],
      ] as const).forEach(([key, i]) => {
        const rest = HAND_REST[i];
        const grip: [number, number] = [bx + GRIP[i][0], by + GRIP[i][1]];
        const x = rest[0] + (grip[0] - rest[0]) * gripAmount;
        const y = rest[1] + (grip[1] - rest[1]) * gripAmount;
        if (gripAmount > 0.01) {
          ctx.strokeStyle = "#c3d8fa";
          ctx.lineCap = "round";
          ctx.setLineDash([]);
          ctx.lineWidth = 46;
          ctx.beginPath();
          ctx.moveTo(SHOULDER[i][0], SHOULDER[i][1]);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        const hand = images[key];
        ctx.drawImage(hand, x - hand.width / 2, y - hand.height / 2);
      });
      ctx.restore();

      if (drinking) {
        const tt = (now - t0) / 1000;
        for (let i = 0; i < 6; i++) {
          const p = ((tt * 0.45 + i / 6) % 1);
          const side = i % 2 ? 1 : -1;
          const x = 350 + side * (190 + (i % 3) * 22) + Math.sin(p * 6 + i) * 14;
          const y = 330 - p * 230;
          const s = (0.6 + 0.5 * Math.sin(p * Math.PI)) * 1.5;
          heart(x, y + 20, s, ["#ff5c8c", "#ff8caf", "#f03c6e"][i % 3], Math.max(0, Math.min(1, Math.sin(p * Math.PI) * 1.4)));
        }
      }

      rafId = requestAnimationFrame(frame);
    }

    (Object.keys(IMAGE_SOURCES) as ImageKey[]).forEach((key) => {
      const img = new Image();
      img.onload = () => {
        loaded += 1;
        if (loaded === 4 && !disposed) rafId = requestAnimationFrame(frame);
      };
      img.src = IMAGE_SOURCES[key];
      images[key] = img;
    });

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    resetButton.addEventListener("click", reset);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointercancel", release);
      resetButton.removeEventListener("click", reset);
    };
  }, []);

  return (
    <div className={styles.card}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={styles.canvas}
        role="img"
        aria-label="Bolani soska bilan ovqatlantirish o'yini"
      />
      <button ref={resetButtonRef} type="button" className={styles.resetButton}>
        Qayta boshlash
      </button>
    </div>
  );
}
