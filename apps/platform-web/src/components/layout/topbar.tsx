"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LogoutIcon } from "@/components/ui/icons";

const ROLE_LABEL: Record<string, string> = {
  PLATFORM_SUPER_ADMIN: "Super Admin",
  PLATFORM_SUPPORT: "Support",
};

// Ism/emaildan bosh harflarni olamiz — avatar rasm o'rniga
function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Topbar() {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    await api.post("/platform/auth/logout");
    router.push("/login");
    router.refresh();
  };

  const displayName = user?.fullName || user?.email || "";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6">
      {/* Yon panel yashiringan ekranlarda brend yuqorida ko'rinib tursin */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--color-primary)] text-xs font-bold text-white">
          B
        </div>
        <span className="text-[14px] font-semibold text-[var(--color-text)]">Platform Admin</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium leading-tight text-[var(--color-text)]">{displayName}</p>
              <p className="text-[11px] leading-tight text-[var(--color-text-muted)]">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[12px] font-semibold text-[var(--color-primary)]"
            >
              {initials(displayName)}
            </span>
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          <LogoutIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Chiqish</span>
        </Button>
      </div>
    </header>
  );
}
