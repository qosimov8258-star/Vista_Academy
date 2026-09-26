"use client";

import { useEffect, useRef, useState } from "react";
import type { MinionSceneHandle } from "./minion-3d/scene";
import styles from "./minion-playground.module.css";

type MinionVariant = "bounce" | "slide" | "swing" | "banana";

function MinionFigure({ variant, flip }: { variant: MinionVariant; flip?: boolean }) {
  const hasBanana = variant === "banana";

  return (
    <div className={`${styles.figure} ${flip ? styles.figureFlip : ""}`}>
      <div className={styles.body}>
        <div className={`${styles.leg} ${styles.legL}`}>
          <span className={styles.shoe} />
        </div>
        <div className={`${styles.leg} ${styles.legR}`}>
          <span className={styles.shoe} />
        </div>

        <div className={styles.overalls}>
          <span className={styles.strapL} />
          <span className={styles.strapR} />
          <span className={styles.buttonL} />
          <span className={styles.buttonR} />
          <span className={styles.pocket} />
        </div>

        <div className={`${styles.arm} ${styles.armL}`}>
          <span className={styles.hand} />
        </div>
        <div className={`${styles.arm} ${styles.armR} ${hasBanana ? styles.armRaised : ""}`}>
          <span className={styles.hand} />
          {hasBanana && (
            <span className={styles.banana}>
              <span className={styles.bananaStem} />
            </span>
          )}
        </div>

        <div className={styles.goggle}>
          <span className={styles.eye}>
            <span className={styles.pupil} />
          </span>
          <span className={styles.eye}>
            <span className={styles.pupil} />
          </span>
        </div>
        <div className={styles.mouth} />
        <div className={styles.hair} />
        <div className={styles.hair2} />
        <div className={styles.hair3} />
      </div>
    </div>
  );
}

/** CSS'da chizilgan tekis sahna — 3D yuklanguncha va u ishlamaydigan qurilmalarda */
function FlatPlayground() {
  return (
      <div className={styles.scene}>
        <div className={styles.seesawSet}>
          <div className={styles.seesawFulcrum} />
        </div>

        <div className={styles.swingSet}>
          <div className={styles.swingPoleL} />
          <div className={styles.swingPoleR} />
          <div className={styles.swingFootL} />
          <div className={styles.swingFootR} />
          <div className={styles.swingBar} />
        </div>

        <div className={styles.slideSet}>
          <div className={styles.ladder}>
            <span className={styles.ladderRailL} />
            <span className={styles.ladderRailR} />
            <span className={`${styles.rung} ${styles.rung1}`} />
            <span className={`${styles.rung} ${styles.rung2}`} />
            <span className={`${styles.rung} ${styles.rung3}`} />
            <span className={`${styles.rung} ${styles.rung4}`} />
          </div>
          <div className={styles.platform} />
          <div className={styles.ramp} />
        </div>

        <div className={`${styles.wrap} ${styles.wrapBounce}`}>
          <div className={styles.groundShadow} />
          <div className={styles.localBounce}>
            <span className={styles.seesawPlankGfx} />
            <div className={styles.seesawRiderSlot}>
              <MinionFigure variant="bounce" />
            </div>
          </div>
        </div>

        <div className={`${styles.wrap} ${styles.wrapSlide}`}>
          <div className={styles.groundShadow} />
          <div className={`${styles.local} ${styles.localSlide}`}>
            <MinionFigure variant="slide" />
          </div>
        </div>

        <div className={`${styles.wrap} ${styles.wrapSwing}`}>
          <div className={styles.groundShadow} />
          <div className={`${styles.local} ${styles.localSwing}`}>
            <span className={styles.swingRopeL} />
            <span className={styles.swingRopeR} />
            <span className={styles.swingSeat} />
            <div className={styles.swingRider}>
              <MinionFigure variant="swing" />
            </div>
          </div>
        </div>

        <div className={`${styles.wrap} ${styles.wrapBanana}`}>
          <div className={styles.groundShadow} />
          <MinionFigure variant="banana" flip />
        </div>
      </div>
  );
}

/** Tekis sahna, 3D paydo bo'lmoqda, yoki 3D to'liq ko'rinib turibdi */
type Stage = "flat" | "revealing" | "live";

const FADE_MS = 700;

/** Qurilma 3D sahnani tortadimi — oldindan, arzon belgilar bo'yicha */
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

/**
 * Minionlar o'yin maydonchasi. Avval CSS sahna darhol ko'rinadi; 3D sahna
 * (three.js) brauzer bo'shaganda alohida yuklanadi va birinchi kadri
 * tayyor bo'lgach silliq almashadi. 3D ishlamasa — CSS sahna qoladi.
 */
export function MinionPlayground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MinionSceneHandle | null>(null);
  const [stage, setStage] = useState<Stage>("flat");

  useEffect(() => {
    if (!canRender3D()) return;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const boot = () => {
      import("./minion-3d/scene")
        .then(({ mountMinionPlayground }) => {
          if (cancelled || !hostRef.current) return;
          handleRef.current = mountMinionPlayground(hostRef.current, {
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
          // 3D ishga tushmadi — CSS sahna o'z joyida qoladi
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
      // Paydo bo'lish tugagach CSS sahnani olib tashlaymiz: uning
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
    <div className={styles.stage} aria-hidden="true">
      {stage !== "live" && <FlatPlayground />}
      <div
        ref={hostRef}
        className={styles.webgl}
        style={{ opacity: stage === "flat" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      />
    </div>
  );
}
