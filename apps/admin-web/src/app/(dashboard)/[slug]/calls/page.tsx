"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { PhoneIcon } from "@/components/ios/icons";
import { IosButton } from "@/components/ios/button";
import { ChipRow, IosChip } from "@/components/ios/filters";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { CallsList } from "@/features/desk/calls-list";
import { CalledLeadsList } from "@/features/desk/called-leads";
import { CALL_KIND_LABEL, todayTashkent, type CallKind, type CallsResult } from "@/features/desk/shared";
import { useTr } from "@/i18n/tr";

const KINDS = ["DEBT", "ABSENT", "LEAD", "FAKE_RECEIPT"] as const;

/**
 * Bugun qo'ng'iroq qilish — iOS uslubida. Funksiyalar avvalgidek: tur
 * bo'yicha filtr (ochiq qo'ng'iroqlar soni bilan), ochiq qo'ng'iroqlar soni,
 * ro'yxat (belgilash, "aloqa bo'lmadi", qaytarish — CallsList varag'ida).
 * Qo'shimcha: bajarilish chizig'i, yangilash tugmasi va pastga tortish.
 */
export default function CallsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const date = todayTashkent();
  const [filter, setFilter] = useState<CallKind | "ALL">("ALL");
  const [refreshing, setRefreshing] = useState(false);
  // CallsList bilan bir xil kalit — so'rov bir marta yuboriladi
  const query = useQuery({
    queryKey: ["desk-calls", slug, date],
    queryFn: () => api.get<CallsResult>(`/app/desk/calls?date=${date}`),
  });
  const items = query.data?.items ?? [];
  const openCount = (k?: CallKind) => items.filter((i) => (!k || i.kind === k) && !i.done).length;
  const total = items.length;
  const doneCount = total - (query.data?.open ?? 0);
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const refresh = () => queryClient.refetchQueries({ queryKey: ["desk-calls", slug] });
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={PhoneIcon}
          tint="green"
          title={tr("Bugun qo'ng'iroq qilish")}
          count={query.data ? tr("ochiq: {0}", query.data.open) : undefined}
          subtitle={tr("Qarzdorlar, kelmagan bolalar, arizalar va soxta cheklar")}
          actions={<IosButton label={tr("Yangilash")} icon={RefreshCw} compact onClick={onRefresh} loading={refreshing} />}
        />

        {total > 0 && (
          <PageCard className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] text-[var(--color-text)]">
                <span className="text-[28px] font-bold tabular-nums">{doneCount}</span>
                <span className="ml-1 tabular-nums text-[#8e8e93]">/ {total}</span>
                <span className="ml-1.5 text-[13px] text-[#8e8e93]">{tr("bajarildi")}</span>
              </p>
              <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{pct}%</span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
              <div className="h-full rounded-full bg-[#34c759] transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </PageCard>
        )}

        <ChipRow label={tr("Qo'ng'iroq turi")}>
          <IosChip active={filter === "ALL"} onClick={() => setFilter("ALL")} count={query.data ? openCount() : undefined}>
            {tr("Hammasi")}
          </IosChip>
          {KINDS.map((k) => (
            <IosChip key={k} active={filter === k} onClick={() => setFilter(k)} count={query.data ? openCount(k) : undefined}>
              {tr(CALL_KIND_LABEL[k])}
            </IosChip>
          ))}
        </ChipRow>

        <CallsList slug={slug} filter={filter} />

        {(filter === "ALL" || filter === "LEAD") && <CalledLeadsList slug={slug} />}
      </div>
    </div>
  );
}
