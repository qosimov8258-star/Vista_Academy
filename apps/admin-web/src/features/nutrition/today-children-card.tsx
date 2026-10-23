"use client";

import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { Group, Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
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
  const d = query.data;

  return (
    <div className="space-y-5">
      <StatStrip tone="white">
        <StatCell label={tr("Bolalarga ovqat")} value={d?.mealCount ?? "—"} color={IOS.orange} hint={tr("keldi + kechikdi")} loading={query.isLoading} />
        <StatCell label={tr("Xodimlarga")} value={d?.staffMealCount ?? "—"} loading={query.isLoading} />
        <StatCell label={tr("Jami porsiya")} value={d?.totalMealCount ?? "—"} color={IOS.green} loading={query.isLoading} />
        <StatCell
          label={tr("Kelmagan / kasal")}
          value={d ? `${d.absent} / ${d.sick}` : "—"}
          color={IOS.red}
          hint={d ? tr("jami {0} bola", d.total) : undefined}
          loading={query.isLoading}
        />
      </StatStrip>

      {d && d.notMarked > 0 && (
        <p className="rounded-[18px] bg-[#ff9500]/[0.12] px-4 py-3 text-[13.5px] leading-snug text-[#c93400]">
          {tr("{0} ta bolaning davomati hali belgilanmagan — raqam o'zgarishi mumkin.", d.notMarked)}
        </p>
      )}

      <Group
        title={tr("Guruhlar bo'yicha")}
        refreshing={query.isFetching && !query.isLoading}
        footer={tr("Raqamlar har daqiqada davomatdan yangilanadi.")}
        bare
      >
        {query.isLoading ? (
          <SkeletonRows rows={3} />
        ) : query.isError ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : d && d.groups.length ? (
          <div className={GROUP_BLOCK}>
            {d.groups.map((g) => {
              const unmarked = g.notMarked === g.total && g.total > 0;
              return (
                <Row
                  key={g.groupId ?? "none"}
                  leading={<IosIcon icon={UsersRound} tint="orange" size={30} />}
                  title={tr(g.name)}
                  subtitle={g.absent + g.sick > 0 ? tr("kelmagan {0} · kasal {1}", g.absent, g.sick) : undefined}
                  value={
                    unmarked ? (
                      <Pill color={IOS.gray}>{tr("davomat qilinmagan")}</Pill>
                    ) : (
                      <span className="text-[15px] tabular-nums text-[#8e8e93]">
                        <b className="text-[17px] text-[var(--color-text)]">{g.present + g.late}</b> / {g.total}
                      </span>
                    )
                  }
                />
              );
            })}
          </div>
        ) : null}
      </Group>
    </div>
  );
}
