"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Group, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import { CreateGroupModal } from "@/features/groups/create-group-modal";

export default function GroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);
  const { user } = useAuth();
  const canWrite = user?.role !== "NETWORK_ADMIN";
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const branches = orgQuery.data?.branches ?? [];
  const branchName = (branchId: string) => branches.find((b) => b.id === branchId)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Guruhlar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Yosh toifalari bo'yicha guruhlar</p>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi guruh</Button>}
      </div>

      {!canWrite && <ViewOnlyNote />}

      {groupsQuery.isLoading ? (
        <LoadingState />
      ) : groupsQuery.isError ? (
        <ErrorState message={(groupsQuery.error as Error).message} />
      ) : !groupsQuery.data || groupsQuery.data.length === 0 ? (
        <EmptyState title="Guruh topilmadi" description={canWrite ? "Yangi guruh qo'shish uchun tugmani bosing" : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Nomi</th>
                  {!forcedBranchId && <th className="px-5 py-3 font-medium">Filial</th>}
                  <th className="px-5 py-3 font-medium">Bolalar / Sig'im</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {groupsQuery.data.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-[var(--color-text)]">{group.name}</td>
                    {!forcedBranchId && (
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{branchName(group.branchId)}</td>
                    )}
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      {group._count?.children ?? 0} / {group.capacity}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={group.status === "ACTIVE" ? "success" : "neutral"}>
                        {group.status === "ACTIVE" ? "Faol" : "Nofaol"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canWrite && <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
    </div>
  );
}
