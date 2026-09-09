"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";


export function Topbar({ slug }: { slug: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleLogout = async () => {
    await api.post("/app/auth/logout");
    // So'rovlar keshi tozalanmasa, xuddi shu brauzerda boshqa foydalanuvchi
    // kirganda oldingi filialning raqamlari bir zum ko'rinib qoladi —
    // kesh kaliti foydalanuvchiga emas, tashkilot slug'iga bog'langan.
    queryClient.clear();
    router.push(`/${slug}/login`);
    router.refresh();
  };

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
      <div>
        {user && <p className="text-sm font-medium text-[var(--color-text)]">{user.organizationName}</p>}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <p className="text-sm font-medium text-[var(--color-text)]">{user.fullName || user.email}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{ROLE_LABEL[user.role]}</p>
            </div>
            <Avatar user={user} size={32} />
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Chiqish
        </Button>
      </div>
    </header>
  );
}
