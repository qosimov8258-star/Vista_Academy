"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";

export default function BranchDashboardPage({ params }: { params: Promise<{ slug: string; branchSlug: string }> }) {
  const { slug, branchSlug } = use(params);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const branch = orgQuery.data?.branches.find((b) => b.slug === branchSlug) ?? null;

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", slug, branch?.id],
    queryFn: () => api.get<DashboardSummary>(`/app/dashboard/summary?branchId=${branch?.id}`),
    enabled: !!branch,
  });

  if (orgQuery.isLoading) return <LoadingState />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  if (!branch) return <EmptyState title="Filial topilmadi" description="Bu manzilda bunday filial mavjud emas" />;

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${slug}`} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← Tarmoq bo&apos;yicha
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">{branch.name}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{branch.address || "Manzil ko'rsatilmagan"}</p>
      </div>

      {summaryQuery.isLoading ? (
        <LoadingState />
      ) : summaryQuery.isError ? (
        <ErrorState message={(summaryQuery.error as Error).message} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Bolalar soni</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.childrenCount ?? 0}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Faol guruhlar</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.activeGroupsCount ?? 0}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Xodimlar soni</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.employeesCount ?? 0}</p>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Joriy oy tushumi</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">
                  {formatMoney(summary?.monthRevenue ?? 0)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Qarzdorlik</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">
                  {formatMoney(summary?.outstandingDebt ?? 0)}
                </p>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Card>
              <CardBody className="flex gap-8">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Bolalar — Keldi</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">{summary?.todayAttendance.present ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Kelmadi</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">{summary?.todayAttendance.absent ?? 0}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex gap-8">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Xodimlar — Keldi</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">{summary?.todayStaffAttendance.present ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Kelmadi</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">{summary?.todayStaffAttendance.absent ?? 0}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Kundalik hisobotlar to&apos;ldirilgan</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
                  {summary?.todayDailyReportsFilled ?? 0} / {summary?.childrenCount ?? 0}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-text-muted)]">
                Bu ko&apos;rsatkichlar faqat <span className="font-medium text-[var(--color-text)]">{branch.name}</span> filialiga
                tegishli. Ushbu filialning boshqaruv sozlamalarini{" "}
                <Link
                  href={`/${slug}/branches/${branch.id}`}
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  bu yerda
                </Link>{" "}
                ko&apos;rishingiz mumkin.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
