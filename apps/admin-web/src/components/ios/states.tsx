"use client";

import type { ComponentType } from "react";
import type { IconProps } from "@/components/ui/icons";
import { AlertIcon } from "@/components/ui/icons";
import { GROUP_BLOCK, ROW_SEPARATOR } from "./tokens";
import { IosButton } from "./button";
import { useTr } from "@/i18n/tr";

/** Ro'yxat skeleti — haqiqiy qatorlar o'lchamida, sahifa sakramasligi uchun */
export function SkeletonRows({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className={GROUP_BLOCK} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="group/row relative flex min-h-[64px] items-center gap-3 px-4 py-2.5">
          {avatar && <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#767680]/[0.12]" />}
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded-full bg-[#767680]/[0.12]" />
            <span className="block h-3 w-3/5 animate-pulse rounded-full bg-[#767680]/[0.08]" />
          </span>
          <span className={ROW_SEPARATOR} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

/** Bo'sh holat: kulrang doira ichida ikonka + qisqa matn */
export function EmptyState({ icon: Icon, title, hint }: { icon: ComponentType<IconProps>; title: string; hint?: string }) {
  const tr = useTr();
  return (
    <div className={`${GROUP_BLOCK} flex flex-col items-center px-6 py-9 text-center`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#8e8e93]">
        <Icon className="h-7 w-7" strokeWidth={1.9} />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-[var(--color-text)]">{tr(title)}</p>
      {hint && <p className="mt-1 max-w-[280px] text-[13px] text-[#8e8e93]">{tr(hint)}</p>}
    </div>
  );
}

/** Xato holati: qizil doira + "Qayta urinish" */
export function ErrorState({ message, onRetry, retrying }: { message?: string; onRetry: () => void; retrying?: boolean }) {
  const tr = useTr();
  return (
    <div className={`${GROUP_BLOCK} flex flex-col items-center px-6 py-9 text-center`} role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff3b30]/[0.12] text-[#ff3b30]">
        <AlertIcon className="h-7 w-7" strokeWidth={1.9} />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-[var(--color-text)]">{tr("Ma'lumotni yuklab bo'lmadi")}</p>
      {message && <p className="mt-1 max-w-[320px] text-[13px] text-[#8e8e93]">{tr(message)}</p>}
      <IosButton label={tr("Qayta urinish")} onClick={onRetry} loading={retrying} className="mt-4" />
    </div>
  );
}
