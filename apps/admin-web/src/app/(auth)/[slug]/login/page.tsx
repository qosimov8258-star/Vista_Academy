"use client";

import { Suspense, use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { PublicOrganization } from "@/lib/types";
import { KindergartenBackdrop } from "@/components/brand/kindergarten-backdrop";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

/** Kartadagi lavha uchun kichik uycha belgisi */
function HouseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 9.5 10 3.5l7 6" />
      <path d="M5 8.5V17h10V8.5" />
      <path d="M8.5 17v-4.5h3V17" />
    </svg>
  );
}

/**
 * Kirish sahifasi: butun fon — jonli 3D bog'cha hovlisi, o'ng tomonda oq karta.
 * Tor ekranda sahna yuqoridagi dumaloq panelga aylanadi, karta uning ostidan
 * bir oz kirib turadi. Bu sahifa barcha rollar uchun umumiy eshik.
 */
export default function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  // Tizimdagi nom — uy peshtoqida va kartada. Topilmasa slug ko'rsatiladi.
  const orgQuery = useQuery({
    queryKey: ["org-public", slug],
    queryFn: () => api.get<PublicOrganization>(`/app/organizations/by-slug/${encodeURIComponent(slug)}`),
    staleTime: 5 * 60 * 1000,
    // Noma'lum slug (404) uchun qayta urinishning ma'nosi yo'q — darhol zaxira ko'rinishga o'tamiz
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  });
  const orgName = orgQuery.data?.name ?? null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f8ff]">
      <div
        className="absolute inset-x-0 top-0 h-[46vh] min-h-[300px] max-h-[440px] overflow-hidden rounded-b-[28px] lg:inset-0 lg:h-auto lg:min-h-0 lg:max-h-none lg:rounded-none"
        aria-hidden="true"
      >
        <KindergartenBackdrop focus="left" name={orgQuery.isPending ? null : (orgName ?? slug)} />
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
              {/* Uy peshtoqidagi lavhaning kichik nusxasi — tashkilot nomi bilan */}
              {orgQuery.isPending ? (
                <div className="h-8 w-40 animate-pulse rounded-[12px] bg-[var(--color-surface-sunken)]" aria-hidden="true" />
              ) : (
                <div className="inline-flex max-w-full items-center gap-2 rounded-[12px] bg-[#ffe7a3] px-3 py-1.5 shadow-[inset_0_-2px_0_rgba(184,120,0,0.3)]">
                  <HouseGlyph className="h-4 w-4 shrink-0 text-[#9a5b00]" />
                  <span className="truncate text-[13px] font-bold tracking-wide text-[#7c4a03]">{orgName ?? slug}</span>
                </div>
              )}
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
