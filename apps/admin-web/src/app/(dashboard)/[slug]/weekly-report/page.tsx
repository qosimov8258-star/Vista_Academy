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
import { useTr } from "@/i18n/tr";
import { useAuth } from "@/lib/use-auth";

function shift(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function WeeklyReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  // Pul bilan bog'liq ko'rsatkichlar moliyachining ishi — filial admini va call operatorga ko'rsatilmaydi
  const showMoney = user?.role !== "BRANCH_ADMIN" && user?.role !== "MANAGER";
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
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr(label)}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--color-text)]">{tr(value)}</p>
      {hint && <p className="text-[12px] text-[var(--color-text-muted)]">{tr(hint)}</p>}
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Haftalik hisobot")}</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">{tr(showMoney ? "Direktorga: bolalar, davomat, qarz va arizalar" : "Bolalar, davomat va arizalar")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setFrom((f) => shift(f, -7))}>
            {tr("← Oldingi hafta")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFrom((f) => shift(f, 7))}>
            {tr("Keyingi hafta →")}
          </Button>
          <div className="hidden md:block">
            <Button onClick={() => window.print()}>{tr("Chop etish / PDF")}</Button>
          </div>
        </div>
        <TopbarAction>
          <Button onClick={() => window.print()}>{tr("Chop etish / PDF")}</Button>
        </TopbarAction>
      </div>

      {!from || query.isLoading ? (
        <LoadingState rows={5} />
      ) : query.isError ? (
        <ErrorState message={tr((query.error as Error).message)} />
      ) : r ? (
        <>
          <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
            {tr("Hafta:")}{" "}{formatDate(r.from)} — {formatDate(r.to)}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tile("Faol bolalar", r.children)}
            {tile("Davomat", r.attendancePercent === null ? "—" : `${r.attendancePercent}%`, "kelganlar ulushi")}
            {showMoney && tile(tr("Yig'ilgan to'lov"), formatMoney(r.collected))}
            {showMoney && tile("Jami qarz", formatMoney(r.totalDebt), tr("{0} ta qarzdor", r.debtorsCount))}
            {showMoney && tile(tr("Muddati o'tgan qarz"), formatMoney(r.overdueDebt))}
            {tile(tr("Yangi arizalar"), r.newLeads, tr("{0} tasi qabul qilindi", r.wonLeads))}
            {tile(tr("Xodimlar yo'qligi"), r.staffAbsences, tr("kun (kelmadi/kasal/ta'til)"))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tr("Kunlar bo'yicha davomat")}</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-5">
                {r.daily.map((d, dayIndex) => (
                  <section key={d.date}>
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-1.5">
                      <h3 className="text-[14px] font-semibold tabular-nums text-[var(--color-text)]">{formatDate(d.date)}</h3>
                      <span className="flex gap-3 text-[12.5px] tabular-nums text-[var(--color-text-muted)]">
                        <span>{tr("Keldi")}{" "}<b>{tr(d.present)}</b></span>
                        <span>{tr("Kelmadi")}{" "}<b>{tr(d.absent)}</b></span>
                        <span>{tr("Kasal")}{" "}<b>{tr(d.sick)}</b></span>
                      </span>
                    </div>
                    {r.groups.length === 0 ? (
                      <p className="py-2 text-[13px] text-[var(--color-text-muted)]">{tr("Guruh yo'q")}</p>
                    ) : (
                      <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                        {r.groups.map((g) => {
                          const day = g.daily[dayIndex];
                          return (
                            <li key={g.id} className="flex items-start justify-between gap-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[var(--color-text)]">{tr(g.name)}</p>
                                <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                                  {tr("{0} ta bola", g.childrenCount)} ·{" "}
                                  {g.teachers.length > 0 ? g.teachers.join(", ") : tr("Tarbiyachi biriktirilmagan")}
                                </p>
                              </div>
                              <span className="flex shrink-0 gap-3 text-[13px] tabular-nums">
                                <span>{tr("Keldi")}{" "}<b>{day?.present ?? 0}</b></span>
                                <span>{tr("Kelmadi")}{" "}<b>{day?.absent ?? 0}</b></span>
                                <span>{tr("Kasal")}{" "}<b>{day?.sick ?? 0}</b></span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </CardBody>
          </Card>

          {r.frequentlyAbsent.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Ko'p kelmagan bolalar (2 kun va undan ko'p)")}</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {r.frequentlyAbsent.map((c) => (
                    <li key={c.name} className="flex justify-between py-2">
                      <span>{tr(c.name)}</span>
                      <b className="tabular-nums">{tr(c.days)} {tr("kun")}</b>
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
