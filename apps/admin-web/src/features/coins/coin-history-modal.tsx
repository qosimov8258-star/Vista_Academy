"use client";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import type { CoinChildBalance, CoinTransaction, CoinTransactionSource, WeeklyCoinAssessment } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { SkeletonRows } from "@/components/ios/states";
import { IOS } from "@/components/ios/tokens";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { useTr } from "@/i18n/tr";

const SOURCE_LABEL: Record<CoinTransactionSource, string> = {
  ATTENDANCE: "Davomat",
  WEEKLY_ASSESSMENT: "Haftalik so'rov",
  PRODUCT_PURCHASE: "Do'kon",
  MANUAL: "Tarbiyachi berdi",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Bolaning yulduzcha varag'i — qayerdan qancha yulduzcha kelgani (faqat
 * ko'rish). Tarbiyachi uchun pastda amallar: «Yulduzcha berish» va
 * «Haftalik baholash» (berilmasa — tugmalar ko'rinmaydi).
 */
export function CoinHistoryModal({
  open,
  onClose,
  child,
  onAward,
  onAssess,
}: {
  open: boolean;
  onClose: () => void;
  child: CoinChildBalance;
  onAward?: () => void;
  onAssess?: () => void;
}) {
  const tr = useTr();
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

  const balanceColor = child.balance > 0 ? IOS.orange : child.balance < 0 ? IOS.red : IOS.gray;

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      cancelLabel="Yopish"
      title={tr("Yulduzcha tarixi")}
      footer={
        onAward || onAssess ? (
          <>
            {onAward && (
              <SheetPrimaryButton onClick={onAward}>
                <Star className="h-5 w-5" fill="currentColor" />
                {tr("Yulduzcha berish")}
              </SheetPrimaryButton>
            )}
            {onAssess && <SheetSecondaryButton onClick={onAssess}>{tr("Haftalik baholash")}</SheetSecondaryButton>}
          </>
        ) : undefined
      }
    >
      {/* Bosh qism: surat, ism, guruh, balans */}
      <div className="flex flex-col items-center gap-1.5 pt-1 text-center">
        <ChildPhoto
          child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }}
          size={80}
          fallback={initials(child.fullName)}
          className="text-[26px]"
        />
        <p className="mt-1 px-6 text-[20px] font-bold leading-tight text-[var(--color-text)]">{tr(child.fullName)}</p>
        {child.groupName && <p className="text-[15px] text-[#8e8e93]">{tr(child.groupName)}</p>}
        <p className="mt-1 flex items-center gap-1.5">
          <Star className="h-7 w-7" fill={balanceColor} stroke={balanceColor} />
          <span className="text-[32px] font-bold leading-none tabular-nums" style={{ color: balanceColor }}>
            {child.balance}
          </span>
          <span className="text-[15px] text-[#8e8e93]">{tr("yulduzcha")}</span>
        </p>
      </div>

      <StatStrip tone="white">
        <StatCell label={tr("Davomat")} value={child.attendanceCoins} color={IOS.green} />
        <StatCell label={tr("Haftalik")} value={child.weeklyAssessmentCoins} color={IOS.blue} />
        <StatCell label={tr("Umumiy")} value={child.balance} color={balanceColor} />
      </StatStrip>

      <SheetSection title={tr("Haftalik baholashlar")}>
        {assessmentsQuery.isLoading ? (
          <SkeletonRows rows={2} avatar={false} />
        ) : assessmentsQuery.isError ? (
          <Row title={<span className="text-[#ff3b30]">{tr((assessmentsQuery.error as Error).message)}</span>} />
        ) : !assessmentsQuery.data || assessmentsQuery.data.length === 0 ? (
          <Row title={<span className="text-[#8e8e93]">{tr("Hali haftalik baholash bo'lmagan.")}</span>} />
        ) : (
          assessmentsQuery.data.map((a) => {
            const correct = a.answers.filter((x) => x.correct).length;
            return (
              <Row
                key={a.id}
                title={`${formatDate(a.weekStart)} ${tr("haftasi")}`}
                subtitle={`${correct}/${a.answers.length} ${tr("to'g'ri javob")}${a.poemRecited ? tr(" · she'r yodladi") : ""}${a.employee ? ` · ${a.employee.fullName}` : ""}`}
                value={<Pill color={IOS.blue}>+{a.coinsAwarded}</Pill>}
              />
            );
          })
        )}
      </SheetSection>

      <SheetSection title={tr("Barcha tranzaksiyalar")}>
        {transactionsQuery.isLoading ? (
          <SkeletonRows rows={3} avatar={false} />
        ) : transactionsQuery.isError ? (
          <Row title={<span className="text-[#ff3b30]">{tr((transactionsQuery.error as Error).message)}</span>} />
        ) : !transactionsQuery.data || transactionsQuery.data.length === 0 ? (
          <Row title={<span className="text-[#8e8e93]">{tr("Hali yulduzcha tranzaksiyasi yo'q")}</span>} />
        ) : (
          transactionsQuery.data.map((t) => (
            <Row
              key={t.id}
              title={tr(t.reason)}
              subtitle={`${formatDate(t.createdAt)} · ${tr(SOURCE_LABEL[t.source])}`}
              value={
                <span className="font-semibold" style={{ color: t.amount >= 0 ? IOS.green : IOS.red }}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </span>
              }
            />
          ))
        )}
      </SheetSection>
    </IosSheet>
  );
}
