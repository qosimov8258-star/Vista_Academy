"use client";

import { createContext, useContext, useEffect, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { IconProps } from "@/components/ui/icons";
import { ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { IosIcon, type IosTint } from "@/features/director/ios-icon";

/**
 * Sozlamalar sahifasining iOS uslubidagi qurilish bloklari: guruhlangan
 * ro'yxat (sarlavha + oq yumaloq karta + izoh), qator va pastdan chiquvchi
 * oyna (kompyuterda — markazda).
 */

/**
 * Tarbiyachi kabinetida ikonkalar rangli "squircle" ichida emas — o'zi tizim
 * rangida chiziladi. Sahifa shu provayder bilan o'rab, qatorlarga aytadi.
 */
const PlainIconsContext = createContext(false);

export function SettingsPlainIcons({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <PlainIconsContext.Provider value={enabled}>{children}</PlainIconsContext.Provider>;
}

export function usePlainSettingsIcons() {
  return useContext(PlainIconsContext);
}

/** Qator ikonkasi: odatda iOS "squircle", tarbiyachida — oddiy rangli belgi. */
export function RowIcon({ icon: Icon, tint = "accent", danger }: { icon: ComponentType<IconProps>; tint?: IosTint; danger?: boolean }) {
  const plain = usePlainSettingsIcons();
  if (plain) {
    return (
      <Icon
        className={clsx("h-[22px] w-[22px] shrink-0", danger ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]")}
        strokeWidth={1.8}
      />
    );
  }
  return <IosIcon icon={Icon} tint={danger ? "red" : tint} size={30} />;
}

export function SettingsGroup({
  title,
  footer,
  action,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {(title || action) && (
        <div className="mb-2 flex items-end justify-between px-4">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{title}</h2>}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-[24px] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]">
        {children}
      </div>
      {footer && <p className="mt-2 px-4 text-[13px] leading-relaxed text-[var(--color-text-muted)]">{footer}</p>}
    </section>
  );
}

/**
 * Bitta qator. `onClick` bo'lsa — bosiladigan (o'ngda strelka), bo'lmasa —
 * faqat ma'lumot. Qatorlar orasidagi chiziq ikonkadan boshlanadi (iOS kabi).
 */
export function SettingsRow({
  icon,
  tint = "accent",
  label,
  value,
  onClick,
  trailing,
  danger,
  first,
  description,
}: {
  icon?: ComponentType<IconProps>;
  tint?: IosTint;
  label: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
  /** Guruhdagi birinchi qator — tepasida ajratkich chizilmaydi */
  first?: boolean;
  description?: ReactNode;
}) {
  const plain = usePlainSettingsIcons();
  const content = (
    <>
      {!first && (
        <span
          className={clsx("absolute right-0 top-0 h-px bg-[var(--color-separator)]", icon ? (plain ? "left-[52px]" : "left-[60px]") : "left-4")}
          aria-hidden="true"
        />
      )}
      {icon && <RowIcon icon={icon} tint={tint} danger={danger} />}
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate text-[15.5px]", danger ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-text)]")}>
          {label}
        </span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-[var(--color-text-muted)]">{description}</span>}
      </span>
      {value != null && (
        <span className="min-w-0 max-w-[55%] truncate text-right text-[15px] text-[var(--color-text-muted)]">{value}</span>
      )}
      {trailing}
      {onClick && !danger && <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c4c4c7]" />}
    </>
  );
  const className = "relative flex min-h-[52px] w-full items-center gap-3.5 px-4 py-2.5 text-left";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        className,
        "cursor-pointer transition-colors active:bg-black/[0.05] md:hover:bg-black/[0.025] focus-visible:bg-black/[0.04] focus-visible:outline-none",
      )}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

/**
 * Tahrirlash oynasi: telefonda pastdan chiqadi (iOS "sheet"), kompyuterda
 * ekran markazida. Esc va fonni bosish bilan yopiladi.
 */
export function SettingsSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-overlay-in absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        className="animate-sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[var(--color-bg)] shadow-[var(--shadow-modal)] md:max-w-[480px] md:rounded-[28px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-black/15 md:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3 md:pt-5">
          <h2 className="text-[19px] font-bold tracking-[-0.015em] text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/[0.06] text-[var(--color-text-muted)] transition-colors hover:bg-black/[0.1] hover:text-[var(--color-text)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
