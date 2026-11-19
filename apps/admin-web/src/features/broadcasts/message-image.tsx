"use client";

import { useState } from "react";
import clsx from "clsx";
import { ImageOff } from "lucide-react";
import { useAuthedImage } from "@/components/ui/child-photo";
import { PARENT_API_URL } from "@/lib/parent-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Yuboruvchi tarixida — xabar id bo'yicha */
export const broadcastImageUrl = (broadcastId: string) => `${API_URL}/app/broadcasts/${broadcastId}/image`;
/** Xodimga kelgan xabar — inbox qatori id bo'yicha */
export const inboxImageUrl = (recipientId: string) => `${API_URL}/app/broadcasts/inbox/${recipientId}/image`;
/** Ota-onaga kelgan xabar — inbox qatori id bo'yicha */
export const parentMessageImageUrl = (recipientId: string) => `${PARENT_API_URL}/app/parent/messages/${recipientId}/image`;

/**
 * Xabar rasmi — butun rasm ko'rinadi (kesilmaydi), balandligi cheklangan.
 * Xodim panelida (`authed`) rasm token bilan olinadi (`useAuthedImage`);
 * ota-ona kabinetida cookie yetarli — oddiy `<img>`. Yuklanguncha kulrang
 * plitka, xato bo'lsa belgi.
 */
export function MessageImage({ url, alt, authed = true, className }: { url: string; alt: string; authed?: boolean; className?: string }) {
  const fetched = useAuthedImage(authed ? url : null);
  const [broken, setBroken] = useState(false);
  const src = authed ? fetched.src : url;
  const failed = authed ? fetched.failed : broken;
  return (
    <div className={clsx("overflow-hidden rounded-[14px] bg-[#767680]/[0.12]", className)}>
      {failed ? (
        <div className="flex aspect-[4/3] w-full items-center justify-center text-[#8e8e93]">
          <ImageOff className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
        </div>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element -- himoyalangan (blob/cookie) manzil
        <img src={src} alt={alt} onError={authed ? undefined : () => setBroken(true)} className="mx-auto block max-h-[min(420px,45dvh)] w-auto max-w-full object-contain" />
      ) : (
        <div className="aspect-[4/3] w-full animate-pulse" aria-hidden="true" />
      )}
    </div>
  );
}
