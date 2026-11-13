"use client";

import { useState } from "react";
import clsx from "clsx";
import { assetUrl } from "@/lib/api";

/** Bog'cha logosi manzili — ochiq, `?v=` bilan (logo almashsa kesh yangilanadi). */
export function orgLogoUrl(slug: string, updatedAt: string): string {
  return assetUrl(`/api/v1/app/organizations/by-slug/${encodeURIComponent(slug)}/logo?v=${encodeURIComponent(updatedAt)}`)!;
}

/**
 * Bog'cha logosi yuklangan bo'lsa — rasm (kvadrat ichiga sig'dirilgan),
 * aks holda (yoki rasm ochilmasa) `fallback` — odatda nomning bosh harflari.
 */
export function OrgLogo({
  slug,
  updatedAt,
  fallback,
  className,
}: {
  slug: string;
  updatedAt?: string | null;
  fallback: React.ReactNode;
  className?: string;
}) {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  if (!updatedAt || failedFor === updatedAt) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={orgLogoUrl(slug, updatedAt)}
      alt=""
      draggable={false}
      onError={() => setFailedFor(updatedAt)}
      className={clsx("block select-none object-contain", className)}
    />
  );
}
