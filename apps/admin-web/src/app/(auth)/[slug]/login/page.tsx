"use client";

import { Suspense, use } from "react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { PublicOrganization } from "@/lib/types";
import { InfoIcon } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { LoginForm } from "./login-form";
import { LoginHero, OrgBrand } from "./login-hero";
import styles from "./login.module.css";

/**
 * Bog'cha paneliga kirish — barcha rollar uchun umumiy eshik.
 *
 * Katta ekranda ikki yarim: chapda tizim haqida qisqacha, o'ngda kirish
 * kartasi. Telefonda chap yarim yashirinadi — tepada bog'cha nomi, darhol
 * ostida karta, aylantirmasdan kirish mumkin.
 *
 * Bog'cha belgisi uning nomidan olinadi: tizimda bir necha bog'cha bor,
 * shuning uchun bu yerda hech qanday nom yoki logo qattiq yozilmaydi.
 */
export default function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useTranslations("login");
  const orgQuery = useQuery({
    queryKey: ["org-public", slug],
    queryFn: () => api.get<PublicOrganization>(`/app/organizations/by-slug/${encodeURIComponent(slug)}`),
    staleTime: 5 * 60 * 1000,
    // Noma'lum slug (404) uchun qayta urinishning ma'nosi yo'q — darhol zaxira ko'rinishga o'tamiz
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  });
  // Yuklanayotganda null (joy egallovchi), topilmasa — slug
  const orgName = orgQuery.isPending ? null : (orgQuery.data?.name ?? slug);

  return (
    <div className={clsx(styles.page, "min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]")}>
      {/* Server javob berdi — tizim ishlayapti. Bu belgi bezak emas, haqiqiy holat. */}
      <LoginHero orgName={orgName} online={orgQuery.isSuccess} />

      <main className={clsx(styles.stage, "relative flex min-h-dvh flex-col overflow-hidden")}>
        <div className={clsx(styles.rings, "hidden lg:block")} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {/* Telefonda ham yumshoq nur — sahifa bo'm-bo'sh ko'rinmasin */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(420px_320px_at_20%_0%,color-mix(in_srgb,var(--accent-bright)_22%,transparent),transparent_70%)] lg:hidden"
          aria-hidden="true"
        />

        <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-5 lg:justify-end lg:px-10 lg:pt-8">
          <div className="min-w-0 lg:hidden">
            <OrgBrand name={orgName} compact />
          </div>
          <LanguageSwitcher appearance="onDark" />
        </header>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 pb-8 pt-8 sm:px-8 lg:items-center lg:px-10 lg:pb-16 lg:pt-4">
          {/* Telefonda qisqa sarlavha — chap yarimning o'rnini bosadi */}
          <p className={clsx(styles.rise, "mb-7 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[36px] lg:hidden")}>
            {t("hero.titleLine1")} <span className={styles.accentText}>{t("hero.titleLine2")}</span>
          </p>

          <div className={clsx(styles.card, styles.cardEnter, "w-full rounded-[28px] p-6 sm:p-9 lg:max-w-[440px]")}>
            <h1 className="text-[26px] font-bold tracking-[-0.025em] text-white">{t("title")}</h1>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--accent-pale)]/55">{t("subtitle")}</p>

            <div className={clsx(styles.fields, "mt-7")}>
              <Suspense fallback={null}>
                <LoginForm slug={slug} submitClassName={styles.submit} />
              </Suspense>
            </div>

            <div className={clsx(styles.help, "mt-6 flex items-start gap-3 rounded-[16px] px-4 py-3.5")}>
              <InfoIcon className="mt-px h-[18px] w-[18px] shrink-0 text-[var(--accent-light)]/70" />
              <p className="text-[13px] leading-relaxed text-[var(--accent-pale)]/55">{t("forgotPassword")}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
