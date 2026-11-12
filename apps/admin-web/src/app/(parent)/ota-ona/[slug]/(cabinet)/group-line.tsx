"use client";

import clsx from "clsx";
import type { ParentChild } from "@/lib/types";
import { PARENT_API_URL } from "@/lib/parent-api";
import { useTr } from "@/i18n/tr";

/**
 * Bolaning guruhi: guruh rasmi (bog'cha qo'ygan bo'lsa) va nomi bir qatorda.
 * Rasm ota-ona cookie'si bilan o'qiladi — oddiy `<img>` yetarli.
 */
export function GroupLine({ child, size = 22, className }: { child: Pick<ParentChild, "id" | "group">; size?: number; className?: string }) {
  const tr = useTr();
  const group = child.group;
  if (!group) return <span className={clsx("block truncate", className)}>{tr("Guruhsiz")}</span>;
  return (
    <span className={clsx("flex min-w-0 items-center gap-1.5", className)}>
      {group.avatarUpdatedAt && (
        // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil
        <img
          src={`${PARENT_API_URL}/app/parent/children/${child.id}/group-avatar?v=${encodeURIComponent(group.avatarUpdatedAt)}`}
          alt=""
          className="shrink-0 object-cover"
          style={{ width: size, height: size, borderRadius: size * 0.3 }}
        />
      )}
      <span className="truncate">{tr(group.name)}</span>
    </span>
  );
}
