"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import styles from "./login.module.css";

/**
 * Kursor orqasidan suzuvchi aurora. Uch bulut kursorga har xil "kechikish"
 * bilan ergashadi (yaqini tez, kattasi sekin) — shuning uchun harakat
 * suyuqlikdek cho'ziladi. Kursor 2.5 s qimirlamasa (yoki telefonda)
 * bulutlar o'zi ekran bo'ylab sekin aylanib yuradi; o'tish silliq.
 * Hammasi faqat `transform` bilan — sahifa qayta chizilmaydi.
 */
const FOLLOWERS = [
  { ease: 0.085, cls: styles.follow1 },
  { ease: 0.045, cls: styles.follow2 },
  { ease: 0.024, cls: styles.follow3 },
] as const;

const IDLE_MS = 2500;

export function CursorAurora() {
  const rootRef = useRef<HTMLDivElement>(null);
  const blobRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let w = root.clientWidth;
    let h = root.clientHeight;
    const target = { x: w * 0.5, y: h * 0.42 };
    const pos = FOLLOWERS.map(() => ({ x: target.x, y: target.y }));

    const place = () => {
      blobRefs.current.forEach((blob, i) => {
        if (blob) blob.style.transform = `translate3d(${pos[i].x}px, ${pos[i].y}px, 0) translate(-50%, -50%)`;
      });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place();
      return;
    }

    let lastMove = -Infinity;
    let lastTime = performance.now();
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      target.x = e.clientX - rect.left;
      target.y = e.clientY - rect.top;
      lastMove = performance.now();
    };
    const onResize = () => {
      w = root.clientWidth;
      h = root.clientHeight;
    };

    const tick = (now: number) => {
      // Kadrlar orasidagi vaqtga moslab — 60 va 120 Hz ekranda bir xil tezlik
      const dt = Math.min(now - lastTime, 64) / 16.67;
      lastTime = now;
      if (now - lastMove > IDLE_MS) {
        target.x = w * (0.5 + 0.3 * Math.sin(now / 3800));
        target.y = h * (0.45 + 0.24 * Math.sin(now / 2900 + 1.2));
      }
      pos.forEach((p, i) => {
        const k = 1 - Math.pow(1 - FOLLOWERS[i].ease, dt);
        p.x += (target.x - p.x) * k;
        p.y += (target.y - p.y) * k;
      });
      place();
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.aurora} aria-hidden="true">
      <span className={clsx(styles.ambient, styles.ambient1)} />
      <span className={clsx(styles.ambient, styles.ambient2)} />
      <span className={clsx(styles.ambient, styles.ambient3)} />
      {/* Eng katta va sekini birinchi — kichik tez bulut ustida turadi */}
      {[...FOLLOWERS].reverse().map((f, ri) => {
        const i = FOLLOWERS.length - 1 - ri;
        return (
          <span
            key={i}
            ref={(el) => {
              blobRefs.current[i] = el;
            }}
            className={clsx(styles.follower, f.cls)}
          />
        );
      })}
      <span className={styles.dots} />
      <span className={styles.grain} />
    </div>
  );
}
