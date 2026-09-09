"use client";

import { Suspense, use } from "react";
import { KindergartenScene } from "@/components/brand/kindergarten-scene";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

/**
 * Kirish sahifasi: butun fon — jonli bog'cha hovlisi, o'ng tomonda oq karta.
 * Tor ekranda sahna yuqoridagi dumaloq panelga aylanadi, karta uning ostidan
 * bir oz kirib turadi. Bu sahifa barcha rollar uchun umumiy eshik.
 */
export default function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f8ff]">
      <div
        className="absolute inset-x-0 top-0 h-[46vh] min-h-[300px] max-h-[440px] overflow-hidden rounded-b-[28px] lg:inset-0 lg:h-auto lg:min-h-0 lg:max-h-none lg:rounded-none"
        aria-hidden="true"
      >
        <KindergartenScene />
      </div>

      <div className={`${styles.brand} absolute right-4 top-4 z-20 flex items-center gap-2.5 lg:left-8 lg:right-auto lg:top-7`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--color-primary)] text-base font-bold text-white shadow-[0_2px_6px_rgba(15,118,110,0.35)]">
          B
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[var(--color-text)]">Bog&apos;chalar tarmog&apos;i</p>
          <p className="text-[11px] font-medium text-[var(--color-text-muted)]">Boshqaruv paneli</p>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col justify-start px-4 pb-10 pt-[calc(46vh-44px)] lg:grid lg:grid-cols-2 lg:items-center lg:justify-items-center lg:px-8 lg:pb-0 lg:pt-0">
        <div className={`${styles.card} w-full max-w-[420px] lg:col-start-2`}>
          <div className="rounded-[24px] bg-white p-7 shadow-[0_24px_60px_-20px_rgba(15,60,90,0.35),0_2px_6px_rgba(15,60,90,0.08)] sm:p-8">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />/{slug}
              </span>
              <h1 className="mt-3 text-[26px] font-bold tracking-tight text-[var(--color-text)]">Xush kelibsiz!</h1>
              <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                Boshqaruv paneliga kirish uchun ma&apos;lumotlaringizni kiriting.
              </p>
            </div>

            <Suspense fallback={null}>
              <LoginForm slug={slug} />
            </Suspense>

            <p className="mt-6 border-t border-[var(--color-separator)] pt-4 text-center text-xs text-[var(--color-text-muted)]">
              Parolni unutdingizmi? Tashkilot Super Admini bilan bog&apos;laning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
