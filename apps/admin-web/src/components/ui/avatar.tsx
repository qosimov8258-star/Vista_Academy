"use client";

import clsx from "clsx";
import type { TenantAuthenticatedUser } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Ism va familiyaning bosh harflari — rasm qo'yilmagan holat uchun. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Foydalanuvchining profil rasmi. Rasm serverdan alohida manzil orqali
 * keladi; `avatarUpdatedAt` so'rov satriga qo'shiladi, aks holda rasm
 * almashtirilgach brauzer eskisini keshdan ko'rsatib turadi.
 */
export function Avatar({
  user,
  size = 36,
  className,
}: {
  user: Pick<TenantAuthenticatedUser, "fullName" | "avatarUpdatedAt"> | null;
  size?: number;
  className?: string;
}) {
  const label = user?.fullName ?? "";

  if (user?.avatarUpdatedAt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan
      <img
        src={`${API_URL}/app/profile/avatar?v=${encodeURIComponent(user.avatarUpdatedAt)}`}
        alt={label}
        width={size}
        height={size}
        className={clsx("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(label)}
    </span>
  );
}
