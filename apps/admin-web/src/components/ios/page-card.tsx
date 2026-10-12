import clsx from "clsx";
import type { ReactNode } from "react";
import { PAGE_CARD } from "./tokens";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";

/** Sahifa kartasi — 18px burchak, ramka va soyasiz */
export function PageCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx(PAGE_CARD, className)}>{children}</div>;
}

/**
 * Sahifa sarlavhasi kartasi — Sabot veb panelidagi bilan bir xil: chapda
 * 40px tizim rangidagi plitka (telefonda yashiriladi — joy nomga qoladi),
 * 20px sarlavha, ostida kulrang son kapsulasi va izoh, o'ngda amallar.
 * Telefonda amallar faqat ikonka bo'lib qoladi (IosButton compact).
 */
export function PageHeaderCard({
  icon,
  tint = "accent",
  title,
  count,
  subtitle,
  actions,
}: {
  icon: AnyIcon;
  /** Plitka rangi — sukut bo'yicha tizim rangi */
  tint?: IosTint;
  title: ReactNode;
  count?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageCard className="flex items-center gap-3 px-4 py-4">
      <IosIcon icon={icon} tint={tint} size={40} className="max-sm:hidden" />
      <div className="min-w-0 flex-1">
        {/* data-hero — telefondagi umumiy "yashil chiziqcha" kerak emas */}
        <h1 data-hero className="truncate text-[20px] font-bold leading-tight tracking-[-0.01em] text-[var(--color-text)]">{title}</h1>
        {(count !== undefined || subtitle) && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-[#8e8e93]">
            {count !== undefined && (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-[#767680]/[0.12] px-2 text-[12.5px] font-medium tabular-nums text-[var(--color-text)]">
                {count}
              </span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </PageCard>
  );
}
