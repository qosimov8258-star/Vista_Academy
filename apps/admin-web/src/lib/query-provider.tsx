"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "./api";

let lastRefresh = 0;

/**
 * Platforma funksiyani o'chirgan bo'lsa API `FEATURE_DISABLED` kodli 403
 * qaytaradi — demak qo'limizdagi `me` eskirgan. Xodim va ota-ona `me`
 * keshlari yangilanadi, menyu va to'siqlar darhol yangi holatga o'tadi.
 */
function onApiError(client: () => QueryClient, error: unknown, queryKey?: QueryKey) {
  if (!(error instanceof ApiError) || error.code !== "FEATURE_DISABLED") return;
  // `me` ning o'zi 403 bersa — uni qayta so'rash aylanib qoladi
  if (queryKey?.[0] === "parent-me" || (queryKey?.[0] === "auth" && queryKey[1] === "me")) return;
  // Bir sahifada bir nechta so'rov birdan 403 olsa — bitta yangilash yetarli
  const now = Date.now();
  if (now - lastRefresh < 5_000) return;
  lastRefresh = now;
  const qc = client();
  void qc.invalidateQueries({ queryKey: ["auth", "me"] });
  void qc.invalidateQueries({ queryKey: ["parent-me"] });
}

/** 4xx — so'rovni takrorlash foyda bermaydi (ruxsat yo'q, topilmadi va h.k.) */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError: (error, query) => onApiError(() => qc, error, query.queryKey) }),
      mutationCache: new MutationCache({ onError: (error) => onApiError(() => qc, error) }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: shouldRetry,
          refetchOnWindowFocus: false,
        },
      },
    });
    return qc;
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
