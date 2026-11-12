"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { InboxMessage } from "@/lib/types";

/**
 * Xodimga rahbariyat yuborgan xabarlar («Xabar yuborish»). Bitta kalit —
 * yon panel, yuqori panel, bosh sahifa va «Xabarlar» sahifasi bitta keshdan
 * o'qiydi, qo'shimcha so'rov ketmaydi.
 */
export function useEmployeeInbox(slug: string, enabled = true) {
  return useQuery({
    queryKey: ["broadcast-inbox", slug],
    queryFn: () => api.get<InboxMessage[]>("/app/broadcasts/inbox"),
    enabled,
    refetchInterval: 60_000,
    // Bildirishnomalar funksiyasi o'chirilgan bog'chada 403 — jim, bo'sh ro'yxat
    retry: false,
  });
}

/** O'qilmagan xabarlar soni (belgi uchun) */
export function useEmployeeInboxUnread(slug: string, enabled = true): number {
  const { data } = useEmployeeInbox(slug, enabled);
  return data?.filter((m) => !m.readAt).length ?? 0;
}
