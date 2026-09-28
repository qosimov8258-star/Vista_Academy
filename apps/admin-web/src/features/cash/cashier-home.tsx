"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { StaffAbsenceToday } from "./staff-absence";
import { useAuth } from "@/lib/use-auth";
import { METHODS, METHOD_LABEL, todayTashkent, type CashDay } from "./shared";

/** Kassirning bosh sahifasi: bugungi kassa, kassa yopilganmi va eng katta qarzdorlar. */
export function CashierHome({ slug }: { slug: string }) {
  const today = todayTashkent();
  const { user } = useAuth();
  const dayQuery = useQuery({
    queryKey: ["cash-day", slug, today],
    queryFn: () => api.get<CashDay>(`/app/cash/day?date=${today}`),
    refetchInterval: 60_000,
  });
  const day = dayQuery.data;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Bugungi kassa</CardTitle>
          <Link href={`/${slug}/cash`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
            Batafsil
          </Link>
        </CardHeader>
        <CardBody className="space-y-3">
          {dayQuery.isLoading ? (
            <LoadingState rows={2} />
          ) : dayQuery.isError ? (
            <ErrorState message={(dayQuery.error as Error).message} />
          ) : day ? (
            <>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                <div>
                  <div className="text-[30px] font-semibold leading-none tabular-nums">{formatMoney(day.incomeTotal)}</div>
                  <div className="mt-1 text-[13px] text-[var(--color-text-muted)]">bugungi kirim</div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-[var(--color-text-muted)]">
                  {METHODS.map((m) => (
                    <span key={m}>
                      {METHOD_LABEL[m]}: <b className="text-[var(--color-text)]">{formatMoney(day.income[m].total)}</b>
                    </span>
                  ))}
                  <span>
                    Xarajat: <b className="text-[var(--color-text)]">{formatMoney(day.expensesTotal)}</b>
                  </span>
                </div>
              </div>
              <p className="flex flex-wrap items-center gap-2 text-[14px]">
                Kassada bo&apos;lishi kerak naqd: <b className="tabular-nums">{formatMoney(day.expectedCash)}</b>
                {day.closing ? <Badge tone="success">Kassa yopilgan</Badge> : <Badge tone="warning">Kassa hali yopilmagan</Badge>}
              </p>
            </>
          ) : null}
        </CardBody>
      </Card>

      {user?.branchId && <StaffAbsenceToday slug={slug} branchId={user.branchId} />}
    </div>
  );
}
