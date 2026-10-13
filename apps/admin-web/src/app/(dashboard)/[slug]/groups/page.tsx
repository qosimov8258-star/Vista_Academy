"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import type { Group, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { IosButton } from "@/components/ios/button";
import { ChipRow, IosChip, SearchPill } from "@/components/ios/filters";
import { Group as IosGroup, ListRow } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS } from "@/components/ios/tokens";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { CapacityBar, GroupFormSheet, GroupTile } from "@/features/groups/group-sheets";
import { groupDigits } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";

type StatusFilter = "ACTIVE" | "INACTIVE" | "ALL";

/**
 * Guruhlar — iOS uslubida: tepada umumiy ko'rsatkichlar (guruhlar, bolalar,
 * bo'sh o'rin, tarbiyachisiz guruhlar), qidiruv va holat filtri, har guruh
 * qatorida rangli plitka, tarbiyachilar, bolalar/sig'im chizig'i.
 * Qator bosilsa — guruh sahifasi; "Yangi guruh" — varaqda.
 */
export default function GroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId, base } = useBranchContext(slug);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  const orgQuery = useQuery({ queryKey: ["org", slug], queryFn: () => api.get<Organization>("/app/organizations/me") });
  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const branches = orgQuery.data?.branches ?? [];
  const multiBranch = !forcedBranchId && branches.length > 1;
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const all = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const active = all.filter((g) => g.status === "ACTIVE");
  const teachersOf = (g: Group) => (g.teachers ?? []).map((t) => t.employee?.fullName).filter(Boolean) as string[];

  const stats = {
    groups: active.length,
    children: active.reduce((s, g) => s + (g._count?.children ?? 0), 0),
    free: active.reduce((s, g) => s + Math.max(0, g.capacity - (g._count?.children ?? 0)), 0),
    noTeacher: active.filter((g) => teachersOf(g).length === 0).length,
  };

  const q = search.trim().toLowerCase();
  const visible = all
    .filter((g) => status === "ALL" || g.status === status)
    .filter((g) => !branchFilter || g.branchId === branchFilter)
    .filter((g) => !q || g.name.toLowerCase().includes(q) || teachersOf(g).some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={() => groupsQuery.refetch()} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={UsersRound}
          tint="indigo"
          title={tr("Guruhlar")}
          count={groupsQuery.data ? tr("{0} ta", all.length) : undefined}
          subtitle={tr("Yosh toifalari bo'yicha guruhlar")}
          actions={canWrite ? <IosButton label={tr("Yangi guruh")} icon={Plus} variant="primary" compact onClick={() => setCreateOpen(true)} /> : undefined}
        />

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        <StatStrip tone="white">
          <StatCell label={tr("Faol guruhlar")} value={stats.groups} loading={groupsQuery.isLoading} />
          <StatCell label={tr("Bolalar")} value={stats.children} loading={groupsQuery.isLoading} />
          <StatCell label={tr("Bo'sh o'rin")} value={stats.free} color={stats.free > 0 ? IOS.green : undefined} loading={groupsQuery.isLoading} />
          <StatCell
            label={tr("Tarbiyachisiz")}
            value={stats.noTeacher}
            color={stats.noTeacher > 0 ? IOS.orange : undefined}
            hint={stats.noTeacher > 0 ? tr("biriktirish kerak") : tr("hammasida bor")}
            loading={groupsQuery.isLoading}
          />
        </StatStrip>

        {groupsQuery.isError ? (
          <ErrorState message={(groupsQuery.error as Error).message} onRetry={() => groupsQuery.refetch()} retrying={groupsQuery.isFetching} />
        ) : groupsQuery.isLoading ? (
          <IosGroup title={tr("Guruhlar")} bare>
            <SkeletonRows rows={5} />
          </IosGroup>
        ) : all.length === 0 ? (
          <div className="space-y-4">
            <EmptyState icon={UsersRound} title="Hali guruh yo'q" hint={canWrite ? "Birinchi guruhni qo'shing — keyin bolalarni unga biriktirasiz." : undefined} />
            {canWrite && (
              <div className="flex justify-center">
                <IosButton label={tr("Yangi guruh")} icon={Plus} variant="primary" onClick={() => setCreateOpen(true)} />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {all.length > 5 && <SearchPill value={search} onChange={setSearch} placeholder={tr("Guruh yoki tarbiyachi")} />}
              <ChipRow label={tr("Holat")}>
                <IosChip active={status === "ACTIVE"} onClick={() => setStatus("ACTIVE")} count={active.length}>
                  {tr("Faol")}
                </IosChip>
                <IosChip active={status === "INACTIVE"} onClick={() => setStatus("INACTIVE")} count={all.length - active.length}>
                  {tr("Nofaol")}
                </IosChip>
                <IosChip active={status === "ALL"} onClick={() => setStatus("ALL")} count={all.length}>
                  {tr("Hammasi")}
                </IosChip>
              </ChipRow>
              {multiBranch && (
                <ChipRow label={tr("Filial")}>
                  <IosChip active={!branchFilter} onClick={() => setBranchFilter(null)}>
                    {tr("Barcha filiallar")}
                  </IosChip>
                  {branches.map((b) => (
                    <IosChip key={b.id} active={branchFilter === b.id} onClick={() => setBranchFilter(branchFilter === b.id ? null : b.id)}>
                      {tr(b.name)}
                    </IosChip>
                  ))}
                </ChipRow>
              )}
            </div>

            <IosGroup title={tr("Guruhlar")} refreshing={groupsQuery.isFetching && !groupsQuery.isLoading} bare={visible.length === 0}>
              {visible.length === 0 ? (
                <EmptyState icon={UsersRound} title="Bu tanlovda guruh yo'q" />
              ) : (
                visible.map((g) => {
                  const count = g._count?.children ?? 0;
                  const teachers = teachersOf(g);
                  return (
                    <ListRow
                      key={g.id}
                      href={`${base}/groups/${g.id}`}
                      avatar={<GroupTile name={g.name} />}
                      title={
                        <span className="flex items-center gap-2">
                          <span className="truncate">{tr(g.name)}</span>
                          {g.status !== "ACTIVE" && <Pill>{tr("Nofaol")}</Pill>}
                        </span>
                      }
                      subtitle={
                        <>
                          {multiBranch && <span>{tr(branchName(g.branchId))} · </span>}
                          {g.monthlyFee && <span className="font-medium text-[var(--color-text)]">{groupDigits(g.monthlyFee)} {tr("so'm")} · </span>}
                          {teachers.length > 0 ? teachers.join(", ") : <span className="text-[#ff9500]">{tr("Tarbiyachi biriktirilmagan")}</span>}
                        </>
                      }
                      meta={
                        <span className="flex w-[64px] flex-col items-end gap-1.5">
                          <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">
                            {count}
                            <span className="text-[13px] font-normal text-[#8e8e93]">/{g.capacity}</span>
                          </span>
                          <CapacityBar count={count} capacity={g.capacity} className="w-full" />
                        </span>
                      }
                    />
                  );
                })
              )}
            </IosGroup>
          </>
        )}
      </div>

      {canWrite && <GroupFormSheet open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
    </div>
  );
}
