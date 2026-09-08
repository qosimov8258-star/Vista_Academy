"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization, TenantUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { BuildingIcon, ChevronRightIcon, PlusIcon, SettingsIcon } from "@/components/ui/icons";
import { CreateBranchModal } from "@/features/branches/create-branch-modal";

/**
 * Kartaning pastki qismidagi bitta ko'rsatkich. Har biriga alohida ikonka
 * qo'yilmaydi — to'rt-besh xil belgi yonma-yon turganda karta shovqinli
 * bo'lib ketadi; raqamning o'zi va ustidagi izoh yetarli.
 */
function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p
        className={clsx(
          "mt-1 truncate text-[19px] font-semibold tabular-nums tracking-tight",
          tone === "success"
            ? "text-[var(--color-success)]"
            : tone === "danger"
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-text)]",
        )}
      >
        {value}
      </p>
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
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">Filiallar</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">Tarmoqqa tegishli bog&apos;cha binolari</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-full">
          <PlusIcon className="h-4 w-4" />
          Filial qo&apos;shish
        </Button>
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
            const loading = summaryQuery?.isLoading ?? true;
            const num = (v?: number) => (loading ? "—" : String(v ?? 0));
            const money = (v?: number) => (loading ? "—" : formatMoney(v ?? 0));
            const hasDebt = (summary?.outstandingDebt ?? 0) > 0;

            return (
              <div
                key={branch.id}
                className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(16,24,40,0.15)]"
              >
                {/* Butun karta filialga kirish havolasi; ustidagi tugmalar z-10 bilan tepada turadi */}
                <Link
                  href={`/${slug}/${branch.slug}`}
                  className="absolute inset-0 z-0"
                  aria-label={`${branch.name} filialiga kirish`}
                />

                <div className="pointer-events-none relative z-10 flex items-center gap-4 px-5 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <BuildingIcon className="h-6 w-6" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[17px] font-semibold tracking-tight text-[var(--color-text)]">
                      {branch.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-muted)]">
                      {branch.address || "Manzil ko'rsatilmagan"}
                    </p>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="text-[13px] text-[var(--color-text-muted)]">Filial admini</span>
                    {manager ? (
                      <span className="text-[13px] font-medium text-[var(--color-text)]">{manager.fullName}</span>
                    ) : (
                      <Badge tone="warning">Tayinlanmagan</Badge>
                    )}
                  </div>

                  <div className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-1">
                    <Link
                      href={`/${slug}/branches/${branch.id}`}
                      title="Filial sozlamalari"
                      aria-label={`${branch.name} sozlamalari`}
                      className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors hover:bg-gray-100 hover:text-[var(--color-text)]"
                    >
                      <SettingsIcon className="h-[18px] w-[18px]" />
                    </Link>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]" />
                  </div>
                </div>

                <div
                  className={clsx(
                    "pointer-events-none relative z-10 grid divide-x divide-[var(--color-border)] border-t border-[var(--color-border)] bg-gray-50/60",
                    hasDebt ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4",
                  )}
                >
                  <Stat label="Bolalar" value={num(summary?.childrenCount)} />
                  <Stat label="Guruhlar" value={num(summary?.activeGroupsCount)} />
                  <Stat label="Xodimlar" value={num(summary?.employeesCount)} />
                  <Stat label="Joriy oy tushumi" value={money(summary?.monthRevenue)} tone="success" />
                  {hasDebt && <Stat label="Qarzdorlik" value={money(summary?.outstandingDebt)} tone="danger" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateBranchModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />
    </div>
  );
}
