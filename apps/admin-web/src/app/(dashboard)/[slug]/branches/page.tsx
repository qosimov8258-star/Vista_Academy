"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization, TenantUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BranchAvatar } from "@/components/ui/branch-avatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { ChevronRightIcon, PlusIcon, SettingsIcon } from "@/components/ui/icons";
import { CreateBranchModal } from "@/features/branches/create-branch-modal";

/**
 * Har bir filial o'z rangida — bir necha filial bo'lganda ular bir-biriga
 * o'xshab ketmaydi. Rang ma'no tashimaydi, faqat kartani tanib olishga
 * yordam beradi.
 */
const BRANCH_PALETTE = [
  { soft: "bg-emerald-50", mono: "bg-emerald-100 text-emerald-700", band: "from-emerald-50/80" },
  { soft: "bg-sky-50", mono: "bg-sky-100 text-sky-700", band: "from-sky-50/80" },
  { soft: "bg-violet-50", mono: "bg-violet-100 text-violet-700", band: "from-violet-50/80" },
  { soft: "bg-amber-50", mono: "bg-amber-100 text-amber-700", band: "from-amber-50/80" },
  { soft: "bg-rose-50", mono: "bg-rose-100 text-rose-600", band: "from-rose-50/80" },
  { soft: "bg-teal-50", mono: "bg-teal-100 text-teal-700", band: "from-teal-50/80" },
];

function monogram(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Kartaning pastki qismidagi bitta ko'rsatkich. Ikonka qo'yilmaydi — besh
 * xil belgi yonma-yon turganda karta shovqinli bo'lib ketadi; raqamning
 * o'zi va ustidagi izoh yetarli.
 */
function Stat({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  loading?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      {loading ? (
        <span className="mt-2 block h-4 w-16 animate-pulse rounded-full bg-[var(--color-surface-sunken)]" />
      ) : (
        <p
          className={clsx(
            "mt-1 truncate text-[19px] font-semibold tabular-nums tracking-[var(--tracking-headline)]",
            tone === "success"
              ? "text-[var(--color-success)]"
              : tone === "danger"
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-text)]",
          )}
        >
          {value}
        </p>
      )}
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
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Filiallar
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">Tarmoqqa tegishli bog&apos;cha binolari</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          Filial qo&apos;shish
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={3} />
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
            const num = (v?: number) => String(v ?? 0);
            const money = (v?: number) => formatMoney(v ?? 0);
            const hasDebt = (summary?.outstandingDebt ?? 0) > 0;
            const palette = BRANCH_PALETTE[i % BRANCH_PALETTE.length];

            return (
              <Card key={branch.id} interactive className="group relative overflow-hidden">
                {/* Butun karta filialga kirish havolasi; ustidagi tugmalar z-10 bilan tepada turadi */}
                <Link
                  href={`/${slug}/${branch.slug}`}
                  className="absolute inset-0 z-0"
                  aria-label={`${branch.name} filialiga kirish`}
                />

                {/* Yuqori qismga filial rangidan yengil o'tish beriladi */}
                <div
                  className={clsx(
                    "pointer-events-none relative z-10 flex items-center gap-4 bg-gradient-to-r to-transparent px-5 py-4",
                    palette.band,
                  )}
                >
                  {/* Belgi qo'yilgan bo'lsa rasm, aks holda nomning bosh harfi */}
                  <BranchAvatar
                    branch={branch}
                    size={48}
                    className={clsx("text-[19px] font-semibold", !branch.avatarUpdatedAt && palette.mono)}
                    fallback={monogram(branch.name)}
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                      {branch.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[12.5px] text-[var(--color-text-muted)]">
                      {branch.address || "Manzil ko'rsatilmagan"}
                    </p>
                  </div>

                  {/* Filial admini — Xodimlar sahifasidagi kabi bosh harflar bilan */}
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    {manager ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface)]/80 py-1 pl-1 pr-3 text-[13px]">
                        {/* Bosh harflar Avatar komponentidagi kabi brend rangida — filial rangi bilan raqobatlashmaydi */}
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[10px] font-semibold text-[var(--color-primary)] ring-1 ring-inset ring-[rgba(16,24,40,0.06)]">
                          {initials(manager.fullName)}
                        </span>
                        <span className="font-medium text-[var(--color-text)]">{manager.fullName}</span>
                      </span>
                    ) : (
                      <Badge tone="warning">Filial admini tayinlanmagan</Badge>
                    )}
                  </div>

                  <div className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-1">
                    <Link
                      href={`/${slug}/branches/${branch.id}`}
                      title="Filial sozlamalari"
                      aria-label={`${branch.name} sozlamalari`}
                      className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                    >
                      <SettingsIcon className="h-[18px] w-[18px]" />
                    </Link>
                    <ChevronRightIcon className="h-5 w-5 text-[var(--color-text-muted)]/40 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] motion-reduce:transition-none" />
                  </div>
                </div>

                <div className="hairline pointer-events-none relative z-10 grid grid-cols-2 divide-x divide-y divide-[var(--color-separator)] border-t border-[var(--color-separator)] sm:grid-cols-4 sm:divide-y-0">
                  <Stat label="Bolalar" value={num(summary?.childrenCount)} loading={loading} />
                  <Stat label="Guruhlar" value={num(summary?.activeGroupsCount)} loading={loading} />
                  <Stat label="Xodimlar" value={num(summary?.employeesCount)} loading={loading} />
                  <Stat
                    label="Joriy oy tushumi"
                    value={money(summary?.monthRevenue)}
                    tone="success"
                    loading={loading}
                  />
                </div>

                {/* Qarzdorlik ustun emas, ogohlantirish: u bo'lmasa karta ham tinch turadi */}
                {hasDebt && (
                  <div className="hairline pointer-events-none relative z-10 flex items-center gap-2 border-t border-[var(--color-separator)] bg-[var(--color-danger-bg)] px-5 py-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-danger)]" />
                    <span className="text-[13px] text-[var(--color-danger)]">
                      To&apos;lanmagan qarzdorlik
                      <span className="ml-1.5 font-semibold tabular-nums">
                        {money(summary?.outstandingDebt)}
                      </span>
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CreateBranchModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />
    </div>
  );
}
