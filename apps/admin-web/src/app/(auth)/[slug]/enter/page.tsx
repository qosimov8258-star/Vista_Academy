"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { setTenantAccessOnly } from "@/lib/tenant-session";
import type { TenantAuthenticatedUser } from "@/lib/types";

// Chipta bir martalik: React StrictMode effektni ikki marta ishga tushirsa
// ham so'rov bir marta ketsin (ref komponent qayta yaratilganda yo'qoladi).
let consumedTicket: string | null = null;

/**
 * Platforma operatorining "Bog'chaga kirish" havolasi: `/enter#t=<chipta>`.
 * Chipta fragmentda keladi (serverga va loglarga tushmaydi), darhol
 * manzildan olib tashlanadi va 30 daqiqalik seansga almashtiriladi.
 */
export default function EnterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get("t");
    window.history.replaceState(null, "", window.location.pathname);
    if (!ticket) {
      if (!consumedTicket) setError("Kirish havolasi to'liq emas — platformada \"Bog'chaga kirish\"ni qaytadan bosing");
      return;
    }
    if (consumedTicket === ticket) return;
    consumedTicket = ticket;

    api
      .post<{ user: TenantAuthenticatedUser; accessToken: string }>("/app/auth/enter", { ticket })
      .then(({ accessToken }) => {
        setTenantAccessOnly(accessToken);
        queryClient.clear();
        router.replace(`/${slug}`);
        router.refresh();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Kirib bo'lmadi"));
  }, [queryClient, router, slug]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-[380px] rounded-[20px] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)]">
        {error ? (
          <>
            <p className="text-[15px] font-semibold text-[var(--color-text)]">Kirib bo&apos;lmadi</p>
            <p className="mt-2 text-[13.5px] text-[var(--color-text-muted)]">{error}</p>
            <Link href={`/${slug}/login`} className="mt-4 inline-block text-[13.5px] font-medium text-[var(--color-primary)] hover:underline">
              Kirish sahifasiga
            </Link>
          </>
        ) : (
          <>
            <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            <p className="mt-4 text-[14px] text-[var(--color-text-muted)]">Platforma operatori sifatida kirilmoqda…</p>
          </>
        )}
      </div>
    </div>
  );
}
