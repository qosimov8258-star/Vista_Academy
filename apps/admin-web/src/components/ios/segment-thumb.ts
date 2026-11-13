"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/** Segment «tabletkasi» surilish vaqti — ios.module.css `.thumb` bilan bir xil */
export const THUMB_MS = 340;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export interface ThumbBox {
  x: number;
  w: number;
}

/** Boshlang'ich holat: tabletka shu joyda chiziladi va `ms` ichida tanlanganga suriladi */
export interface ThumbStart {
  box: ThumbBox;
  ms: number;
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * iOS segmentining suriladigan oq tabletkasi. Konteyner (`relative`) ichidagi
 * `[data-seg]` bandlarining joyi va kengligi o'lchanadi, tabletka tanlangan
 * band ostiga suriladi — bandlar teng bo'lmasa ham (flex), oraliq bo'lsa ham
 * (gap) to'g'ri tushadi. Sahifa ochilganda tabletka uchib kelmaydi — darhol
 * joyida turadi; `start` berilsa (boshqa sahifadan kelinganda) o'sha joydan
 * suriladi. `active` = -1 (hech biri tanlanmagan) — tabletka ko'rinmaydi.
 */
export function useSegmentThumb<T extends HTMLElement = HTMLDivElement>(active: number, start?: ThumbStart | null) {
  const containerRef = useRef<T>(null);
  const [box, setBox] = useState<ThumbBox | null>(start?.box ?? null);
  const [ms, setMs] = useState(0);
  // O'lcham o'zgarganda (shrift yuklandi, oyna kengaydi) tabletka surilmasdan joyiga o'tadi
  const [snap, setSnap] = useState(false);
  const holdStart = useRef(!!start);
  const activeRef = useRef(active);
  activeRef.current = active;
  const boxRef = useRef(box);
  boxRef.current = box;

  const measure = useCallback((index: number): ThumbBox | null => {
    const item = containerRef.current?.querySelectorAll<HTMLElement>("[data-seg]")[index];
    return item ? { x: item.offsetLeft, w: item.offsetWidth } : null;
  }, []);

  // Tanlov o'zgarsa — yangi joyga (kelish surilishi tugaguncha `start` joyida turadi)
  useLayoutEffect(() => {
    if (active < 0 || holdStart.current) return;
    const next = measure(active);
    if (next) setBox(next);
  }, [active, measure]);

  // Boshqa sahifadan kelindi: tabletka `start` joyida chizilgan (surilishsiz).
  // Brauzer shu joyni hisoblab olishi uchun uslub majburan yangilanadi, keyin
  // darhol qolgan yo'l qolgan vaqtda suriladi — kadr (rAF) kutilmaydi, sahifa
  // band bo'lsa ham tabletka joyida qotib qolmaydi.
  useLayoutEffect(() => {
    if (!holdStart.current || !start) return;
    holdStart.current = false;
    if (reducedMotion()) {
      const next = measure(activeRef.current);
      if (next) setBox(next);
      return;
    }
    void containerRef.current?.offsetWidth;
    setMs(start.ms);
    const next = measure(activeRef.current);
    if (next) setBox(next);
    // Tozalanmaydi: dev rejimidagi qayta o'rnatishda ham odatiy tezlikka qaytsin
    window.setTimeout(() => setMs(THUMB_MS), start.ms);
    // faqat birinchi chizilishda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Oddiy holatda surilish birinchi chizilishdan biroz keyin yoqiladi — sahifa
  // ochilganda (yoki sahifa o'z tanlovini darhol to'g'rilasa) tabletka uchib kelmasin
  useEffect(() => {
    if (start || reducedMotion()) return;
    const timer = window.setTimeout(() => setMs(THUMB_MS), 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!snap) return;
    const timer = window.setTimeout(() => setSnap(false), 60);
    return () => window.clearTimeout(timer);
  }, [snap]);

  // Oyna/shrift o'lchami o'zgarsa — qayta o'lchanadi
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (activeRef.current < 0 || holdStart.current) return;
      const next = measure(activeRef.current);
      const prev = boxRef.current;
      if (!next || (prev && prev.x === next.x && prev.w === next.w)) return;
      setSnap(true);
      setBox(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const thumbStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    width: box?.w ?? 0,
    transform: `translateX(${box?.x ?? 0}px)`,
    opacity: box && active >= 0 ? 1 : 0,
    transition:
      ms > 0 && !snap
        ? `transform ${ms}ms ${EASE}, width ${ms}ms ${EASE}, opacity 150ms ease, background-color 200ms ease`
        : "none",
  };

  return { containerRef, thumbStyle, measure };
}
