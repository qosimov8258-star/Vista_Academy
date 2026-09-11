"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { KindergartenScene } from "./kindergarten-scene";
import type { KindergartenSceneHandle } from "./kindergarten-3d";

/**
 * Kirish sahifasining foni: avval tekis SVG sahna, keyin uning ustiga 3D.
 *
 * Tekis sahna server tomonda chiziladi va darhol ko'rinadi. 3D sahna (three.js,
 * ~150 KB) alohida bo'lak sifatida, brauzer bo'sh qolganda yuklanadi va birinchi
 * kadri tayyor bo'lgach silliq paydo bo'ladi. Shu tufayli kirish sahifasi
 * sekinlashmaydi, 3D ishlamasa esa hech narsa buzilmaydi — tekis sahna qoladi:
 * WebGL yo'q, qurilma kuchsiz, trafik tejash yoqilgan yoki kadr tezligi past.
 */

/** Tekis rasm, 3D paydo bo'lmoqda, yoki 3D to'liq ko'rinib turibdi. */
type Stage = "flat" | "revealing" | "live";

const FADE_MS = 700;

/** Qurilma 3D sahnani tortadimi — oldindan, arzon belgilar bo'yicha. */
function canRender3D(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  try {
    const probe = document.createElement("canvas");
    // Dasturiy (GPU'siz) WebGL'ni rad etadi — u yerda 3D sekin bo'ladi
    const attrs = { failIfMajorPerformanceCaveat: true };
    const gl = (probe.getContext("webgl2", attrs) ?? probe.getContext("webgl", attrs)) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function KindergartenBackdrop({
  name,
  focus = "center",
}: {
  name: string | null;
  /** Bino qayerda tursin: karta keng ekranda o'ngda bo'lsa "left". */
  focus?: "left" | "center";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<KindergartenSceneHandle | null>(null);
  const nameRef = useRef(name);
  // Kompozitsiya sahifaga bog'liq va o'zgarmaydi — sahna qurilganda o'qiladi
  const focusRef = useRef(focus);
  const [stage, setStage] = useState<Stage>("flat");

  // Nom keyinroq yuklanadi — 3D lavhani ham yangilaymiz
  useEffect(() => {
    nameRef.current = name;
    handleRef.current?.setName(name);
  }, [name]);

  useEffect(() => {
    if (!canRender3D()) return;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const boot = () => {
      import("./kindergarten-3d")
        .then(({ mountKindergarten3D }) => {
          if (cancelled || !hostRef.current) return;
          handleRef.current = mountKindergarten3D(hostRef.current, {
            name: nameRef.current,
            focus: focusRef.current,
            reducedMotion,
            onReady: () => {
              if (!cancelled) setStage("revealing");
            },
            onSlow: () => {
              if (!cancelled) setStage("flat");
            },
          });
        })
        .catch(() => {
          // 3D ishga tushmadi — tekis sahna o'z joyida qoladi
        });
    };

    const hasIdle = "requestIdleCallback" in window;
    const id = hasIdle ? window.requestIdleCallback(boot, { timeout: 1500 }) : window.setTimeout(boot, 300);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (stage === "revealing") {
      // Paydo bo'lish tugagach tekis sahnani olib tashlaymiz: uning CSS
      // animatsiyalari ko'rinmay turib ham protsessorni band qiladi
      const timer = window.setTimeout(() => setStage("live"), FADE_MS + 150);
      return () => window.clearTimeout(timer);
    }
    if (stage === "flat" && handleRef.current) {
      // Qurilma tortolmadi: 3D so'nib bo'lgach butunlay o'chiriladi
      const timer = window.setTimeout(() => {
        handleRef.current?.dispose();
        handleRef.current = null;
      }, FADE_MS + 150);
      return () => window.clearTimeout(timer);
    }
  }, [stage]);

  return (
    <div className="relative h-full w-full">
      {stage !== "live" && <KindergartenScene name={name} />}
      <div
        ref={hostRef}
        className={clsx(
          "absolute inset-0 transition-opacity ease-out",
          stage === "flat" ? "opacity-0" : "opacity-100",
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}
