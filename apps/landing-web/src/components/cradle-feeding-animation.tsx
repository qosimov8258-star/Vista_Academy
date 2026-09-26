"use client";

import styles from "./cradle-feeding-animation.module.css";

/**
 * "Beshikdagi chaqaloqni ovqatlantirish" interaktiv 3D o'yini.
 * To'liq mustaqil sahna public/animatsiya/beshik_vista.html ichida (Three.js) —
 * shu yerda faqat shaffof fonli iframe orqali ko'rsatiladi, shuning uchun
 * sahifaning o'z foni orqa fon sifatida ko'rinib turadi.
 */
export function CradleFeedingAnimation() {
  return (
    <div className={styles.wrapper}>
      <iframe
        src="/animatsiya/beshik_vista.html"
        className={styles.frame}
        title="Beshikdagi chaqaloqni ovqatlantirish o'yini"
        loading="lazy"
      />
    </div>
  );
}
