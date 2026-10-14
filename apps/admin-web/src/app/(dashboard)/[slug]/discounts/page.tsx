"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { BadgePercent, ChevronRight, Plus, UsersRound, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";
import { IosButton } from "@/components/ios/button";
import { PeriodStepper } from "@/components/ios/day-stepper";
import { SearchPill } from "@/components/ios/filters";
import { Segmented } from "@/components/ios/form";
import { Group, ListRow, Row } from "@/components/ios/group";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { currentMonth } from "@/features/cash/shared";
import { groupDigits, periodLabel, shiftPeriod } from "@/features/payments/shared";
import { DiscountAssistant } from "@/features/discounts/discount-assistant";
import { DiscountSheet } from "@/features/discounts/discount-sheet";
import { DISCOUNT_COLOR, matchesSearch, ruleLabel, type DiscountDashboard, type DiscountRow } from "@/features/discounts/shared";
import { useTr } from "@/i18n/tr";

type Filter = "discounted" | "review" | "all";

const PAGE = 50;
const GROUPS_PREVIEW = 5;

/**
 * Chegirmalar — bolalarga oylik to'lovdan chegirma (Sabot ERP'dagi bo'lim
 * asosida). Oy tanlanadi → jami chegirma, "Tez chegirma" (oilalar),
 * guruhlar kesimi va bolalar ro'yxati. Qator bosilsa — chegirma varag'i.
 * Super Admin faqat ko'radi; yozish — filial darajasidagi moliya rollari.
 */
