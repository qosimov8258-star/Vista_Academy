"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAppPathname } from "@/lib/tenant-host-context";
import { useAuth, useFeatureEnabled } from "@/lib/use-auth";
import { featureForPath } from "@/lib/feature-routes";
import { Spinner } from "@/components/ios/spinner";
import { useTr } from "@/i18n/tr";

/**
 * Platforma o'chirgan funksiya sahifasiga manzil (yoki eski xatcho'p) bilan
 * kirilsa — sahifa so'rov yuborib qizil xato ko'rsatmasin, o'rniga
 * tushunarli izoh chiqsin. Menyuda bunday sahifalar umuman ko'rinmaydi.
 */
export function FeatureRouteGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const tr = useTr();
  const pathname = useAppPathname();
  const { user, isLoading } = useAuth();
  const isOn = useFeatureEnabled();
  const features = featureForPath(pathname);

  // `me` kelmaguncha sahifa chizilmaydi — aks holda o'chirilgan bo'lim
  // so'rovlari ketib, bir lahzaga ko'rinib qolardi
  if (isLoading) {
    return (
      <div className="flex justify-center pt-24 text-[#8e8e93]">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!user || features.every(isOn)) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center px-6 pt-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#8e8e93]" aria-hidden="true">
        <Lock className="h-7 w-7" strokeWidth={1.9} />
      </span>
      <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">{tr("Bu bo'lim o'chirilgan")}</h1>
      <p className="mt-1.5 text-[14px] leading-snug text-[#8e8e93]">
        {tr("Bu funksiya bog'changiz uchun yoqilmagan. Kerak bo'lsa, platforma operatoriga murojaat qiling.")}
      </p>
      <Link
        href={`/${slug}`}
        className="mt-6 inline-flex h-11 items-center rounded-full bg-[var(--color-primary)] px-6 text-[15px] font-semibold text-white active:opacity-80"
      >
        {tr("Bosh sahifaga")}
      </Link>
    </div>
  );
}
