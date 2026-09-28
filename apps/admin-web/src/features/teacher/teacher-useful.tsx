"use client";

import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import type { Group as GroupModel } from "@/lib/types";
import type { IconProps } from "@/components/ui/icons";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { EmptyRow, Group, LargeTitle, Segmented, SkeletonRows, TeacherPage } from "./teacher-ui";
import styles from "./teacher.module.css";

export interface UsefulItem {
  id: string;
  title: string;
  /** Ikkinchi qator (masalan maqolning ma'nosi) */
  detail?: string | null;
  meta: string;
  published: boolean;
  canEdit: boolean;
}

/**
 * "Foydali" bo'limi (she'rlar, maqollar, ertaklar) — tarbiyachi uchun iOS
 * ro'yxati. Uchala sahifa ham shu qobiqni ishlatadi; modal va o'chirish
 * oynasi har sahifaning o'zida qoladi.
 */
export function TeacherUsefulList({
  base,
  icon: Icon,
  noun,
  items,
  loading,
  error,
  canWrite,
  groups,
  groupFilter,
  onGroupFilter,
  onAdd,
  onEdit,
  onDelete,
  children,
}: {
  base: string;
  icon: ComponentType<IconProps>;
  /** "she'r", "maqol", "ertak" */
  noun: string;
  items: UsefulItem[];
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  groups: GroupModel[];
  groupFilter: string;
  onGroupFilter: (id: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Sahifaning modal va tasdiqlash oynalari */
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = [
    { value: `${base}/useful/poems`, label: "She'rlar" },
    { value: `${base}/useful/proverbs`, label: "Maqollar" },
    { value: `${base}/useful/tales`, label: "Ertaklar" },
  ];
  const current = tabs.find((t) => pathname.startsWith(t.value))?.value ?? tabs[0].value;

  return (
    <TeacherPage>
      <LargeTitle
        title="Foydali"
        subtitle="Ota-ona kabinetida ham ko'rinadi"
        trailing={
          canWrite ? (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Yangi ${noun} qo'shish`}
              className={clsx(styles.cta, "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-[var(--shadow-primary)]")}
            >
              <PlusIcon className="h-5 w-5" strokeWidth={2.4} />
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <Segmented label="Bo'lim" value={current} onChange={(href) => router.push(href)} options={tabs} />
        {groups.length > 1 && (
          <label className="flex items-center justify-between gap-3 px-2 text-[15px]">
            <span className="text-[var(--color-text-muted)]">Guruh</span>
            <select
              value={groupFilter}
              onChange={(e) => onGroupFilter(e.target.value)}
              className="cursor-pointer appearance-none bg-transparent text-right font-medium text-[var(--color-primary)] outline-none"
            >
              <option value="">Barchasi</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Group>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <EmptyRow title="Yuklab bo'lmadi" description={error} />
        ) : items.length === 0 ? (
          <EmptyRow icon={Icon} title={`Hali ${noun} yo'q`} description={canWrite ? `Yuqoridagi «+» orqali birinchi ${noun}ni qo'shing` : undefined} />
        ) : (
          items.map((item, i) => (
            <div key={item.id} className="relative flex items-center">
              {i > 0 && <span className="absolute left-[52px] right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
              <button
                type="button"
                disabled={!item.canEdit}
                onClick={() => onEdit(item.id)}
                className={clsx("flex min-w-0 flex-1 items-start gap-3.5 py-3 pl-4 pr-2 text-left", item.canEdit && clsx(styles.pressable, "cursor-pointer"))}
              >
                <Icon className="mt-px h-[22px] w-[22px] shrink-0 text-[var(--color-primary)]" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[16px] leading-snug text-[var(--color-text)]">{item.title}</span>
                  {item.detail && <span className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-[var(--color-text)]/75">{item.detail}</span>}
                  <span className="mt-1 block truncate text-[13px] text-[var(--color-text-muted)]">
                    {!item.published && <span className="font-semibold text-[var(--color-warning)]">Qoralama · </span>}
                    {item.meta}
                  </span>
                </span>
              </button>
              {item.canEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label={`${item.title} — o'chirish`}
                  className="mr-2.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors active:bg-black/5 active:text-[var(--color-danger)]"
                >
                  <TrashIcon className="h-[19px] w-[19px]" />
                </button>
              )}
            </div>
          ))
        )}
      </Group>
      {children}
    </TeacherPage>
  );
}
