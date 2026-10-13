"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Download, Plus, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { IosButton } from "@/components/ios/button";
import { PeriodStepper } from "@/components/ios/day-stepper";
import { ChipRow, IosChip } from "@/components/ios/filters";
import { Group, Row } from "@/components/ios/group";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_PRESS, ROW_SEPARATOR, SECTION_TITLE } from "@/components/ios/tokens";
import { currentMonth, todayTashkent } from "@/features/cash/shared";
import { categoryMeta, type ExpensesMonth } from "@/features/expenses/categories";
import { CategoryTile, ExpenseSheet, expenseDayLabel, type ExpenseSheetRequest } from "@/features/expenses/expense-sheet";
import { METHOD_LABEL, groupDigits, periodLabel, shiftPeriod } from "@/features/payments/shared";
import { ReportSheet } from "@/features/reports/report-sheet";
import { useTr } from "@/i18n/tr";

/**
 * Xarajatlar — Sabot ERP uslubida. Oy tanlanadi: tepada oylik jami (o'tgan oy
 * bilan solishtirish, naqd qismi), turkumlar ulushi chizig'i va turkumlar
 * ro'yxati (bosilsa ro'yxat shu turkumga filtrlanadi), pastda kunlar bo'yicha
 * xarajatlar. Qator bosilsa — tafsilot varag'i (tahrirlash, o'chirish).
 */
