import type { ReactNode } from "react";

/**
 * Har bir sahifaning yagona sarlavha bloki — sarlavha, izoh va o'ngdagi
 * asosiy amal. Barcha sahifalarda bir xil balandlik va bo'shliq beradi.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold text-[var(--color-text)]">{title}</h1>
          {description && (
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
