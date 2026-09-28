"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { CoinChildBalance, CoinTransaction, CoinTransactionSource, WeeklyCoinAssessment } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";

function sourceLabel(t: (key: string) => string, source: CoinTransactionSource): string {
  const map: Record<CoinTransactionSource, string> = {
    ATTENDANCE: t("source.attendance"),
    WEEKLY_ASSESSMENT: t("source.weeklyAssessment"),
    MANUAL: t("source.manual"),
  };
  return map[source];
}

const SOURCE_TONE: Record<CoinTransactionSource, "success" | "info" | "neutral"> = {
  ATTENDANCE: "success",
  WEEKLY_ASSESSMENT: "info",
  MANUAL: "neutral",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Bolaning coin hisoboti — faqat ko'rish: qayerdan qancha coin kelgani. */
export function CoinHistoryModal({
  open,
  onClose,
  child,
}: {
  open: boolean;
  onClose: () => void;
  child: CoinChildBalance;
}) {
  const t = useTranslations("coins");
  const assessmentsQuery = useQuery({
    queryKey: ["coin-weekly-assessments", child.childId],
    queryFn: () => api.get<WeeklyCoinAssessment[]>(`/app/coins/children/${child.childId}/weekly-assessments`),
    enabled: open,
  });

  const transactionsQuery = useQuery({
    queryKey: ["coin-transactions", child.childId],
    queryFn: () => api.get<CoinTransaction[]>(`/app/coins/children/${child.childId}/transactions`),
    enabled: open,
  });

  return (
    <Modal open={open} onClose={onClose} title="Vista Academy" widthClassName="max-w-2xl">
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-4 py-5 text-center">
          <ChildPhoto
            child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }}
            size={80}
            fallback={initials(child.fullName)}
            className="text-[26px]"
          />
          <div>
            <p className="text-[17px] font-semibold text-[var(--color-text)]">{child.fullName}</p>
            {child.groupName && <p className="text-[13px] text-[var(--color-text-muted)]">{child.groupName}</p>}
          </div>

          <div className="grid w-full grid-cols-2 gap-2">
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-muted)]">{t("daily")}</p>
              <p className="text-[18px] font-semibold text-[var(--color-text)]">{child.attendanceCoins}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-muted)]">{t("weekly")}</p>
              <p className="text-[18px] font-semibold text-[var(--color-text)]">{child.weeklyAssessmentCoins}</p>
            </div>
          </div>

          <div className="w-full rounded-[var(--radius-lg)] bg-[var(--color-primary)]/[0.08] px-3 py-2.5">
            <p className="text-xs text-[var(--color-text-muted)]">{t("total")}</p>
            <p className="text-[22px] font-semibold text-[var(--color-primary)]">{child.balance} coin</p>
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("weeklyAssessments")}</h3>
          {assessmentsQuery.isLoading ? (
            <LoadingState />
          ) : assessmentsQuery.isError ? (
            <ErrorState message={(assessmentsQuery.error as Error).message} />
          ) : !assessmentsQuery.data || assessmentsQuery.data.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("noWeeklyAssessmentsYet")}</p>
          ) : (
            <ul className="space-y-2">
              {assessmentsQuery.data.map((a) => {
                const correct = a.answers.filter((x) => x.correct).length;
                return (
                  <li
                    key={a.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-separator)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {t("weekOf", { date: formatDate(a.weekStart) })}
                      </span>
                      <Badge tone="info">+{a.coinsAwarded} coin</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {t("correctAnswers", { correct, total: a.answers.length })}
                      {a.poemRecited ? ` · ${t("recitedPoem")}` : ""}
                      {a.employee ? ` · ${a.employee.fullName}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("allTransactions")}</h3>
          {transactionsQuery.isLoading ? (
            <LoadingState />
          ) : transactionsQuery.isError ? (
            <ErrorState message={(transactionsQuery.error as Error).message} />
          ) : !transactionsQuery.data || transactionsQuery.data.length === 0 ? (
            <EmptyState title={t("noTransactionsYet")} />
          ) : (
            <ul className="divide-y divide-[var(--color-separator)]">
              {transactionsQuery.data.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--color-text)]">{tx.reason}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(tx.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={SOURCE_TONE[tx.source]}>{sourceLabel(t, tx.source)}</Badge>
                    <span
                      className={`text-sm font-semibold ${
                        tx.amount >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
