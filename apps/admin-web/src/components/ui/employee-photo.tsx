"use client";

import clsx from "clsx";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function employeePhotoUrl(employee: { id: string; avatarUpdatedAt: string | null }): string | null {
  if (!employee.avatarUpdatedAt) return null;
  // Vaqt tamg'asi so'rov satrida: surat almashtirilgach brauzer eskisini
  // keshdan ko'rsatib turmasligi kerak.
  return `${API_URL}/app/employees/${employee.id}/avatar?v=${encodeURIComponent(employee.avatarUpdatedAt)}`;
}

/** Xodim surati. Qo'yilmagan bo'lsa — bosh harflardan monogramma. */
export function EmployeePhoto({
  employee,
  size = 40,
  shape = "circle",
  className,
  fallback,
}: {
  employee: { id: string; fullName: string; avatarUpdatedAt: string | null };
  size?: number;
  /** "square" — xodim kartochkalarida ishlatiladi (to'rt burchak, yumaloq emas). */
  shape?: "circle" | "square";
  className?: string;
  fallback: React.ReactNode;
}) {
  const url = employeePhotoUrl(employee);
  const shapeClass = shape === "square" ? "rounded-2xl" : "rounded-full";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan
      <img
        src={url}
        alt={employee.fullName}
        width={size}
        height={size}
        className={clsx("shrink-0 object-cover ring-1 ring-inset ring-[rgba(16,24,40,0.06)]", shapeClass, className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)] ring-1 ring-inset ring-[rgba(16,24,40,0.06)]",
        shapeClass,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {fallback}
    </span>
  );
}
