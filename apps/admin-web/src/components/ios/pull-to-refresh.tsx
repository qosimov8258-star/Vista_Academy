"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "./spinner";

const THRESHOLD = 72;
const MAX = 110;

/**
 * Telefonda pastga tortib yangilash. Sahifa `<main>` ichida aylanadi
 * (MainScroll), shuning uchun tortish shu konteyner tepada turganda
 * ushlanadi. Sichqoncha bilan ishlamaydi — faqat sensorli ekran.
 * Indikator mazmun ustida turadi va sahifani surmaydi.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    const scroller = anchor.current?.closest("main");
    if (!scroller) return;
    let startY: number | null = null;
    let current = 0;
    let running = false;

    const onStart = (event: TouchEvent) => {
      startY = scroller.scrollTop <= 0 && !running ? event.touches[0].clientY : null;
    };
    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        current = 0;
        setPull(0);
        return;
      }
      // Rezina kabi: qancha ko'p tortilsa, shuncha sekin cho'ziladi
      current = Math.min(MAX, delta * 0.5);
      setPull(current);
    };
    const onEnd = () => {
      if (startY === null) return;
      startY = null;
      if (current >= THRESHOLD) {
        running = true;
        setBusy(true);
        setPull(THRESHOLD * 0.75);
        refreshRef.current().finally(() => {
          running = false;
          setBusy(false);
          setPull(0);
        });
      } else {
        setPull(0);
      }
      current = 0;
    };

    scroller.addEventListener("touchstart", onStart, { passive: true });
    scroller.addEventListener("touchmove", onMove, { passive: true });
    scroller.addEventListener("touchend", onEnd);
    scroller.addEventListener("touchcancel", onEnd);
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <div ref={anchor} className="pointer-events-none relative h-0" aria-hidden={!busy}>
      <div
        className="absolute left-1/2 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#8e8e93] shadow-[0_4px_14px_-4px_rgba(0,0,0,0.25)]"
        style={{
          transform: `translate(-50%, ${pull - 44}px)`,
          opacity: busy ? 1 : progress,
          transition: pull === 0 || busy ? "transform 0.3s cubic-bezier(0.32,0.72,0,1), opacity 0.2s" : "none",
        }}
      >
        {busy || progress >= 1 ? (
          <Spinner className="h-5 w-5" label="Yangilanmoqda" />
        ) : (
          <span className="block h-5 w-5" style={{ transform: `rotate(${progress * 270}deg)` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="h-5 w-5">
              <path d="M12 5v12m0 0-5-5m5 5 5-5" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
