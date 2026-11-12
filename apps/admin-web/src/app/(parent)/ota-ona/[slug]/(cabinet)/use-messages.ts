"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parentApi } from "@/lib/parent-api";
import type { InboxMessage } from "@/lib/types";

/** Bog'cha yuborgan xabarlar — bosh sahifa, «Xabarlar» va majburiy oyna bitta keshdan o'qiydi */
export function useParentMessages(slug: string) {
  return useQuery({
    queryKey: ["parent-messages", slug],
    queryFn: () => parentApi.get<InboxMessage[]>("/app/parent/messages"),
    retry: false,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkParentMessageRead(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => parentApi.patch(`/app/parent/messages/${id}/read`, {}),
    onSuccess: (_res, id) =>
      queryClient.setQueryData<InboxMessage[]>(["parent-messages", slug], (list) =>
        list?.map((m) => (m.id === id ? { ...m, readAt: new Date().toISOString() } : m)),
      ),
  });
}
