"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw, UsersRound, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { IosButton } from "@/components/ios/button";
import { PeriodStepper } from "@/components/ios/day-stepper";
import { SearchPill } from "@/components/ios/filters";
import { Segmented } from "@/components/ios/form";
import { Group, ListRow } from "@/components/ios/group";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS } from "@/components/ios/tokens";
import { currentMonth } from "@/features/cash/shared";
import { PaymentSheet, type PaymentSheetChild } from "@/features/payments/payment-sheet";
import { groupDigits, periodLabel, shiftPeriod, type PeriodChild, type PeriodGroup } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";

type Filter = "all" | "debt" | "paid";

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const rateColor = (rate: number) => (rate >= 80 ? IOS.green : rate >= 50 ? IOS.orange : IOS.red);
const hasDebt = (c: PeriodChild) => c.state === "PARTIAL" || c.state === "OVERDUE" || c.totalDebt > 0.5;

/**
 * To'lovlar — to'lov qabul qilishning asosiy sahifasi (Sabot ERP uslubida).
 * Oy tanlanadi → guruh → bola qatori bosiladi → to'lov varag'i. Yuqoridagi
 * qidiruv bilan bola ismi, ID yoki guruh bo'yicha darhol topiladi.
 * Keng ekranda (xl) chapda oy/guruhlar, o'ngda tanlangan guruh; torroqda ikki ekran.
 * `?child=<id>` bilan ochilsa (qarzdorlar, bola sahifasi) varaq o'zi ochiladi.
 */
