"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization, TenantUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { CreateBranchModal } from "@/features/branches/create-branch-modal";

function StatBlock({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="flex min-w-[120px] items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <p
          className={`truncate text-xl font-semibold ${
            tone === "success"
              ? "text-[var(--color-success)]"
              : tone === "danger"
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-text)]"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export default function BranchesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: org, isLoading, isError, error } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const usersQuery = useQuery({
    queryKey: ["tenant-users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
  });

  const branches = org?.branches ?? [];

  // One dashboard-summary request per branch, fetched in parallel so a slow
  // branch doesn't hold up the others — each row renders its own numbers as
  // soon as its query settles.
  const summaryQueries = useQueries({
    queries: branches.map((branch) => ({
      queryKey: ["dashboard-summary", slug, branch.id],
      queryFn: () => api.get<DashboardSummary>(`/app/dashboard/summary?branchId=${branch.id}`),
    })),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Filiallar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Tarmoqqa tegishli bog'cha binolari</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Filial qo&apos;shish</Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !org || org.branches.length === 0 ? (
        <EmptyState title="Filial topilmadi" description="Yangi filial (bog'cha) qo'shish uchun tugmani bosing" />
      ) : (
        <div className="flex flex-col gap-4">
          {branches.map((branch, i) => {
            const manager = usersQuery.data?.find((u) => u.role === "BRANCH_ADMIN" && u.branchId === branch.id) ?? null;
            const summaryQuery = summaryQueries[i];
            const summary = summaryQuery?.data;
            const summaryLoading = summaryQuery?.isLoading ?? true;

            return (
              <Card
                key={branch.id}
                className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md"
              >
                <Link
                  href={`/${slug}/${branch.slug}`}
                  className="absolute inset-0 z-0"
                  aria-label={`${branch.name} filialiga kirish`}
                />

                <div className="relative z-10 flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="pointer-events-none flex min-w-0 items-start gap-4 lg:w-72 lg:shrink-0">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-2xl">
                      🏫
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                        {branch.name}
                      </h3>
                      <p className="mt-0.5 truncate text-sm text-[var(--color-text-muted)]">
                        {branch.address || "Manzil ko'rsatilmagan"}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-sm">
                        <span className="text-[var(--color-text-muted)]">Filial admini:</span>
                        {manager ? (
                          <span className="font-medium text-[var(--color-text)]">{manager.fullName}</span>
                        ) : (
                          <Badge tone="warning">Tayinlanmagan</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pointer-events-none flex flex-1 flex-wrap items-center gap-x-8 gap-y-4 border-t border-[var(--color-border)] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <StatBlock icon="🧒" label="Bolalar" value={summaryLoading ? "—" : String(summary?.childrenCount ?? 0)} />
                    <StatBlock icon="👥" label="Guruhlar" value={summaryLoading ? "—" : String(summary?.activeGroupsCount ?? 0)} />
                    <StatBlock icon="🧑‍🏫" label="Xodimlar" value={summaryLoading ? "—" : String(summary?.employeesCount ?? 0)} />
                    <StatBlock
                      icon="💵"
                      label="Joriy oy tushumi"
                      value={summaryLoading ? "—" : formatMoney(summary?.monthRevenue ?? 0)}
                      tone="success"
                    />
                    {(summary?.outstandingDebt ?? 0) > 0 && (
                      <StatBlock
                        icon="⚠️"
                        label="Qarzdorlik"
                        value={summaryLoading ? "—" : formatMoney(summary?.outstandingDebt ?? 0)}
                        tone="danger"
                      />
                    )}
                  </div>

                  <div className="relative z-10 flex shrink-0 items-center gap-2 self-start lg:self-center">
                    <Link
                      href={`/${slug}/branches/${branch.id}`}
                      title="Filial sozlamalari"
                      className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-gray-100 hover:text-[var(--color-text)]"
                    >
                      ⚙️
                    </Link>
                    <Link
                      href={`/${slug}/${branch.slug}`}
                      className="hidden text-sm font-medium text-[var(--color-primary)] hover:underline lg:inline"
                    >
                      Kirish →
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateBranchModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />
    </div>
  );
}
