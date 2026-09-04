"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Subscription } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/features/subscriptions/status";

export default function SubscriptionsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api.get<Subscription[]>("/platform/subscriptions"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Obunalar</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Barcha tashkilotlarning SaaS obuna holati</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Obunalar yo'q" description="Tashkilot sahifasidan obuna biriktiring" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Tashkilot</th>
                  <th className="px-5 py-3 font-medium">Reja</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium">Davr oxiri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/organizations/${sub.organizationId}`}
                        className="font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {sub.organization?.name ?? sub.organizationId}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text)]">
                      {sub.plan?.name} — {formatMoney(sub.plan?.priceMonthly ?? "0")}/oy
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={subscriptionStatusTone(sub.status)}>{subscriptionStatusLabel(sub.status)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDate(sub.currentPeriodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
