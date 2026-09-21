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

export function MinionPlayground() {
  return (
    <div className={styles.stage} aria-hidden="true">
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
    </div>
  );
}
