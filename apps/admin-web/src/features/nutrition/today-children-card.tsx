"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useTr } from "@/i18n/tr";

interface GroupRow {
  groupId: string | null;
  name: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  sick: number;
  notMarked: number;
}

interface TodaySummary {
  date: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  sick: number;
  notMarked: number;
  mealCount: number;
  staff: { total: number; present: number; late: number; absent: number; notMarked: number };
  staffMealCount: number;
  totalMealCount: number;
  groups: GroupRow[];
}

/**
 * Bugun nechta bolaga ovqat tayyorlash kerakligi — tarbiyachilar belgilagan
 * davomatdan olinadi (keldi + kechikdi). Davomat kelib tushgan sari yangilanadi.
 */
export function TodayChildrenCard({ slug, branchId, today }: { slug: string; branchId: string; today: string }) {
  const tr = useTr();
  const query = useQuery({
    queryKey: ["menu-today-summary", slug, branchId, today],
    queryFn: () => api.get<TodaySummary>(`/app/menu/today-summary?branchId=${branchId}&date=${today}`),
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("Bugungi bolalar soni")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 text-[14px] text-[var(--color-text)]">
        {query.isLoading ? (
          <LoadingState rows={2} />
        ) : query.isError ? (
          <ErrorState message={tr((query.error as Error).message)} />
        ) : query.data ? (
          <>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="text-[36px] font-semibold leading-none tabular-nums">{tr(query.data.mealCount)}</div>
                <div className="mt-1 text-[var(--color-text-muted)]">{tr("ta bolaga ovqat tayyorlanadi")}</div>
              </div>
              <div>
                <div className="text-[36px] font-semibold leading-none tabular-nums">{tr(query.data.staffMealCount)}</div>
                <div className="mt-1 text-[var(--color-text-muted)]">
                  {tr("ta xodim · jami")}{" "}<b className="text-[var(--color-text)]">{tr(query.data.totalMealCount)}</b> {tr("porsiya")}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[var(--color-text-muted)]">
                <span>{tr("Jami:")}{" "}<b className="text-[var(--color-text)]">{tr(query.data.total)}</b></span>
                <span>{tr("Kelgan:")}{" "}<b className="text-[var(--color-text)]">{tr(query.data.present)}</b></span>
                <span>{tr("Kechikkan:")}{" "}<b className="text-[var(--color-text)]">{tr(query.data.late)}</b></span>
                <span>{tr("Kelmagan:")}{" "}<b className="text-[var(--color-text)]">{tr(query.data.absent)}</b></span>
                <span>{tr("Kasal:")}{" "}<b className="text-[var(--color-text)]">{tr(query.data.sick)}</b></span>
              </div>
            </div>
            {query.data.notMarked > 0 && (
              <p className="rounded-lg bg-[var(--color-warning-bg)] px-3 py-2 text-[var(--color-warning)]">
                {tr(query.data.notMarked)} {tr("ta bolaning davomati hali belgilanmagan — raqam o'zgarishi mumkin.")}
              </p>
            )}
            <ul className="divide-y divide-[var(--color-border)]">
              {query.data.groups.map((g) => (
                <li key={g.groupId ?? "none"} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="font-medium">{tr(g.name)}</span>
                  <span className="tabular-nums text-[var(--color-text-muted)]">
                    <b className="text-[var(--color-text)]">{g.present + g.late}</b> / {tr(g.total)}
                    {g.notMarked === g.total && g.total > 0 ? " · davomat qilinmagan" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
