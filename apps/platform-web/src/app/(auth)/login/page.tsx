import { Suspense } from "react";
import clsx from "clsx";
import { CursorAurora } from "./cursor-aurora";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

/**
 * Platforma kirish sahifasi — butun ekran yorug' aurora (rang bulutlari
 * kursor orqasidan suzadi), o'rtada shisha karta: Zeeron belgisi, yozuvi
 * va forma.
 */
export default function LoginPage() {
  return (
    <div className={clsx(styles.page, "relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10")}>
      <CursorAurora />

      <div className={clsx(styles.rise, styles.card, "relative w-full max-w-[400px] rounded-[30px] px-6 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-9")}>
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zeeron-icon.png" alt="" width={256} height={256} className="h-14 w-14 rounded-[16px] shadow-[0_14px_30px_-12px_rgba(12,12,12,0.5)]" />
          <h1 className="mt-5 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/zeeron-wordmark.png" alt="Zeeron" width={960} height={120} className="h-7 w-auto" />
          </h1>
          <span className="mt-3.5 rounded-full bg-[#0c0c0c]/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0c0c0c]/60">Platforma</span>
          <p className="mt-4 text-[14px] text-[#0c0c0c]/55">Bog&apos;chalarni boshqarish paneliga kirish</p>
        </div>

        <div className={clsx(styles.fields, "mt-7")}>
          <Suspense fallback={null}>
            <LoginForm submitClassName={styles.submit} />
          </Suspense>
        </div>
      </div>

      <p className="relative mt-8 text-center text-[12px] text-[#0c0c0c]/45">© {new Date().getFullYear()} Zeeron</p>
    </div>
  );
}
