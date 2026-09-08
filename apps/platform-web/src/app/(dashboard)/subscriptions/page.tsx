"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Subscription } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, EmptyState, TableSkeleton } from "@/components/ui/states";
import { ChevronRightIcon, RefreshIcon } from "@/components/ui/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/features/subscriptions/status";

export default function SubscriptionsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api.get<Subscription[]>("/platform/subscriptions"),
  });

  // Diqqat talab qiladiganlar (grace/to'xtatilgan) tepada tursin — bu ro'yxatga
  // kirishdan maqsad odatda muammoli obunani topish.
  const sorted = data
    ? [...data].sort((a, b) => {
        const priority = { GRACE_PERIOD: 0, SUSPENDED: 1, ACTIVE: 2, CANCELLED: 3 } as const;
        return priority[a.status] - priority[b.status];
      })
    : [];

  return (
    <div className="space-y-5">
      <PageHeader title="Obunalar" description="Barcha tashkilotlarning SaaS obuna holati" />

      {isLoading ? (
        <Card className="overflow-hidden">
          <TableSkeleton rows={5} columns={4} />
        </Card>
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={RefreshIcon}
          title="Obunalar yo'q"
          description="Tashkilot sahifasidan obuna biriktiring"
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Tor oynada ustunlar kesilmasin — jadval o'z ichida siljiydi */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-sunken)] text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Tashkilot</th>
                  <th className="px-3 py-2.5 font-semibold">Reja</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Narx</th>
                  <th className="px-3 py-2.5 font-semibold">Holat</th>
                  <th className="px-5 py-2.5 font-semibold">Davr oxiri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-separator)]">
                {sorted.map((sub) => (
                  <tr key={sub.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/organizations/${sub.organizationId}`}
                        className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                      >
                        {sub.organization?.name ?? sub.organizationId}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-muted)]">{sub.plan?.name ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">
                      {formatMoney(sub.plan?.priceMonthly ?? "0")}
                      <span className="text-[var(--color-text-muted)]">/oy</span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge dot tone={subscriptionStatusTone(sub.status)}>
                        {subscriptionStatusLabel(sub.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
                      {formatDate(sub.currentPeriodEnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-[var(--color-separator)] md:hidden">
            {sorted.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/organizations/${sub.organizationId}`}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-[var(--color-surface-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[var(--color-text)]">
                      {sub.organization?.name ?? sub.organizationId}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {sub.plan?.name ?? "—"} · {formatMoney(sub.plan?.priceMonthly ?? "0")}/oy
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge dot tone={subscriptionStatusTone(sub.status)}>
                        {subscriptionStatusLabel(sub.status)}
                      </Badge>
                      <span className="text-[12px] text-[var(--color-text-subtle)]">
                        {formatDate(sub.currentPeriodEnd)} gacha
                      </span>
                    </div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)]" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
