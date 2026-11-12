"use client";

import clsx from "clsx";
import styles from "./zeeron-wordmark.module.css";

/**
 * Yangi Zeeron yozuvi (apps/admin-web/logo/zeeron-yozuv-oq-fon dan) — har
 * bir harf alohida rasm (public/brand/zeeron-letter-*.png, bir xil
 * balandlikda kesilgan, yonma-yon qo'yilsa asl yozuv chiqadi). Shuning
 * uchun `animated` holatida ikkita "e" navbatma-navbat tebranadi
 * (yuklanish ekrani). O'lchami className orqali (h-…).
 */
const LETTERS = [
  { key: "z", src: "/brand/zeeron-letter-z.png", w: 336 },
  { key: "e1", src: "/brand/zeeron-letter-e.png", w: 338, bob: 0 },
  { key: "e2", src: "/brand/zeeron-letter-e.png", w: 338, bob: 0.45 },
  { key: "r", src: "/brand/zeeron-letter-r.png", w: 264 },
  { key: "o", src: "/brand/zeeron-letter-o.png", w: 338 },
  { key: "n", src: "/brand/zeeron-letter-n.png", w: 314 },
] as const;

const HEIGHT = 240;

export function ZeeronWordmark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <span role="img" aria-label="Zeeron" className={clsx("flex items-stretch", className)}>
      {LETTERS.map((l) => {
        const bob = "bob" in l ? l.bob : undefined;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={l.key}
            src={l.src}
            alt=""
            width={l.w}
            height={HEIGHT}
            draggable={false}
            className={clsx("block h-full w-auto select-none", animated && bob !== undefined && styles.bob)}
            style={animated && bob ? { animationDelay: `${bob}s` } : undefined}
          />
        );
      })}
    </span>
  );
}
