"use client";

import clsx from "clsx";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function childPhotoUrl(child: { id: string; avatarUpdatedAt: string | null }): string | null {
  if (!child.avatarUpdatedAt) return null;
  // Vaqt tamg'asi so'rov satrida: surat almashtirilgach brauzer eskisini
  // keshdan ko'rsatib turmasligi kerak.
  return `${API_URL}/app/children/${child.id}/avatar?v=${encodeURIComponent(child.avatarUpdatedAt)}`;
}

/** Bola surati. Qo'yilmagan bo'lsa — jinsiga qarab rangli monogramma. */
export function ChildPhoto({
  child,
  size = 64,
  className,
  fallback,
}: {
  child: { id: string; fullName: string; gender: "MALE" | "FEMALE" | null; avatarUpdatedAt: string | null };
  size?: number;
  className?: string;
  fallback: React.ReactNode;
}) {
  const url = childPhotoUrl(child);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan
      <img
        src={url}
        alt={child.fullName}
        width={size}
        height={size}
        className={clsx("shrink-0 rounded-full object-cover ring-1 ring-inset ring-[rgba(16,24,40,0.06)]", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-[rgba(16,24,40,0.06)]",
        child.gender === "MALE"
          ? "bg-sky-50 text-sky-700"
          : child.gender === "FEMALE"
            ? "bg-rose-50 text-rose-600"
            : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {fallback}
    </span>
  );
}
