"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import { markParentEntrySession } from "@/lib/parent-entry";

// Chipta bir martalik: StrictMode effektni ikki marta ishga tushirsa ham so'rov bir marta ketsin
let consumedTicket: string | null = null;

/**
 * «Ota-ona profiliga kirish»: bog'cha panelidan yangi tabda `/ota-ona/{slug}/enter#t=<chipta>`.
 * Chipta fragmentda (serverga va loglarga tushmaydi), darhol manzildan
 * olib tashlanadi va shu ota-onaning oddiy seansiga almashtiriladi.
 */
export default function ParentEnterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get("t");
    window.history.replaceState(null, "", window.location.pathname);
    if (!ticket) {
      if (!consumedTicket) setError("Kirish havolasi to'liq emas — tugmani qaytadan bosing");
      return;
    }
    if (consumedTicket === ticket) return;
    consumedTicket = ticket;

    parentApi
      .post("/app/parent/enter", { ticket })
      .then(() => {
        // Shu tabdagi ko'rishlar ota-onaning faollik statistikasiga yozilmaydi
        markParentEntrySession();
        queryClient.clear();
        router.replace(`/ota-ona/${slug}`);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Kirib bo'lmadi"));
  }, [queryClient, router, slug]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-[380px] rounded-[20px] bg-white p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        {error ? (
          <>
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Kirib bo&apos;lmadi</p>
            <p className="mt-2 text-[13.5px] text-[#8e8e93]">{error}</p>
            <Link href={`/ota-ona/${slug}/kirish`} className="mt-4 inline-block text-[13.5px] font-medium text-[#007aff]">
              Kirish sahifasiga
            </Link>
          </>
        ) : (
          <>
            <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#007aff] border-t-transparent" />
            <p className="mt-4 text-[14px] text-[#8e8e93]">Kabinet ochilmoqda…</p>
          </>
        )}
      </div>
    </div>
  );
}
