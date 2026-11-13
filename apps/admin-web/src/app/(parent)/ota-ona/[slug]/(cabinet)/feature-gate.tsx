"use client";

import Link from "next/link";
import { useAppPathname } from "@/lib/tenant-host-context";
import { useTr } from "@/i18n/tr";
import { CABINET_TABS, tabIndexOf } from "./tabs";
import { useParentFeatures } from "./use-parent-features";

/**
 * Platforma o'chirgan bo'limga to'g'ridan-to'g'ri manzil bilan kirilsa —
 * sahifa so'rov yuborib xato ko'rsatmasin, o'rniga tushunarli izoh chiqsin.
 */
export function ParentFeatureGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const tr = useTr();
  const pathname = useAppPathname();
  const { ready, isOn } = useParentFeatures(slug);
  const base = `/ota-ona/${slug}`;
  const tab = CABINET_TABS[tabIndexOf(pathname, base)];
  const feature = tab && "feature" in tab ? tab.feature : undefined;

  if (!feature) return <>{children}</>;
  if (!ready) return null;
  if (isOn(feature)) return <>{children}</>;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-16 text-center">
      <p className="text-[19px] font-extrabold text-[var(--p-ink)]">{tr("Bu bo'lim hozircha yopiq")}</p>
      <p className="mx-auto mt-2 max-w-[320px] text-[14.5px] leading-relaxed text-[var(--p-muted)]">
        {tr("Bog'changiz bu bo'limni hali yoqmagan.")}
      </p>
      <Link
        href={base}
        className="mt-6 inline-flex rounded-full bg-[var(--p-coral)] px-5 py-2.5 text-[14px] font-bold text-white"
      >
        {tr("Bosh sahifaga")}
      </Link>
    </div>
  );
}
