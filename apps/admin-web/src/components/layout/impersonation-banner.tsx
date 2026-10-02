"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { clearTenantTokens } from "@/lib/tenant-session";
import { useAuth } from "@/lib/use-auth";

/**
 * Platforma operatori "Bog'chaga kirish" bilan kirgan bo'lsa — panel tepasida
 * doimiy ogohlantirish: kim nomidan ishlayotgani va seansni yopish tugmasi.
 * Boshqa hollarda hech narsa chizmaydi.
 */
export function ImpersonationBanner({ slug }: { slug: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);

  if (!user?.impersonatedBy) return null;

  const leave = async () => {
    setLeaving(true);
    try {
      await api.post("/app/auth/logout", {});
    } finally {
      clearTenantTokens();
      queryClient.clear();
      router.push(`/${slug}/login`);
      router.refresh();
    }
  };

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#1c1c1f] px-4 py-2 text-center text-[13px] text-white"
    >
      <span>
        Platforma operatori <b className="font-semibold">{user.impersonatedBy}</b> —{" "}
        <b className="font-semibold">{user.fullName}</b> nomidan ishlayapsiz. Amallar jurnalga yoziladi, seans 30 daqiqa.
      </span>
      <button
        type="button"
        onClick={leave}
        disabled={leaving}
        className="cursor-pointer rounded-full bg-white/15 px-3 py-0.5 text-[12.5px] font-semibold transition-colors hover:bg-white/25 disabled:opacity-60"
      >
        Seansni yopish
      </button>
    </div>
  );
}
