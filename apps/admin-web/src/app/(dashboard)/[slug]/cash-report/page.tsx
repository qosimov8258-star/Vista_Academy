"use client";

import { TopbarAction } from "@/components/layout/topbar-action";
import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { METHODS, METHOD_LABEL, saveCsv, todayTashkent, type CashReport } from "@/features/cash/shared";
import { useTr } from "@/i18n/tr";

function Tile({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  const tr = useTr();
  return (
    <Card className="p-4">
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr(label)}</p>
      <p
        className={`mt-1 text-[20px] font-semibold tabular-nums ${
          tone === "danger" ? "text-[var(--color-danger)]" : tone === "success" ? "text-[var(--color-success)]" : "text-[var(--color-text)]"
        }`}
      >
        {tr(value)}
      </p>
    </Card>
  );
}

export default function CashReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [month, setMonth] = useState("");
  useEffect(() => setMonth((m) => m || todayTashkent().slice(0, 7)), []);

  const query = useQuery({
    queryKey: ["cash-report", slug, month],
    queryFn: () => api.get<CashReport>(`/app/cash/report?month=${month}`),
    enabled: !!month,
  });
  const r = query.data;
  const maxDay = Math.max(1, ...(r?.days.map((d) => d.total) ?? [1]));

  const exportCsv = () => {
    if (!r) return;
    saveCsv(`kassa-hisobot-${r.month}.csv`, [
      [tr("Oy"), r.month],
      ["Hisoblangan", r.billed],
      [tr("Yig'ilgan"), r.collected],
      ["Qaytarilgan", r.refundTotal],
      ["Xarajat", r.expensesTotal],
      [tr("Ish haqi (to'langan)"), r.salaryPaid],
      [tr("Ish haqi (to'lanmagan)"), r.salaryUnpaid],
      ["Sof natija", r.net],
      ["Qarz", r.debt],
      [],
      ["Usul", "Soni", "Summa"],
      ...METHODS.map((m) => [METHOD_LABEL[m], r.byMethod[m].count, r.byMethod[m].total]),
      [],
      [tr("Sana"), "Kirim"],
      ...r.days.map((d) => [d.date, d.total]),
      [],
      ["Xarajat turi", "Summa"],
      ...r.expensesByCategory.map((e) => [e.category, e.total]),
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Oylik hisobot")}</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">{tr("Kirim, qarz, xarajat va o'qituvchilar ish haqi")}</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-[170px]">
            <Input label={tr("Oy")} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="hidden md:block">
            <Button variant="outline" onClick={exportCsv} disabled={!r}>
              {tr("Eksport (CSV)")}
            </Button>
          </div>
          <TopbarAction>
            <Button variant="outline" onClick={exportCsv} disabled={!r}>
              {tr("Eksport (CSV)")}
            </Button>
          </TopbarAction>
        </div>
      </div>

      {!month || query.isLoading ? (
        <LoadingState rows={5} />
      ) : query.isError ? (
        <ErrorState message={tr((query.error as Error).message)} />
      ) : r ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile label={tr("Hisoblangan (hisob-fakturalar)")} value={formatMoney(r.billed)} />
            <Tile label={tr("Yig'ilgan")} value={formatMoney(r.collected)} tone="success" />
            <Tile label={tr("Qolgan qarz")} value={formatMoney(r.debt)} tone={r.debt > 0 ? "danger" : undefined} />
            <Tile label={tr("Qaytarilgan")} value={formatMoney(r.refundTotal)} />
            <Tile label={tr("Xarajat")} value={formatMoney(r.expensesTotal)} />
            <Tile label={tr("O'qituvchilar ish haqi (to'langan)")} value={formatMoney(r.salaryPaid)} />
            <Tile label={tr("Ish haqi (hali to'lanmagan)")} value={formatMoney(r.salaryUnpaid)} tone={r.salaryUnpaid > 0 ? "danger" : undefined} />
            <Tile label={tr("Sof natija")} value={formatMoney(r.net)} tone={r.net < 0 ? "danger" : "success"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tr("To'lov usullari")}</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
              {METHODS.map((m) => (
                <span key={m}>
                  {tr(METHOD_LABEL[m])}: <b className="tabular-nums">{formatMoney(r.byMethod[m].total)}</b>{" "}
                  <span className="text-[var(--color-text-muted)]">({tr(r.byMethod[m].count)})</span>
                </span>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr("Kunlar bo'yicha kirim")}</CardTitle>
            </CardHeader>
            <CardBody>
              {r.days.length === 0 ? (
                <EmptyState title={tr("Bu oyda to'lov yo'q")} />
              ) : (
                <ul className="space-y-1.5 text-[13px]">
                  {r.days.map((d) => (
                    <li key={d.date} className="flex items-center gap-3">
                      <span className="w-[88px] shrink-0 tabular-nums text-[var(--color-text-muted)]">{d.date.slice(5)}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                        <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${(d.total / maxDay) * 100}%` }} />
                      </span>
                      <span className="w-[130px] shrink-0 text-right tabular-nums">{formatMoney(d.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {r.expensesByCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Xarajatlar turi bo'yicha")}</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {r.expensesByCategory.map((e) => (
                    <li key={e.category} className="flex justify-between py-2">
                      <span>{tr(e.category)}</span>
                      <b className="tabular-nums">{formatMoney(e.total)}</b>
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