export default function DiscountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const { branchId } = useBranchContext(slug);

  const [thisMonth, setThisMonth] = useState("");
  const [period, setPeriod] = useState("");
  const [filter, setFilter] = useState<Filter>("discounted");
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; childId: string | null }>({ open: false, childId: null });
  const listRef = useRef<HTMLDivElement>(null);

  // Toshkent oyi faqat brauzerda hisoblanadi
  useEffect(() => {
    const m = currentMonth();
    setThisMonth(m);
    setPeriod((p) => p || m);
  }, []);

  const query = useQuery({
    queryKey: ["discounts", slug, period, branchId],
    queryFn: () => api.get<DiscountDashboard>(`/app/discounts?period=${period}${branchId ? `&branchId=${branchId}` : ""}`),
    enabled: !!period,
  });
  const data = query.data;
  const loading = !period || query.isLoading;
  const summary = data?.summary;
  const rows = useMemo(() => data?.children ?? [], [data]);
  const curPeriod = data?.currentPeriod || thisMonth;

  // ?child=<id> — bola profilidan kelganda o'sha bolaning varag'i ochiladi (bir marta)
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !data) return;
    deepLinked.current = true;
    const childId = new URLSearchParams(window.location.search).get("child");
    if (childId && data.children.some((r) => r.childId === childId)) {
      setFilter("all");
      setSheet({ open: true, childId });
    }
  }, [data]);

  // Oy almashganda ro'yxat boshidan
  useEffect(() => {
    setLimit(PAGE);
    setGroup(null);
    setGroupsExpanded(false);
  }, [period]);
  useEffect(() => setLimit(PAGE), [filter, search, group]);

  const reviewCount = summary?.reviewCount ?? 0;
  const activeFilter: Filter = filter === "review" && reviewCount === 0 ? "discounted" : filter;
  const multiBranch = useMemo(() => new Set(rows.map((r) => r.branchId)).size > 1, [rows]);

  const inGroup = useMemo(() => (group ? rows.filter((r) => (r.groupId ?? "none") === group.id) : rows), [rows, group]);
  const counts = {
    discounted: inGroup.filter((r) => r.discount > 0).length,
    review: inGroup.filter((r) => r.status === "REVIEW").length,
    all: inGroup.length,
  };
  const visible = useMemo(
    () =>
      inGroup
        .filter((r) => (activeFilter === "discounted" ? r.discount > 0 : activeFilter === "review" ? r.status === "REVIEW" : true))
        .filter((r) => matchesSearch(r, search)),
    [inGroup, activeFilter, search],
  );

  const groups = useMemo(() => (data?.byGroup ?? []).filter((g) => g.discount > 0), [data]);
  const maxGroupDiscount = groups.reduce((m, g) => Math.max(m, g.discount), 0);
  const shownGroups = groupsExpanded ? groups : groups.slice(0, GROUPS_PREVIEW);

  const share = summary && summary.gross > 0 ? Math.round((summary.discount / summary.gross) * 100) : 0;
  const sheetRow = sheet.childId ? (rows.find((r) => r.childId === sheet.childId) ?? null) : null;

  const refresh = () => Promise.all([query.refetch(), queryClient.invalidateQueries({ queryKey: ["discount-suggestions", slug] })]);
  const showReview = () => {
    setFilter("review");
    setSearch("");
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const pickGroup = (id: string, name: string) => {
    setGroup((g) => (g?.id === id ? null : { id, name }));
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={BadgePercent}
          tint="pink"
          title={tr("Chegirmalar")}
          count={summary ? summary.discountedChildren : undefined}
          subtitle={tr("Bolalarga oylik to'lovdan chegirma")}
          actions={
            canWrite ? (
              <IosButton label={tr("Chegirma")} icon={Plus} variant="primary" compact disabled={!data} onClick={() => setSheet({ open: true, childId: null })} />
            ) : undefined
          }
        />

        {period && (
          <PeriodStepper
            onPrev={() => setPeriod((p) => shiftPeriod(p, -1))}
            onNext={() => setPeriod((p) => shiftPeriod(p, 1))}
            prevLabel={tr("Oldingi oy")}
            nextLabel={tr("Keyingi oy")}
            reset={thisMonth && period !== thisMonth ? { label: tr("Shu oy"), onClick: () => setPeriod(thisMonth) } : undefined}
          >
            {periodLabel(period, tr)}
          </PeriodStepper>
        )}

        {query.isError ? (
          <ErrorState message={(query.error as Error | null)?.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          <>
            {/* Jami */}
            <PageCard className="overflow-hidden">
              <div className="px-4 pb-3.5 pt-4">
                <span className="text-[13px] text-[#8e8e93]">{tr("Jami chegirma")}</span>
                {loading || !summary ? (
                  <span className="mt-2 block h-8 w-44 animate-pulse rounded-lg bg-[#767680]/[0.12]" />
                ) : (
                  <p className="mt-0.5 text-[30px] font-bold leading-tight tabular-nums" style={{ color: summary.discount > 0 ? DISCOUNT_COLOR : "var(--color-text)" }}>
                    {summary.discount > 0 ? "−" : ""}
                    {groupDigits(summary.discount)} <span className="text-[17px] font-semibold">{tr("so'm")}</span>
                  </p>
                )}
                <div className="mt-3 flex items-baseline justify-between gap-3 text-[13px] text-[#8e8e93]">
                  <span className="truncate">{tr("Kutilayotgan summadan ulushi")}</span>
                  {!loading && <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text)]">{share}%</span>}
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(share, 100)}%`, backgroundColor: DISCOUNT_COLOR }} />
                </div>
              </div>
              <span className="ml-4 block h-px bg-black/[0.08]" aria-hidden="true" />
              {loading || !summary ? (
                <div className="space-y-3 px-4 py-4" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="block h-4 animate-pulse rounded-full bg-[#767680]/[0.1]" />
                  ))}
                </div>
              ) : (
                <div>
                  <Row title={tr("Chegirmasiz")} value={`${groupDigits(summary.gross)} ${tr("so'm")}`} />
                  <Row
                    title={tr("To'lanadi")}
                    value={
                      <span className="font-semibold text-[var(--color-text)]">
                        {groupDigits(summary.net)} {tr("so'm")}
                      </span>
                    }
                  />
                  <Row
                    title={tr("Chegirmali bolalar")}
                    subtitle={summary.averageRate > 0 ? tr("o'rtacha {0}%", summary.averageRate) : undefined}
                    value={`${summary.discountedChildren} / ${summary.activeChildren}`}
                  />
                  {summary.reviewCount > 0 && (
                    <Row
                      title={tr("Katta chegirmalar")}
                      subtitle={tr("{0} va undan ortiq", groupDigits(summary.highImpactThreshold))}
                      value={<Pill color={IOS.orange}>{summary.reviewCount}</Pill>}
                      onClick={showReview}
                    />
                  )}
                </div>
              )}
            </PageCard>

            {/* Tez chegirma — oilalar */}
            {data && <DiscountAssistant slug={slug} period={period} branchId={branchId} canWrite={canWrite} currentPeriod={curPeriod} />}

            {/* Guruhlar kesimi */}
            <Group title={tr("Guruhlar kesimi")} bare={loading || groups.length === 0}>
              {loading ? (
                <SkeletonRows rows={3} avatar={false} />
              ) : groups.length === 0 ? (
                <EmptyState icon={UsersRound} title={tr("Bu oyda chegirmali guruh yo'q")} />
              ) : (
                <>
                  {shownGroups.map((g) => {
                    const active = group?.id === g.groupId;
                    const name = g.groupId === "none" ? tr("Guruhsiz") : tr(g.name);
                    return (
                      <div key={g.groupId} className="group/row relative">
                        <button
                          type="button"
                          onClick={() => pickGroup(g.groupId, name)}
                          aria-pressed={active}
                          className={clsx("flex w-full items-center gap-3 px-4 py-3 text-left", ROW_PRESS, active && "bg-[var(--color-primary)]/[0.06]")}
                        >
                          <IosIcon icon={UsersRound} tint="pink" size={30} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className={clsx("truncate text-[15px]", active ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]")}>{name}</span>
                              <span className="shrink-0 text-[15px] font-semibold tabular-nums" style={{ color: DISCOUNT_COLOR }}>
                                −{groupDigits(g.discount)}
                              </span>
                            </span>
                            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${maxGroupDiscount > 0 ? Math.max(4, Math.round((g.discount / maxGroupDiscount) * 100)) : 0}%`, backgroundColor: DISCOUNT_COLOR }}
                              />
                            </span>
                            <span className="mt-1 flex items-baseline justify-between gap-3 text-[12.5px] text-[#8e8e93]">
                              <span className="truncate">{tr("{0} / {1} bola chegirmali", g.discounted, g.children)}</span>
                              <span className="shrink-0 tabular-nums">{tr("o'rtacha {0}%", g.averageRate)}</span>
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
                        </button>
                        <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
                      </div>
                    );
                  })}
                  {!groupsExpanded && groups.length > GROUPS_PREVIEW && (
                    <div className="group/row relative">
                      <button
                        type="button"
                        onClick={() => setGroupsExpanded(true)}
                        className={clsx("flex min-h-[48px] w-full items-center px-4 text-left text-[15px] text-[var(--color-primary)]", ROW_PRESS)}
                      >
                        {tr("Yana {0} ta guruh", groups.length - GROUPS_PREVIEW)}
                      </button>
                      <span className={ROW_SEPARATOR} aria-hidden="true" />
                    </div>
                  )}
                </>
              )}
            </Group>

            {/* Bolalar */}
            <div ref={listRef} className="scroll-mt-4 space-y-3">
              <Segmented<Filter>
                value={activeFilter}
                onChange={setFilter}
                label={tr("Filtr")}
                options={[
                  { value: "discounted", label: `${tr("Chegirmali")} ${counts.discounted}` },
                  ...(reviewCount > 0 ? [{ value: "review" as const, label: `${tr("Katta")} ${counts.review}` }] : []),
                  { value: "all", label: `${tr("Hammasi")} ${counts.all}` },
                ]}
              />
              <SearchPill value={search} onChange={setSearch} placeholder={tr("Ism, ID yoki guruh")} />
              {group && (
                <button
                  type="button"
                  onClick={() => setGroup(null)}
                  className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-[var(--color-primary)]/[0.12] pl-3.5 pr-2.5 text-[13.5px] font-medium text-[var(--color-primary)] transition-transform active:scale-[0.96]"
                  aria-label={tr("Guruh filtrini olib tashlash")}
                >
                  <span className="truncate">{tr("Guruh: {0}", group.name)}</span>
                  <X className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                </button>
              )}

              <Group
                title={
                  <>
                    {tr("Bolalar")}
                    {!loading && <span className="tabular-nums"> · {visible.length}</span>}
                  </>
                }
                bare={loading || visible.length === 0}
                refreshing={query.isFetching && !query.isLoading}
              >
                {loading ? (
                  <SkeletonRows rows={6} />
                ) : visible.length === 0 ? (
                  search.trim() ? (
                    <EmptyState icon={UsersRound} title={tr("Hech kim topilmadi")} />
                  ) : activeFilter === "discounted" ? (
                    <EmptyState
                      icon={BadgePercent}
                      title={tr("Bu oyda chegirma yo'q")}
                      hint={canWrite ? tr("«Hammasi» bo'limidan bolani tanlab yoki «Chegirma» tugmasi bilan chegirma bering") : undefined}
                    />
                  ) : (
                    <EmptyState icon={UsersRound} title={tr("Bola yo'q")} />
                  )
                ) : (
                  visible.slice(0, limit).map((r) => <ChildRow key={r.childId} row={r} withBranch={multiBranch} onClick={() => setSheet({ open: true, childId: r.childId })} />)
                )}
              </Group>
              {visible.length > limit && (
                <button
                  type="button"
                  onClick={() => setLimit((n) => n + PAGE)}
                  className="h-11 w-full rounded-full bg-[#767680]/[0.12] text-[15px] font-medium text-[var(--color-primary)] transition-transform active:scale-[0.98]"
                >
                  {tr("Yana ko'rsatish")} · {visible.length - limit}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <DiscountSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        slug={slug}
        period={period || thisMonth}
        row={sheetRow}
        rows={rows}
        canWrite={canWrite}
        currentPeriod={curPeriod}
      />
    </div>
  );
}

