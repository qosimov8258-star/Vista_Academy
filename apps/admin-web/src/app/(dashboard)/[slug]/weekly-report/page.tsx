"use client";

import { TopbarAction } from "@/components/layout/topbar-action";
import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { todayTashkent, type WeeklyResult } from "@/features/desk/shared";

function shift(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function WeeklyReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [from, setFrom] = useState("");
  useEffect(() => setFrom((f) => f || todayTashkent()), []);
  const query = useQuery({
    queryKey: ["desk-weekly", slug, from],
    queryFn: () => api.get<WeeklyResult>(`/app/desk/weekly?from=${from}`),
    enabled: !!from,
  });
  const r = query.data;
  const tile = (label: string, value: string | number, hint?: string) => (
    <Card className="p-4">
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--color-text)]">{value}</p>
      {hint && <p className="text-[12px] text-[var(--color-text-muted)]">{hint}</p>}
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Haftalik hisobot</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Direktorga: bolalar, davomat, qarz va arizalar</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setFrom((f) => shift(f, -7))}>
            ← Oldingi hafta
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFrom((f) => shift(f, 7))}>
            Keyingi hafta →
          </Button>
          <div className="hidden md:block">
            <Button onClick={() => window.print()}>Chop etish / PDF</Button>
          </div>
        </div>
        <TopbarAction>
          <Button onClick={() => window.print()}>Chop etish / PDF</Button>
        </TopbarAction>
      </div>

      {!from || query.isLoading ? (
        <LoadingState rows={5} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : r ? (
        <>
          <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
            Hafta: {formatDate(r.from)} — {formatDate(r.to)}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tile("Faol bolalar", r.children)}
            {tile("Davomat", r.attendancePercent === null ? "—" : `${r.attendancePercent}%`, "kelganlar ulushi")}
            {tile("Yig'ilgan to'lov", formatMoney(r.collected))}
            {tile("Jami qarz", formatMoney(r.totalDebt), `${r.debtorsCount} ta qarzdor`)}
            {tile("Muddati o'tgan qarz", formatMoney(r.overdueDebt))}
            {tile("Yangi arizalar", r.newLeads, `${r.wonLeads} tasi qabul qilindi`)}
            {tile("Xodimlar yo'qligi", r.staffAbsences, "kun (kelmadi/kasal/ta'til)")}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kunlar bo&apos;yicha davomat</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                {r.daily.map((d) => (
                  <li key={d.date} className="flex items-center justify-between gap-3 py-2">
                    <span className="tabular-nums text-[var(--color-text-muted)]">{formatDate(d.date)}</span>
                    <span className="flex gap-4 tabular-nums">
                      <span>Keldi <b>{d.present}</b></span>
                      <span>Kelmadi <b>{d.absent}</b></span>
                      <span>Kasal <b>{d.sick}</b></span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {r.frequentlyAbsent.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ko&apos;p kelmagan bolalar (2 kun va undan ko&apos;p)</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {r.frequentlyAbsent.map((c) => (
                    <li key={c.name} className="flex justify-between py-2">
                      <span>{c.name}</span>
                      <b className="tabular-nums">{c.days} kun</b>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
