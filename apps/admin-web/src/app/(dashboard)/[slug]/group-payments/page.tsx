"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { PAY_STATE, currentMonth, type GroupPaymentSummary } from "@/features/cash/shared";

export default function GroupPaymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [period, setPeriod] = useState("");
  useEffect(() => setPeriod((p) => p || currentMonth()), []);

  const query = useQuery({
    queryKey: ["cash-groups", slug, period],
    queryFn: () => api.get<{ period: string; groups: GroupPaymentSummary[] }>(`/app/cash/groups?period=${period}`),
    enabled: !!period,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Guruhlar bo&apos;yicha to&apos;lov</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Guruhni oching — qaysi bola to&apos;lagani ko&apos;rinadi</p>
        </div>
        <div className="w-[170px]">
          <Input label="Oy" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[13px] text-[var(--color-text-muted)]">
        {(["PAID", "PARTIAL", "OVERDUE", "NONE"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${PAY_STATE[k].dot}`} />
            {PAY_STATE[k].label}
          </span>
        ))}
      </div>

      {!period || query.isLoading ? (
        <LoadingState rows={4} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : !query.data?.groups.length ? (
        <EmptyState title="Guruh yo'q" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.groups.map((g) => (
            <Link key={g.groupId} href={`/${slug}/group-payments/${g.groupId}?period=${period}`}>
              <Card className="h-full space-y-3 p-4 transition-shadow hover:shadow-[var(--shadow-raised)]">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[16px] font-semibold text-[var(--color-text)]">{g.name}</p>
                  <span className="text-[12.5px] text-[var(--color-text-muted)]">{g.total} bola</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                  {(["PAID", "PARTIAL", "OVERDUE"] as const).map((k) => {
                    const n = k === "PAID" ? g.paid : k === "PARTIAL" ? g.partial : g.overdue;
                    return n > 0 ? <span key={k} className={PAY_STATE[k].dot} style={{ width: `${(n / g.total) * 100}%` }} /> : null;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  <span className="text-[var(--color-success)]">To&apos;lagan: <b>{g.paid}</b></span>
                  <span className="text-[var(--color-warning)]">Qisman: <b>{g.partial}</b></span>
                  <span className="text-[var(--color-danger)]">Muddati o&apos;tgan: <b>{g.overdue}</b></span>
                  {g.none > 0 && <span className="text-[var(--color-text-muted)]">Yo&apos;q: <b>{g.none}</b></span>}
                </div>
                <p className="text-[12.5px] tabular-nums text-[var(--color-text-muted)]">
                  Yig&apos;ilgan {formatMoney(g.collected)} / {formatMoney(g.billed)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
