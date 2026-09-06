"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Organization, TenantUser } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { CreateTenantUserModal } from "@/features/users/create-tenant-user-modal";

const ROLE_LABEL: Record<TenantUser["role"], string> = {
  NETWORK_ADMIN: "Tarmoq admin",
  BRANCH_ADMIN: "Filial menejeri",
  MANAGER: "Administrator",
};

export default function UsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);
  const { user: currentUser } = useAuth();

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const usersQuery = useQuery({
    queryKey: ["tenant-users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
  });

  const canCreate = currentUser?.role === "NETWORK_ADMIN" || currentUser?.role === "BRANCH_ADMIN";
  const createLabel = currentUser?.role === "NETWORK_ADMIN" ? "+ Filial menejeri" : "+ Administrator";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Foydalanuvchilar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {currentUser?.role === "NETWORK_ADMIN"
              ? "Filial menejerlari va administratorlar"
              : "O'z filialingiz administratorlari"}
          </p>
        </div>
        {canCreate && <Button onClick={() => setCreateOpen(true)}>{createLabel}</Button>}
      </div>

      {usersQuery.isLoading ? (
        <LoadingState />
      ) : usersQuery.isError ? (
        <ErrorState message={(usersQuery.error as Error).message} />
      ) : !usersQuery.data || usersQuery.data.length === 0 ? (
        <EmptyState title="Foydalanuvchi topilmadi" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">To'liq ism</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Rol</th>
                  <th className="px-5 py-3 font-medium">Filial</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium">Yaratilgan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {usersQuery.data.map((tenantUser) => (
                  <tr key={tenantUser.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-[var(--color-text)]">{tenantUser.fullName}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{tenantUser.email}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{ROLE_LABEL[tenantUser.role]}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{tenantUser.branch?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={tenantUser.isActive ? "success" : "neutral"}>
                        {tenantUser.isActive ? "Faol" : "Nofaol"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDate(tenantUser.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {currentUser && canCreate && (
        <CreateTenantUserModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          slug={slug}
          currentUser={currentUser}
          branches={orgQuery.data?.branches ?? []}
        />
      )}
    </div>
  );
}
