import type { ReactNode } from "react";
import { PageShell } from "./page-shell";
import { fetchLanding, assetUrl } from "@/lib/api";
import type { LandingContentBlock } from "@/lib/types";

/**
 * "Doimiy tarbiyachi" va "Ta'lim yo'nalishi" bir xil qolipda: sarlavha,
 * (ixtiyoriy) rasm va matn. Admin hali kontent kiritmagan bo'lsa,
 * `fallback` bosh sahifadagi "Biz haqimizda" bo'limidagi matn bilan bir xil.
 */
export async function ContentBlockView({
  blockKey,
  eyebrow,
  fallbackTitle,
  fallbackBody,
  heroImage,
  afterContent,
}: {
  blockKey: string;
  eyebrow: string;
  fallbackTitle: string;
  fallbackBody: string;
  heroImage?: { src: string; alt: string; position?: string };
  afterContent?: ReactNode;
}) {
  const block = await fetchLanding<LandingContentBlock | null>(`/content-blocks/${blockKey}`, null);
  const title = block?.title ?? fallbackTitle;
  const body = block?.body ?? fallbackBody;

  return (
    <PageShell eyebrow={eyebrow} title={title} heroImage={heroImage} afterContent={afterContent}>
      <div className="mx-auto max-w-[680px] space-y-6 text-center">
        {block?.photoPath && (
          <div className="overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-card)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm */}
            <img src={assetUrl(block.photoPath) ?? undefined} alt={title} className="h-auto w-full object-cover" />
          </div>
        )}
        <p className="whitespace-pre-line text-[16px] leading-relaxed text-[var(--color-text-muted)]">{body}</p>
      </div>
    </PageShell>
  );
}