export default function PaymentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [thisMonth, setThisMonth] = useState("");
  const [period, setPeriod] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sheetChild, setSheetChild] = useState<PaymentSheetChild | null>(null);
  const [deepLinkChild, setDeepLinkChild] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Toshkent oyi va URL parametrlari faqat brauzerda o'qiladi
  useEffect(() => {
    const m = currentMonth();
    setThisMonth(m);
    setPeriod((p) => p || m);
    const query = new URLSearchParams(window.location.search);
    if (query.get("group")) setGroupId(query.get("group"));
    if (query.get("child")) setDeepLinkChild(query.get("child"));
  }, []);

  const groupsQuery = useQuery({
    queryKey: ["pay-groups", slug, period],
    queryFn: () => api.get<{ groups: PeriodGroup[] }>(`/app/cash/groups?period=${period}`),
    enabled: !!period,
  });
  const childrenQuery = useQuery({
    queryKey: ["pay-children", slug, period],
    queryFn: () => api.get<{ children: PeriodChild[] }>(`/app/cash/children?period=${period}`),
    enabled: !!period,
  });
  const groups = useMemo(() => groupsQuery.data?.groups.filter((g) => g.total > 0) ?? [], [groupsQuery.data]);
  const children = useMemo(() => childrenQuery.data?.children ?? [], [childrenQuery.data]);
  const loading = !period || groupsQuery.isLoading || childrenQuery.isLoading;
  const failed = groupsQuery.isError || childrenQuery.isError;

  // Qarzdorlar / bola sahifasidan kelinganda varaq o'zi ochiladi
  useEffect(() => {
    if (!deepLinkChild || !childrenQuery.data) return;
    const found = children.find((c) => c.childId === deepLinkChild);
    setSheetChild({ id: deepLinkChild, name: found?.childName ?? tr("Bola") });
    if (found) setGroupId(found.groupId ?? "none");
    setDeepLinkChild(null);
  }, [deepLinkChild, childrenQuery.data, children, tr]);

  const totals = useMemo(() => {
    const t = { billed: 0, collected: 0, paid: 0, partial: 0, overdue: 0, none: 0 };
    for (const g of groups) {
      t.billed += g.billed;
      t.collected += g.collected;
      t.paid += g.paid;
      t.partial += g.partial;
      t.overdue += g.overdue;
      t.none += g.none;
    }
    return t;
  }, [groups]);
  const debtors = children.filter(hasDebt).length;
  const rate = pct(totals.collected, totals.billed);

  const query = search.trim().toLowerCase();
  const results = useMemo(() => {
    if (query.length < 2) return [];
    return children
      .filter((c) => c.childName.toLowerCase().includes(query) || String(c.publicId ?? "").includes(query) || (c.groupName ?? "").toLowerCase().includes(query))
      .slice(0, 40);
  }, [children, query]);

  const group = groups.find((g) => g.groupId === groupId) ?? null;
  const groupChildren = useMemo(
    () => children.filter((c) => (groupId === "none" ? !c.groupId : c.groupId === groupId)),
    [children, groupId],
  );
  const counts = { all: groupChildren.length, debt: groupChildren.filter(hasDebt).length, paid: groupChildren.filter((c) => c.state === "PAID").length };
  const shownChildren = groupChildren.filter((c) => (filter === "debt" ? hasDebt(c) : filter === "paid" ? c.state === "PAID" : true));

  const refresh = () => Promise.all([groupsQuery.refetch(), childrenQuery.refetch()]);
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };
  const openChild = (c: PeriodChild) => setSheetChild({ id: c.childId, name: c.childName, monthlyFee: c.monthlyFee });

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-2">
        <PageHeaderCard
          icon={Wallet}
          tint="green"
          title={tr("To'lovlar")}
          count={childrenQuery.data ? tr("qarzdor: {0}", debtors) : undefined}
          subtitle={tr("Oy bo'yicha to'lov qabul qilish")}
          actions={<IosButton label={tr("Yangilash")} icon={RefreshCw} compact onClick={onRefresh} loading={refreshing} />}
        />

        {failed ? (
          <ErrorState message={((groupsQuery.error ?? childrenQuery.error) as Error | null)?.message} onRetry={() => void refresh()} retrying={groupsQuery.isFetching} />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:items-start">
            {/* Chap ustun: oy, jami, qidiruv, guruhlar */}
            <div className={groupId ? "space-y-5 max-xl:hidden" : "space-y-5"}>
              {period && (
                <PeriodStepper
                  onPrev={() => setPeriod((p) => shiftPeriod(p, -1))}
                  onNext={() => setPeriod((p) => shiftPeriod(p, 1))}
                  prevLabel={tr("Oldingi oy")}
                  nextLabel={tr("Keyingi oy")}
                  reset={period !== thisMonth ? { label: tr("Shu oy"), onClick: () => setPeriod(thisMonth) } : undefined}
                >
                  {periodLabel(period, tr)}
                </PeriodStepper>
              )}

              <PageCard className="px-4 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-[#8e8e93]">{tr("Qabul qilindi")}</span>
                  {!loading && totals.billed > 0 && (
                    <span className="text-[15px] font-semibold tabular-nums" style={{ color: rateColor(rate) }}>
                      {rate}%
                    </span>
                  )}
                </div>
                {loading ? (
                  <span className="mt-2 block h-7 w-40 animate-pulse rounded-lg bg-[#767680]/[0.12]" />
                ) : (
                  <p className="mt-1 text-[22px] font-bold tabular-nums text-[var(--color-text)]">
                    {groupDigits(totals.collected)}
                    <span className="text-[15px] font-medium text-[#8e8e93]">
                      {" "}
                      / {groupDigits(totals.billed)} {tr("so'm")}
                    </span>
                  </p>
                )}
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${rate}%`, backgroundColor: rateColor(rate) }} />
                </div>
                {!loading && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Pill color={IOS.green}>{tr("{0} to'lagan", totals.paid)}</Pill>
                    {totals.partial > 0 && <Pill color={IOS.orange}>{tr("{0} kutilmoqda", totals.partial)}</Pill>}
                    {totals.overdue > 0 && <Pill color={IOS.red}>{tr("{0} muddati o'tgan", totals.overdue)}</Pill>}
                    {totals.none > 0 && <Pill color={IOS.gray}>{tr("{0} hisob yo'q", totals.none)}</Pill>}
                  </div>
                )}
              </PageCard>

              <SearchPill value={search} onChange={setSearch} placeholder={tr("Bola ismi, ID yoki guruh")} />

              {query.length >= 2 ? (
                <Group title={tr("Qidiruv natijasi")} bare={results.length === 0}>
                  {results.length === 0 ? (
                    <EmptyState icon={UsersRound} title={tr("Hech kim topilmadi")} />
                  ) : (
                    results.map((c) => <ChildRow key={c.childId} child={c} withGroup onClick={() => openChild(c)} />)
                  )}
                </Group>
              ) : (
                <Group
                  title={
                    <>
                      {tr("Guruhlar")}
                      {!loading && <span className="tabular-nums"> · {groups.length}</span>}
                    </>
                  }
                  bare={loading || groups.length === 0}
                >
                  {loading ? (
                    <SkeletonRows rows={5} />
                  ) : groups.length === 0 ? (
                    <EmptyState icon={UsersRound} title={tr("Guruh yo'q")} />
                  ) : (
                    groups.map((g) => {
                      const debtCount = children.filter((c) => (g.groupId === "none" ? !c.groupId : c.groupId === g.groupId) && hasDebt(c)).length;
                      const gRate = pct(g.collected, g.billed);
                      return (
                        <ListRow
                          key={g.groupId}
                          onClick={() => {
                            setGroupId(g.groupId);
                            setFilter("all");
                          }}
                          avatar={<RateRing rate={g.billed > 0 ? gRate : null} active={g.groupId === groupId} />}
                          title={tr(g.name)}
                          subtitle={`${groupDigits(g.collected)} / ${groupDigits(g.billed)} ${tr("so'm")}`}
                          meta={debtCount > 0 ? <Pill color={IOS.red}>{debtCount}</Pill> : undefined}
                        />
                      );
                    })
                  )}
                </Group>
              )}
            </div>

            {/* O'ng ustun: tanlangan guruh */}
            <div className={groupId ? "space-y-5" : "space-y-5 max-xl:hidden"}>
              {!groupId || !group ? (
                <PageCard className="py-6">
                  {loading ? <SkeletonRows rows={6} /> : <EmptyState icon={UsersRound} title={tr("Guruhni tanlang")} hint={tr("Chapdagi ro'yxatdan guruhni tanlang yoki bolani qidiring")} />}
                </PageCard>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setGroupId(null)}
                    className="-mb-2 flex items-center gap-0.5 text-[16px] text-[var(--color-primary)] transition-opacity active:opacity-50 xl:hidden"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
                    {tr("Guruhlar")}
                  </button>
                  <PageCard className="flex items-center gap-4 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[20px] font-bold text-[var(--color-text)]">{tr(group.name)}</h2>
                      <p className="mt-0.5 text-[13px] tabular-nums text-[#8e8e93]">
                        {periodLabel(period, tr)} · {groupDigits(group.collected)} / {groupDigits(group.billed)} {tr("so'm")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[28px] font-bold tabular-nums" style={{ color: rateColor(pct(group.collected, group.billed)) }}>
                      {pct(group.collected, group.billed)}%
                    </span>
                  </PageCard>
                  <Segmented<Filter>
                    value={filter}
                    onChange={setFilter}
                    label={tr("Filtr")}
                    options={[
                      { value: "all", label: `${tr("Hammasi")} ${counts.all}` },
                      { value: "debt", label: `${tr("Qarzdor")} ${counts.debt}` },
                      { value: "paid", label: `${tr("To'lagan")} ${counts.paid}` },
                    ]}
                  />
                  <Group bare={shownChildren.length === 0} refreshing={childrenQuery.isFetching && !childrenQuery.isLoading && !refreshing}>
                    {shownChildren.length === 0 ? (
                      <EmptyState icon={UsersRound} title={filter === "debt" ? tr("Qarzdor yo'q") : tr("Bola yo'q")} />
                    ) : (
                      shownChildren.map((c) => <ChildRow key={c.childId} child={c} onClick={() => openChild(c)} />)
                    )}
                  </Group>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <PaymentSheet
        slug={slug}
        child={sheetChild}
        period={period || undefined}
        onClose={() => {
          setSheetChild(null);
          void queryClient.invalidateQueries({ queryKey: ["pay-children", slug] });
        }}
      />
    </div>
  );
}

/** Bola qatori: o'ngda shu oy holati (to'langan / −qarz) */
function ChildRow({ child: c, withGroup = false, onClick }: { child: PeriodChild; withGroup?: boolean; onClick: () => void }) {
  const tr = useTr();
  const older = c.totalDebt - c.remaining;
  const subtitle = [
    c.publicId ? `ID ${c.publicId}` : null,
    withGroup ? (c.groupName ? tr(c.groupName) : tr("Guruhsiz")) : null,
    // NONE holatida eski qarz o'ngda ko'rinadi — ikki marta yozilmasin
    c.state !== "NONE" && older > 0.5 ? `${tr("eski qarz")} ${groupDigits(older)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let meta;
  if (c.state === "PAID") {
    meta = <Pill color={IOS.green}>{tr("To'langan")} ✓</Pill>;
  } else if (c.state === "NONE") {
    meta =
      c.totalDebt > 0.5 ? (
        <DebtValue amount={c.totalDebt} color={IOS.red} label={tr("eski qarz")} />
      ) : c.monthlyFee ? (
        // Hisob-faktura hali yo'q — guruh narxi (qarz emas, shuning uchun minussiz)
        <span className="flex flex-col items-end leading-tight">
          <span className="text-[15px] font-semibold tabular-nums text-[#8e8e93]">{groupDigits(c.monthlyFee)}</span>
          <span className="text-[12px] text-[#8e8e93]">{tr("hisob yo'q")}</span>
        </span>
      ) : (
        <Pill color={IOS.gray}>{tr("Hisob yo'q")}</Pill>
      );
  } else {
    // PARTIAL — muddati hali o'tmagan qarz: hech narsa to'lanmagan bo'lsa "Kutilmoqda"
    const label = c.state === "OVERDUE" ? tr("Muddati o'tgan") : c.paid > 0 ? tr("Qisman") : tr("Kutilmoqda");
    meta = <DebtValue amount={c.remaining} color={c.state === "OVERDUE" ? IOS.red : IOS.orange} label={label} />;
  }
  return <ListRow onClick={onClick} avatar={<IosAvatar name={c.childName} size={40} />} title={c.childName} subtitle={subtitle || undefined} meta={meta} />;
}

function DebtValue({ amount, color, label }: { amount: number; color: string; label: string }) {
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
        −{groupDigits(amount)}
      </span>
      <span className="text-[12px] text-[#8e8e93]">{label}</span>
    </span>
  );
}

/** Guruh yig'ilish darajasi halqasi (40px); `null` — shu oy hisob-faktura yo'q */
function RateRing({ rate, active }: { rate: number | null; active: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(118,118,128,0.14)" strokeWidth="4" />
        {rate !== null && rate > 0 && (
          <circle cx="18" cy="18" r={r} fill="none" stroke={rateColor(rate)} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(rate / 100) * c} ${c}`} />
        )}
      </svg>
      <span className={`absolute text-[10.5px] font-semibold tabular-nums ${active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>{rate ?? "—"}</span>
    </span>
  );
}
