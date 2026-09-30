"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getTenantAccessToken } from "@/lib/tenant-session";
import { tryRefresh } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function childPhotoUrl(child: { id: string; avatarUpdatedAt: string | null }): string | null {
  if (!child.avatarUpdatedAt) return null;
  // Vaqt tamg'asi so'rov satrida: surat almashtirilgach brauzer eskisini
  // keshdan ko'rsatib turmasligi kerak.
  return `${API_URL}/app/children/${child.id}/avatar?v=${encodeURIComponent(child.avatarUpdatedAt)}`;
}

/**
 * Suratni Authorization headeri bilan o'qib, blob'ga aylantiradi.
 *
 * Endpoint himoyalangan (tenant JWT talab qiladi), oddiy `<img src>` esa
 * hech qanday sarlavha yubora olmaydi — faqat brauzerning umumiy cookie'siga
 * suyanadi, u esa ba'zi brauzerlarda (yoki tokendan keyin cookie yangilanib
 * ulgurmagan holatlarda) yetib bormay, surat sababsiz ko'rinmay qolardi.
 * Shu yerda qolgan butun ilova qanday autentifikatsiya qilinsa, xuddi shu
 * (sessionStorage'dagi) token bilan so'rov yuboriladi — natija ishonchli.
 */
function useAuthedImage(url: string | null): { src: string | null; failed: boolean } {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(null);
    setFailed(false);
    if (!url) return;

    const controller = new AbortController();

    const load = (retryOn401 = true): Promise<void> => {
      const accessToken = getTenantAccessToken();
      return fetch(url, {
        credentials: "include",
        signal: controller.signal,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }).then((res) => {
        // Sahifa ochilganidan keyin access token muddati o'tib ketgan bo'lishi
        // mumkin — oddiy so'rovlar buni `request()` ichida sezmasdan
        // yangilaydi, shu yerda ham xuddi shunday bir marta qayta uriniladi.
        if (res.status === 401 && retryOn401) {
          return tryRefresh().then((refreshed) => {
            if (refreshed && !controller.signal.aborted) return load(false);
            return Promise.reject(new Error("avatar fetch unauthorized"));
          });
        }
        if (!res.ok) return Promise.reject(new Error("avatar fetch failed"));
        return res.blob().then((blob) => setSrc(URL.createObjectURL(blob)));
      });
    };

    load().catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });

    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  return { src, failed };
}

/** Bola surati. Qo'yilmagan (yoki yuklanmagan) bo'lsa — jinsiga qarab rangli monogramma. */
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
  const { src, failed } = useAuthedImage(url);

  if (url && !failed && src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob manzil, Next optimizatsiyasi kerak emas
      <img
        src={src}
        alt={child.fullName}
        width={size}
        height={size}
        className={clsx("shrink-0 rounded-full object-cover ring-1 ring-inset ring-[rgba(16,24,40,0.06)]", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // Surat hali yuklanayotganda ham (url bor, src yo'q) monogramma
  // ko'rsatiladi — bo'sh joy qolib ketmasligi uchun.
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
