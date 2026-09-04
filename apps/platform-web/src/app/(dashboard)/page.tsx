"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney, formatDate } from "@/lib/format";
import { subscriptionStatusTone, subscriptionStatusLabel } from "@/features/subscriptions/status";

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get<DashboardSummary>("/platform/dashboard/summary"),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Platform bo'ylab umumiy ko'rsatkichlar</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tashkilotlar"
          value={String(data.totalOrganizations)}
          hint={`${data.activeOrganizations} faol`}
        />
        <StatCard label="Filiallar" value={String(data.totalBranches)} />
        <StatCard
          label="Faol obunalar"
          value={String(data.activeSubscriptions)}
          tone="success"
          hint={
            data.graceSubscriptions || data.suspendedSubscriptions
              ? `${data.graceSubscriptions} grace, ${data.suspendedSubscriptions} to'xtatilgan`
              : undefined
          }
        />
        <StatCard label="MRR (oylik)" value={formatMoney(data.mrr)} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Umumiy hamyon balansi" value={formatMoney(data.totalWalletBalance)} />
        <StatCard label="Grace davridagi obunalar" value={String(data.graceSubscriptions)} tone="warning" />
        <StatCard label="To'xtatilgan obunalar" value={String(data.suspendedSubscriptions)} tone="danger" />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Yaqinda qo&apos;shilgan tashkilotlar</CardTitle>
          <Link href="/organizations" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            Barchasi →
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          {data.recentOrganizations.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Hali tashkilot yo'q"
                description="Birinchi bog'chalar tarmog'ini yaratish uchun Tashkilotlar bo'limiga o'ting"
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {data.recentOrganizations.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/organizations/${org.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{org.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {org.branches.length} filial • {formatDate(org.createdAt)}
                      </p>
                    </div>
                    {org.subscription ? (
                      <Badge tone={subscriptionStatusTone(org.subscription.status)}>
                        {subscriptionStatusLabel(org.subscription.status)}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Obunasiz</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