/** Bola qatori: chegirma bo'lsa — to'lanadigan summa, eski narx ustidan chizilgan va qoida yorlig'i */
function ChildRow({ row: r, withBranch, onClick }: { row: DiscountRow; withBranch: boolean; onClick: () => void }) {
  const tr = useTr();
  const subtitle = [r.groupName ? tr(r.groupName) : tr("Guruhsiz"), withBranch ? r.branchName : null].filter(Boolean).join(" · ");
  const ended = !!r.rule && !r.rule.isActive;

  let meta;
  if (r.discount > 0) {
    const label = r.rule ? ruleLabel(r.rule, tr) : `${Math.round(r.rate * 100)}%`;
    meta = (
      <span className="flex flex-col items-end gap-0.5 leading-tight">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[12px] tabular-nums text-[#8e8e93] line-through max-sm:hidden">{groupDigits(r.gross)}</span>
          <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{groupDigits(r.net)}</span>
        </span>
        <span className="flex items-center gap-1">
          {r.status === "REVIEW" && (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full sm:hidden" style={{ backgroundColor: IOS.orange }} title={tr("Katta")} />
              <span className="max-sm:hidden">
                <Pill color={IOS.orange}>{tr("Katta")}</Pill>
              </span>
            </>
          )}
          {ended && (
            <span className="max-sm:hidden">
              <Pill color={IOS.gray}>{tr("tugagan")}</Pill>
            </span>
          )}
          <Pill color={ended ? IOS.gray : DISCOUNT_COLOR}>{label}</Pill>
        </span>
      </span>
    );
  } else {
    meta = <span className="text-[15px] tabular-nums text-[#8e8e93]">{r.gross > 0 ? groupDigits(r.gross) : "—"}</span>;
  }

  return <ListRow onClick={onClick} avatar={<IosAvatar name={r.fullName} size={40} />} title={r.fullName} subtitle={subtitle} meta={meta} />;
}
