"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader, CardTitle, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import {
  BuildingIcon,
  ChartIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  PauseCircleIcon,
  WalletIcon,
} from "@/components/ui/icons";
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

  // Diqqat talab qiladigan obunalar bo'lsagina pastki blok ko'rsatiladi
  const needsAttention = data.graceSubscriptions > 0 || data.suspendedSubscriptions > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Platform bo'ylab umumiy ko'rsatkichlar" />

      <section>
        <SectionLabel>Umumiy holat</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Tashkilotlar"
            value={String(data.totalOrganizations)}
            hint={`${data.activeOrganizations} tasi faol`}
            icon={BuildingIcon}
            tone="primary"
          />
          <StatCard
            label="Filiallar"
            value={String(data.totalBranches)}
            icon={ChartIcon}
            tone="default"
          />
          <StatCard
            label="Faol obunalar"
            value={String(data.activeSubscriptions)}
            tone="success"
            icon={CheckCircleIcon}
          />
          <StatCard
            label="MRR (oylik)"
            value={formatMoney(data.mrr)}
            tone="success"
            icon={WalletIcon}
            hint="Takrorlanuvchi oylik daromad"
          />
        </div>
      </section>

      <section>
        <SectionLabel>Moliya va e&apos;tibor talab qiladiganlar</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Umumiy hamyon balansi"
            value={formatMoney(data.totalWalletBalance)}
            icon={WalletIcon}
          />
          <StatCard
            label="Grace davridagi obunalar"
            value={String(data.graceSubscriptions)}
            tone="warning"
            icon={ClockIcon}
            hint={data.graceSubscriptions > 0 ? "To'lov muddati o'tgan" : "Hammasi joyida"}
          />
          <StatCard
            label="To'xtatilgan obunalar"
            value={String(data.suspendedSubscriptions)}
            tone="danger"
            icon={PauseCircleIcon}
            hint={data.suspendedSubscriptions > 0 ? "Panel yopilgan" : "Yo'q"}
          />
        </div>
        {needsAttention && (
          <Link
            href="/subscriptions"
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
          >
            Obunalarni ko&apos;rib chiqish
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </section>

      <section>
        <SectionLabel>So&apos;nggi qo&apos;shilganlar</SectionLabel>
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Yaqinda qo&apos;shilgan tashkilotlar</CardTitle>
            <Link
              href="/organizations"
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
            >
              Barchasi
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {data.recentOrganizations.length === 0 ? (
              <EmptyState
                compact
                icon={BuildingIcon}
                title="Hali tashkilot yo'q"
                description="Birinchi bog'chalar tarmog'ini yaratish uchun Tashkilotlar bo'limiga o'ting"
              />
            ) : (
              <ul className="divide-y divide-[var(--color-separator)]">
                {data.recentOrganizations.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/organizations/${org.id}`}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-primary-soft)] text-[14px] font-semibold text-[var(--color-primary)]"
                      >
                        {org.name.trim()[0]?.toUpperCase() ?? "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{org.name}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">
                          {org.branches.length} filial · {formatDate(org.createdAt)}
                        </p>
                      </div>
                      {org.subscription ? (
                        <Badge dot tone={subscriptionStatusTone(org.subscription.status)}>
                          {subscriptionStatusLabel(org.subscription.status)}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Obunasiz</Badge>
                      )}
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)] transition-transform duration-150 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
