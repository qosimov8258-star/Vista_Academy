"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { alternatingDirection, staggerDelay, type RevealDirection } from "./reveal-utils";

export type { RevealDirection };
export { alternatingDirection, staggerDelay };

/**
 * Element ekranga (scroll orqali) kirganda bir marta "sekin joylanish"
 * effektini ishga tushiradigan hook. `ref`ni kerakli elementga bering,
 * `className` va `style`ni shu elementga qo'shing.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(delay = 0) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible, style: { transitionDelay: `${delay}ms` } as CSSProperties };
}

/**
 * Server komponentlar (async fetch qiluvchi) ichida IntersectionObserver
 * kerak bo'lganda shu wrapper ishlatiladi — o'zi client komponent, lekin
 * server tomondan kelgan children'ni o'zgartirmasdan o'rab beradi.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
  style,
  as = "div",
}: {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  /** Elementning turini almashtirish kerak bo'lganda (masalan `<ol>` ichida `<li>`). */
  as?: "div" | "li";
}) {
  const { ref, visible, style: delayStyle } = useReveal<HTMLDivElement & HTMLLIElement>(delay);

  const combinedClassName = [className, "reveal", `reveal-${direction}`, visible ? "reveal-visible" : ""]
    .filter(Boolean)
    .join(" ");
  const combinedStyle = { ...style, ...delayStyle };

  if (as === "li") {
    return (
      <li ref={ref} className={combinedClassName} style={combinedStyle}>
        {children}
      </li>
    );
  }

  return (
    <div ref={ref} className={combinedClassName} style={combinedStyle}>
      {children}
    </div>
  );
}
