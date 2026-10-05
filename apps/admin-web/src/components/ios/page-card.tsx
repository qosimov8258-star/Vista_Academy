import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@/components/ui/icons";
import { PAGE_CARD } from "./tokens";

/** Sahifa kartasi — 32px burchak, ramkasiz */
export function PageCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx(PAGE_CARD, className)}>{children}</div>;
}

/**
 * Sahifa sarlavhasi kartasi: chapda yumaloq brend ikonka, katta sarlavha,
 * ostida soni pill ichida + izoh, o'ngda amallar. Telefonda amallar
 * sarlavha bilan bir qatorda faqat ikonka bo'lib qoladi (IosButton compact).
 */
export function PageHeaderCard({
  icon: Icon,
  title,
  count,
  subtitle,
  actions,
}: {
  icon: ComponentType<IconProps>;
  title: ReactNode;
  count?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    // Telefonda ikki qator: tepada ikonka va amallar, ostida to'liq sarlavha
    // (aks holda 375px da nom "Namang…" bo'lib qoladi). sm dan bitta qator.
    <PageCard className="flex flex-wrap items-center gap-x-3.5 gap-y-3 p-4 sm:flex-nowrap md:gap-x-4 md:p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white md:h-14 md:w-14">
        <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2} />
      </span>
      <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
        {/* data-hero — telefondagi umumiy "yashil chiziqcha" kerak emas: yonida brend ikonka bor */}
        <h1 data-hero className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-text)] md:text-[30px]">{title}</h1>
        {(count !== undefined || subtitle) && (
          <p className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-[#8e8e93]">
            {count !== undefined && (
              <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-[var(--color-primary)]/12 px-2.5 text-[12.5px] font-semibold tabular-nums text-[var(--color-primary)]">
                {count}
              </span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </p>
        )}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">{actions}</div>}
    </PageCard>
  );
}
