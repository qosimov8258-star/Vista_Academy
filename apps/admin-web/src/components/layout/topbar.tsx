"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ROLE_LABEL = { NETWORK_ADMIN: "Katta admin", BRANCH_ADMIN: "Filial menejeri", MANAGER: "Administrator" } as const;

export function Topbar({ slug }: { slug: string }) {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    await api.post("/app/auth/logout");
    router.push(`/${slug}/login`);
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
      <div>
        {user && <p className="text-sm font-medium text-[var(--color-text)]">{user.organizationName}</p>}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right">
            <p className="text-sm font-medium text-[var(--color-text)]">{user.fullName || user.email}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{ROLE_LABEL[user.role]}</p>
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          Chiqish
        </Button>
      </div>
    </header>
  );
}
