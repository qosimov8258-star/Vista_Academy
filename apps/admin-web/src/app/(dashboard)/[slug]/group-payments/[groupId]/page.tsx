"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { PAY_STATE, currentMonth, type GroupChildRow, type PayState } from "@/features/cash/shared";

interface GroupChildren {
  period: string;
  groupId: string;
  groupName: string;
  children: GroupChildRow[];
}

const ORDER: Record<PayState, number> = { OVERDUE: 0, PARTIAL: 1, NONE: 2, PAID: 3 };

export default function GroupPaymentDetailPage({ params }: { params: Promise<{ slug: string; groupId: string }> }) {
  const { slug, groupId } = use(params);
  const [period, setPeriod] = useState("");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("period");
    setPeriod((p) => p || fromUrl || currentMonth());
  }, []);

  const query = useQuery({
    queryKey: ["cash-group-children", slug, groupId, period],
    queryFn: () => api.get<GroupChildren>(`/app/cash/groups/${groupId}?period=${period}`),
    enabled: !!period,
  });

  // Qarzdorlar tepada: avval muddati o'tgan, keyin qisman, keyin hisob-fakturasiz, oxirida to'laganlar.
  const rows = [...(query.data?.children ?? [])].sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.childName.localeCompare(b.childName));
  const count = (s: PayState) => rows.filter((r) => r.state === s).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/${slug}/group-payments`} className="text-[14px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            ← Guruhlar
          </Link>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {query.data?.groupName ?? "Guruh"}
          </h1>
        </div>
        <div className="w-[170px]">
          <Input label="Oy" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["PAID", "PARTIAL", "OVERDUE", "NONE"] as const).map((k) => (
          <Badge key={k} tone={PAY_STATE[k].tone}>
            {PAY_STATE[k].label}: {count(k)}
          </Badge>
        ))}
      </div>

      {!period || query.isLoading ? (
        <LoadingState rows={6} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="Bu guruhda bola yo'q" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {rows.map((r) => (
              <li key={r.childId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${PAY_STATE[r.state].dot}`} aria-hidden />
                  <div className="min-w-0">
                    <Link href={`/${slug}/finance/${r.childId}`} className="text-[14px] font-medium text-[var(--color-primary)] hover:underline">
                      {r.childName}
                    </Link>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">
                      {r.state === "NONE"
                        ? "Bu oy uchun hisob-faktura yo'q"
                        : `To'langan ${formatMoney(r.paid)} / ${formatMoney(r.billed)}${r.dueDate ? ` · muddat ${formatDate(r.dueDate)}` : ""}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.remaining > 0 && <b className="tabular-nums">{formatMoney(r.remaining)}</b>}
                  <Badge tone={PAY_STATE[r.state].tone}>{PAY_STATE[r.state].label}</Badge>
                  {r.state !== "PAID" && r.state !== "NONE" && (
                    <Link href={`/${slug}/finance?search=${encodeURIComponent(r.childName)}`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
                      To&apos;lov
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
