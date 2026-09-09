"use client";

import clsx from "clsx";
import type { Branch } from "@/lib/types";
import { BuildingIcon } from "./icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function branchAvatarUrl(branch: Pick<Branch, "id" | "avatarUpdatedAt">): string | null {
  if (!branch.avatarUpdatedAt) return null;
  // Vaqt tamg'asi so'rov satrida: belgi almashtirilgach brauzer eskisini
  // keshdan ko'rsatib turmasligi kerak.
  return `${API_URL}/app/organizations/me/branches/${branch.id}/avatar?v=${encodeURIComponent(branch.avatarUpdatedAt)}`;
}

/**
 * Filial belgisi. Rasm qo'yilmagan bo'lsa — bino ikonkasi yoki nomning
 * bosh harfi (`fallback` orqali beriladi).
 */
export function BranchAvatar({
  branch,
  size = 44,
  className,
  fallback,
}: {
  branch: Pick<Branch, "id" | "name" | "avatarUpdatedAt">;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const url = branchAvatarUrl(branch);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan
      <img
        src={url}
        alt={branch.name}
        width={size}
        height={size}
        className={clsx(
          "shrink-0 rounded-[var(--radius-md)] object-cover ring-1 ring-inset ring-[rgba(16,24,40,0.06)]",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {fallback ?? <BuildingIcon style={{ width: size * 0.5, height: size * 0.5 }} />}
    </span>
  );
}
