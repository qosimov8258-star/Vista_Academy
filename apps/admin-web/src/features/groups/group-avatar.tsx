"use client";

import { useAuthedImage } from "@/components/ui/child-photo";
import { GroupTile } from "./group-sheets";
import { useTr } from "@/i18n/tr";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function groupAvatarUrl(group: { id: string; avatarUpdatedAt?: string | null }): string | null {
  if (!group.avatarUpdatedAt) return null;
  // Vaqt tamg'asi so'rov satrida: rasm almashtirilgach brauzer eskisini keshdan ko'rsatmasin
  return `${API_URL}/app/groups/${group.id}/avatar?v=${encodeURIComponent(group.avatarUpdatedAt)}`;
}

/**
 * Guruh belgisi: rasm qo'yilgan bo'lsa — rasm (plitka shaklida), aks holda
 * nomining bosh harfli rangli plitkasi. Rasm token bilan o'qiladi
 * (`useAuthedImage`) — yuklanguncha plitka turadi, joy sakramaydi.
 */
export function GroupAvatar({ group, size = 44 }: { group: { id: string; name: string; avatarUpdatedAt?: string | null }; size?: number }) {
  const tr = useTr();
  const { src, failed } = useAuthedImage(groupAvatarUrl(group));
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob manzil
      <img
        src={src}
        alt={tr(group.name)}
        width={size}
        height={size}
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: size * 0.28 }}
      />
    );
  }
  return <GroupTile name={group.name} size={size} />;
}
