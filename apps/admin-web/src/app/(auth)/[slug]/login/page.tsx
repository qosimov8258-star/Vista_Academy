"use client";

import { Suspense, use } from "react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { PublicOrganization } from "@/lib/types";
import { Info } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { LoginForm } from "./login-form";
import { LoginHero, LoginHeroCompact, OrgMark } from "./login-hero";
import styles from "./login.module.css";

/**
 * Bog'cha paneliga kirish — barcha rollar uchun umumiy eshik.
 *
 * Oq, minimalistik: katta ekranda chapda Zeeron aurorasi va logosi, o'ngda
 * forma. Telefonda tepada past aurora tasmasi, ostida darhol forma —
 * aylantirmasdan kirish mumkin.
 *
 * Formaning tepasidagi belgi bog'cha nomidan olinadi: tizimda bir necha
 * bog'cha bor, shuning uchun bu yerda bog'cha nomi qattiq yozilmaydi.
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
    <div className={clsx(styles.page, "relative min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
      <LoginHero orgName={orgName} />

      <div className="absolute right-5 top-5 z-20 lg:right-8 lg:top-7">
        <LanguageSwitcher />
      </div>

      <main className="relative flex min-h-dvh flex-col lg:min-h-0">
        <LoginHeroCompact />

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-5 pt-4 sm:px-8 lg:px-10 lg:py-16">
          {/* Telefonda forma aurora ustidagi oq kartada, kompyuterda — oq fonda kartasiz */}
          <div
            className={clsx(
              styles.rise,
              "w-full max-w-[400px] rounded-[30px] bg-white/80 px-4 py-6 shadow-[0_24px_60px_-28px_rgba(120,40,40,0.35)] backdrop-blur-2xl sm:px-7 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none",
            )}
          >
            <OrgMark name={orgName} />

            <h1 data-hero className="mt-5 text-center sm:mt-7 text-[28px] font-semibold tracking-[-0.03em] text-[#0c0c0c]">{t("title")}</h1>
            <p className="mx-auto mt-2 max-w-[330px] text-center text-[13px] sm:text-[14px] leading-relaxed text-[#8e8e93]">{t("subtitle")}</p>

            <div className="mt-7 sm:mt-9">
              <Suspense fallback={null}>
                <LoginForm slug={slug} inputClassName={styles.input} submitClassName={styles.submit} />
              </Suspense>
            </div>

            <div className={clsx(styles.help, "mt-5 flex items-start gap-3 rounded-[14px] px-4 py-3.5")}>
              <Info className="mt-px h-[18px] w-[18px] shrink-0 text-[#a3143a]" strokeWidth={2} aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-[#3c3c43]/75">{t("forgotPassword")}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