export default function ExpensesPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [thisMonth, setThisMonth] = useState("");
  const [today, setToday] = useState("");
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ExpenseSheetRequest>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    const m = currentMonth();
    setThisMonth(m);
    setToday(todayTashkent());
    setMonth((v) => v || m);
  }, []);

  const query = useQuery({
    queryKey: ["expenses", slug, month],
    queryFn: () => api.get<ExpensesMonth>(`/app/cash/expenses?month=${month}`),
    enabled: !!month,
  });
  const data = query.data;
  const loading = !month || query.isLoading;

  // Oy almashganda turkum filtri tozalanadi
  useEffect(() => setFilter(null), [month]);

  const items = useMemo(() => (data?.items ?? []).filter((i) => !filter || i.category === filter), [data, filter]);
  const days = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const i of items) map.set(i.date, [...(map.get(i.date) ?? []), i]);
    return [...map.entries()];
  }, [items]);

  const diff = data && data.prevTotal > 0 ? Math.round(((data.total - data.prevTotal) / data.prevTotal) * 100) : null;
  // Bu oy uchun yangi xarajat sanasi: joriy oy — bugun, o'tgan oy — oyning oxirgi kuni
  const newDate = () => {
    if (!month || month >= thisMonth) return today;
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  };

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={() => query.refetch()} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={ReceiptText}
          tint="orange"
          title={tr("Xarajatlar")}
          count={data ? tr("{0} ta", data.items.length) : undefined}
          subtitle={tr("Oziq-ovqat, kommunal, ta'mirlash va boshqa chiqimlar")}
          actions={
            <div className="flex items-center gap-2">
              <IosButton label={tr("Hisobot")} icon={Download} compact onClick={() => setReportOpen(true)} />
              <IosButton label={tr("Qo'shish")} icon={Plus} variant="primary" compact onClick={() => setSheet({ kind: "new", date: newDate() })} />
            </div>
          }
        />

        {month && (
          <PeriodStepper
            onPrev={() => setMonth((m) => shiftPeriod(m, -1))}
            onNext={() => setMonth((m) => shiftPeriod(m, 1))}
            nextDisabled={month >= thisMonth}
            prevLabel={tr("Oldingi oy")}
            nextLabel={tr("Keyingi oy")}
            reset={month !== thisMonth ? { label: tr("Shu oy"), onClick: () => setMonth(thisMonth) } : undefined}
          >
            {periodLabel(month, tr)}
          </PeriodStepper>
        )}

        {query.isError && !data ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : (
          <>
            {/* Oylik jami va turkumlar */}
            <section>
              <h3 className={SECTION_TITLE}>{tr("Oylik xarajat")}</h3>
              <div className={GROUP_BLOCK}>
                <div className="px-4 pb-4 pt-3.5">
                  {loading || !data ? (
                    <span className="block h-9 w-44 animate-pulse rounded-[10px] bg-[#767680]/[0.12]" />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)]">
                        {groupDigits(data.total)} <span className="text-[17px] font-semibold text-[#8e8e93]">{tr("so'm")}</span>
                      </span>
                      {diff !== null && diff !== 0 && (
                        <Pill color={diff > 0 ? IOS.red : IOS.green} title={tr("O'tgan oyga nisbatan")}>
                          {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}%
                        </Pill>
                      )}
                    </div>
                  )}
                  {data && (
                    <p className="mt-2 text-[13px] text-[#8e8e93] tabular-nums">
                      {[
                        `${tr("naqd")} ${groupDigits(data.cashTotal)}`,
                        data.total - data.cashTotal > 0 ? `${tr("boshqa usulda")} ${groupDigits(data.total - data.cashTotal)}` : null,
                        data.prevTotal > 0 ? `${tr("o'tgan oy")} ${groupDigits(data.prevTotal)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {data && data.total > 0 && (
                    <div className="mt-4 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
                      {data.byCategory.map((c) => (
                        <span key={c.category} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(c.total / data.total) * 100}%`, backgroundColor: categoryMeta(c.category).color }} />
                      ))}
                    </div>
                  )}
                </div>
                {data &&
                  data.byCategory.map((c) => {
                    const active = filter === c.category;
                    return (
                      <div key={c.category} className="group/row relative">
                        <button
                          type="button"
                          onClick={() => setFilter(active ? null : c.category)}
                          aria-pressed={active}
                          className={clsx("flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS, active && "bg-[#767680]/[0.08]")}
                        >
                          <CategoryTile category={c.category} />
                          <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--color-text)]">
                            {tr(c.category)} <span className="text-[13px] text-[#8e8e93]">· {tr("{0} ta", c.count)}</span>
                          </span>
                          <span className="text-[13px] tabular-nums text-[#8e8e93] max-sm:hidden">{Math.round((c.total / data.total) * 100)}%</span>
                          <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-[var(--color-text)] sm:w-[120px]">{groupDigits(c.total)}</span>
                        </button>
                        <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
                      </div>
                    );
                  })}
              </div>
            </section>

            {data && data.byCategory.length > 1 && (
              <ChipRow label={tr("Turkum")}>
                <IosChip active={!filter} onClick={() => setFilter(null)} count={data.items.length}>
                  {tr("Hammasi")}
                </IosChip>
                {data.byCategory.map((c) => (
                  <IosChip key={c.category} active={filter === c.category} onClick={() => setFilter(c.category)} count={c.count}>
                    {tr(c.category)}
                  </IosChip>
                ))}
              </ChipRow>
            )}

            {/* Kunlar bo'yicha ro'yxat */}
            {loading ? (
              <Group title={tr("Xarajatlar")} bare>
                <SkeletonRows rows={4} />
              </Group>
            ) : !data || data.items.length === 0 ? (
              <PageCard className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#8e8e93] text-white">
                  <ReceiptText className="h-6 w-6" strokeWidth={2} />
                </span>
                <p className="mt-3 text-[17px] font-semibold text-[var(--color-text)]">{tr("Bu oyda xarajat yozilmagan")}</p>
                <p className="mt-1 max-w-xs text-[14px] leading-snug text-[#8e8e93]">{tr("Oziq-ovqat, kommunal to'lov yoki ta'mirlashni yozing — oylik foyda to'g'ri chiqadi.")}</p>
                <div className="mt-4">
                  <IosButton label={tr("Birinchisini qo'shish")} icon={Plus} variant="primary" onClick={() => setSheet({ kind: "new", date: newDate() })} />
                </div>
              </PageCard>
            ) : (
              days.map(([date, rows]) => (
                <Group
                  key={date}
                  title={
                    <>
                      {today ? expenseDayLabel(date, tr, today) : date}
                      <span className="tabular-nums"> · {groupDigits(rows.reduce((s, r) => s + r.amount, 0))}</span>
                    </>
                  }
                >
                  {rows.map((r) => (
                    <Row
                      key={r.id}
                      onClick={() => setSheet({ kind: "view", expense: r })}
                      leading={<CategoryTile category={r.category} />}
                      title={r.note || tr(r.category)}
                      subtitle={[r.note ? tr(r.category) : null, tr(METHOD_LABEL[r.method]), r.createdByName].filter(Boolean).join(" · ")}
                      value={<span className="font-semibold text-[var(--color-text)]">{groupDigits(r.amount)}</span>}
                    />
                  ))}
                </Group>
              ))
            )}
          </>
        )}
      </div>

      <ExpenseSheet request={sheet} onClose={() => setSheet(null)} />
      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        period={month || undefined}
        title="Xarajatlar hisoboti"
        endpoint="/app/cash/expenses-report"
        filePrefix="xarajatlar-hisoboti"
        allHint="Boshidan bugungacha barcha xarajatlar"
        contents="Hisobotda: jami xarajat, naqd va boshqa usuldagi qismi, o'tgan davr bilan solishtirish, turkumlar, usullar va kunlar bo'yicha, batafsil ro'yxat (chek bor-yo'qligi bilan)."
      />
    </div>
  );
}
