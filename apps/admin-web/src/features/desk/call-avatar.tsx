"use client";

import { useAuthedImage } from "@/components/ui/child-photo";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/**
 * Qo'ng'iroq qilinayotgan bolaning surati — filial admini Face ID uchun
 * qo'ygan suratning o'zi (`/app/desk/children/:id/photo`, call operatorga
 * ham ochiq). Versiya so'rov satrida: surat almashtirilsa eskisi keshdan
 * ko'rinib turmaydi.
 */
export function deskChildPhotoUrl(childId: string, version: string): string {
  return `${API_URL}/app/desk/children/${childId}/photo?v=${encodeURIComponent(version)}`;
}

/**
 * Qo'ng'iroq qatorining (va oynasining) chap tomoni: bolaning surati bo'lsa —
 * dumaloq surat, burchagida qo'ng'iroq turining kichik belgisi (qarz, kelmagan
 * bola…); surat yo'q bo'lsa yoki ariza bo'lsa — avvalgidek tur plitkasi.
 * Operator kimning bolasi haqida gaplashayotganini yuzidan taniydi.
 */
export function CallAvatar({
  childId,
  photoVersion,
  icon: Icon,
  tint,
  color,
  alt,
  size = 44,
  iconSize = size,
  badge = true,
}: {
  childId: string | null;
  photoVersion: string | null;
  icon: AnyIcon;
  tint: IosTint;
  /** Burchakdagi belgi rangi (tur rangi) */
  color: string;
  alt: string;
  size?: number;
  /** Surat yo'q bo'lganda tur plitkasining o'lchami */
  iconSize?: number;
  badge?: boolean;
}) {
  const url = childId && photoVersion ? deskChildPhotoUrl(childId, photoVersion) : null;
  const { src, failed } = useAuthedImage(url);

  if (!url || failed) return <IosIcon icon={Icon} tint={tint} size={iconSize} />;

  const dot = Math.max(16, Math.round(size * 0.4));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob manzil
        <img src={src} alt={alt} className="h-full w-full rounded-full object-cover ring-1 ring-inset ring-black/[0.06]" />
      ) : (
        <span className="h-full w-full animate-pulse rounded-full bg-[#767680]/[0.12]" aria-hidden="true" />
      )}
      {badge && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full text-white ring-2 ring-white"
          style={{ width: dot, height: dot, background: color }}
          aria-hidden="true"
        >
          <Icon style={{ width: Math.round(dot * 0.58), height: Math.round(dot * 0.58) }} strokeWidth={2.4} />
        </span>
      )}
    </span>
  );
}
