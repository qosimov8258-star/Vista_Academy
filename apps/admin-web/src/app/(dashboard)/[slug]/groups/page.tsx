"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Group, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import { CreateGroupModal } from "@/features/groups/create-group-modal";
import { canWriteOperational } from "@/lib/permissions";

export default function GroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Guruhlar
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Yosh toifalari bo'yicha guruhlar</p>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi guruh</Button>}
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {groupsQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : groupsQuery.isError ? (
        <ErrorState message={(groupsQuery.error as Error).message} />
      ) : !groupsQuery.data || groupsQuery.data.length === 0 ? (
        <EmptyState title="Guruh topilmadi" description={canWrite ? "Yangi guruh qo'shish uchun tugmani bosing" : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>Nomi</Th>
                {!forcedBranchId && <Th>Filial</Th>}
                <Th numeric>Bolalar / Sig'im</Th>
                <Th>Holat</Th>
              </tr>
            </THead>
            <TBody>
              {groupsQuery.data.map((group) => (
                <Tr key={group.id}>
                  <Td className="font-medium">{group.name}</Td>
                  {!forcedBranchId && <Td className="text-[var(--color-text-muted)]">{branchName(group.branchId)}</Td>}
                  <Td numeric className="text-[var(--color-text-muted)]">
                    {group._count?.children ?? 0} / {group.capacity}
                  </Td>
                  <Td>
                    <Badge tone={group.status === "ACTIVE" ? "success" : "neutral"}>
                      {group.status === "ACTIVE" ? "Faol" : "Nofaol"}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </Card>
      )}

      {canWrite && <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
    </div>
  );
}
