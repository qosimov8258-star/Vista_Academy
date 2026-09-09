"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Group, Organization } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { CapacityRing } from "@/features/network/capacity-ring";
import { monogram, paletteFor } from "@/features/network/palette";
import { ChevronRightIcon, TeacherIcon } from "@/components/ui/icons";

/**
 * Super Admin uchun tarmoq bo'ylab guruhlar: barcha filiallarniki bir joyda,
 * kartochkalar ko'rinishida. Filial darajasidagi `/{slug}/groups` sahifasi
 * o'zgarishsiz qoladi — u filial xodimlarining kundalik ish ro'yxati.
 */
export default function NetworkGroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const groupsQuery = useQuery({
    queryKey: ["network-groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
  });

  const branches = orgQuery.data?.branches ?? [];
  const branchName = (branchId: string) => branches.find((b) => b.id === branchId)?.name ?? "—";

  const groups = useMemo(() => {
    const all = groupsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    return all
      .filter((g) => branchFilter === "all" || g.branchId === branchFilter)
      .filter((g) => !term || g.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "uz"));
  }, [groupsQuery.data, branchFilter, search]);

  const totals = useMemo(() => {
    const children = groups.reduce((sum, g) => sum + (g._count?.children ?? 0), 0);
    const capacity = groups.reduce((sum, g) => sum + g.capacity, 0);
    return { children, capacity, free: Math.max(0, capacity - children) };
  }, [groups]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Guruhlar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Tarmoqdagi barcha guruhlar bir ro&apos;yxatda</p>
        </div>
        {groupsQuery.data && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--color-text-muted)]">
              <b className="text-[var(--color-text)]">{groups.length}</b> guruh
            </span>
            <span className="text-[var(--color-text-muted)]">
              <b className="text-[var(--color-text)]">{totals.children}</b> / {totals.capacity} o&apos;rin band
            </span>
            <span className="text-[var(--color-text-muted)]">
              <b className="text-[var(--color-text)]">{totals.free}</b> bo&apos;sh
            </span>
          </div>
        )}
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Guruh nomi bo'yicha qidirish"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-xl sm:max-w-xs"
        />
        {branches.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={branchFilter === "all"} onClick={() => setBranchFilter("all")}>
              Barcha filiallar
            </FilterChip>
            {branches.map((branch) => (
              <FilterChip key={branch.id} active={branchFilter === branch.id} onClick={() => setBranchFilter(branch.id)}>
                {branch.name}
              </FilterChip>
            ))}
          </div>
        )}
      </Card>

      {groupsQuery.isLoading ? (
        <LoadingState />
      ) : groupsQuery.isError ? (
        <ErrorState message={(groupsQuery.error as Error).message} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="Guruh topilmadi"
          description={search ? "Qidiruv shartini o'zgartirib ko'ring" : "Guruhlar filial panelidan qo'shiladi"}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const palette = paletteFor(group.id);
            const count = group._count?.children ?? 0;
            const free = Math.max(0, group.capacity - count);
            const teachers = group.teachers ?? [];
            return (
              <Link
                key={group.id}
                href={`/${slug}/network/groups/${group.id}`}
                className="group block overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,24,40,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="flex items-start gap-4 p-5">
                  <CapacityRing value={count} total={group.capacity} ringClass={palette.ring} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span
                        className={clsx(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[10px] font-bold",
                          palette.chip,
                        )}
                      >
                        {monogram(group.name)}
                      </span>
                      <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-6 text-[var(--color-text)]">
                        {group.name}
                      </h2>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                      {branchName(group.branchId)}
                      {group.status !== "ACTIVE" && " · Nofaol"}
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {teachers.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-warning)]">
                          Tarbiyachi biriktirilmagan
                        </span>
                      ) : (
                        teachers.map((link) => (
                          <span
                            key={link.employeeId}
                            className={clsx(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                              palette.chip,
                            )}
                          >
                            <TeacherIcon className="h-3 w-3" />
                            {link.employee?.fullName ?? "Tarbiyachi"}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--color-separator)] px-5 py-2.5">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {count === 0 ? "Hali bola qo'shilmagan" : free === 0 ? "To'lgan" : `${free} o'rin bo'sh`}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      )}
    >
      {children}
    </button>
  );
}
