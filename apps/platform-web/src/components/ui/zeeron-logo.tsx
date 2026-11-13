"use client";

import clsx from "clsx";
import { ZeeronWordmark } from "@/components/ui/zeeron-wordmark";

/**
 * Zeeron logotipi — yangi yozuv (harflar public/brand/zeeron-letter-*.png).
 * O'lchami className orqali (h-…); `animated` da ikkita "e" tebranadi.
 */
export function ZeeronLogo({ className, animated = false }: { className?: string; animated?: boolean }) {
  return <ZeeronWordmark animated={animated} className={className} />;
}

/**
 * Ixcham belgi — qora yumaloq kvadratda yangi "Z" (yig'ilgan sidebar;
 * xuddi shu rasm src/app/icon.png da brauzer tab belgisi).
 */
export function ZeeronMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/zeeron-icon.png"
      alt="Zeeron"
      width={256}
      height={256}
      draggable={false}
      className={clsx("block select-none", className)}
    />
  );
}
