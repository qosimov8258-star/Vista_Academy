"use client";

import styles from "../parent.module.css";

/**
 * Hali tayyor bo'lmagan bo'lim. Bo'sh ekran o'rniga nima kutilayotganini
 * aytadi — ota-ona bosgan joyi ishlamayapti deb o'ylamasligi kerak.
 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center px-6 pt-[20vh] text-center">
      <div className={styles.float}>
          <svg viewBox="0 0 64 64" className="h-24 w-24" aria-hidden="true">
            <circle cx="32" cy="32" r="26" fill="#ffb703" opacity="0.14" />
            <circle cx="32" cy="32" r="18" fill="#ffc93c" opacity="0.35" />
            <path
              d="M32 19v13l8 5"
              stroke="#b07d00"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="32" cy="32" r="18" stroke="#b07d00" strokeWidth="3" fill="none" opacity="0.5" />
          </svg>
        </div>

        <span className="mt-5 inline-flex items-center rounded-full bg-[var(--p-sun)]/18 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--p-sun-ink)]">
          Tez orada
        </span>
        <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">
          {title}
        </h1>
      <p className="mt-2.5 max-w-[300px] text-[15.5px] leading-relaxed text-[var(--p-muted)]">{description}</p>
    </div>
  );
}
