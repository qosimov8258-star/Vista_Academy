"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { clearTenantTokens, getTenantRefreshToken } from "@/lib/tenant-session";
import { useAuth } from "@/lib/use-auth";
import { isChef } from "@/lib/permissions";
import { LogoutIcon } from "@/components/ui/icons";

/**
 * Telefonda oshpazning yon menyusi yo'q (o'rnida pastki panel), shuning
 * uchun "Tizimdan chiqish" Profil sahifasining pastida turadi. Chiqish
 * mantig'i yon paneldagi bilan bir xil. Boshqa rollarda va kompyuterda
 * ko'rinmaydi — ular yon paneldan chiqadi.
 */
export function ChefLogoutCard({ slug }: { slug: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  if (!isChef(user?.role)) return null;

  const logout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.post("/app/auth/logout", { refreshToken: getTenantRefreshToken() });
    } finally {
      clearTenantTokens();
      queryClient.clear();
      router.push(`/${slug}/login`);
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-[var(--color-surface)] text-[15px] font-semibold text-[var(--color-danger)] shadow-[var(--shadow-card)] active:bg-[var(--color-danger-bg)] disabled:opacity-60 md:hidden"
    >
      <LogoutIcon className="h-5 w-5" />
      {loading ? "Chiqilmoqda…" : "Tizimdan chiqish"}
    </button>
  );
}
