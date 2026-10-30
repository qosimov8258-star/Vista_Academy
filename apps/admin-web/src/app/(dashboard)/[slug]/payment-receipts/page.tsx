"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Pencil, Plus, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { canWriteMoney } from "@/lib/permissions";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { PaymentCardInfo, PaymentReceiptStatus, ReviewReceiptItem } from "@/lib/types";
import { IosButton } from "@/components/ios/button";
import { Segmented } from "@/components/ios/form";
import { Group, ListRow } from "@/components/ios/group";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { CardVisual } from "@/features/payments/card-visual";
import { PaymentCardSheet } from "@/features/payments/payment-card-sheet";
import { RECEIPT_STATUS, ReceiptReviewSheet } from "@/features/payments/receipt-review-sheet";
import { useTr } from "@/i18n/tr";

type Filter = PaymentReceiptStatus;

/**
 * To'lov cheklari — ota-onalar yuborgan cheklarni moliyachi shu yerda
 * tekshiradi. Tepada bog'cha kartasi (barcha ota-ona kabinetlarida
 * ko'rinadigan), ostida cheklar navbati: tasdiqlansa summa bolaning
 * qarzidan ayriladi, rad etilsa sababi ota-onaga ko'rinadi.
 */
export default function PaymentReceiptsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canReview = canWriteMoney(user?.role);
  // Karta butun tashkilotniki — uni faqat moliyachi va Super Admin o'zgartiradi (API ham shunday)
  const canEditCard = user?.role === "FINANCE" || user?.role === "NETWORK_ADMIN";

  const [filter, setFilter] = useState<Filter>("PENDING");
  const [cardOpen, setCardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cardQuery = useQuery({
    queryKey: ["payment-card", slug],
    queryFn: () => api.get<PaymentCardInfo | null>("/app/payment-card"),
  });
  const listQuery = useQuery({
    queryKey: ["review-receipts", slug],
    queryFn: () => api.get<{ items: ReviewReceiptItem[]; pendingCount: number }>("/app/payment-receipts"),
    // Yangi cheklar o'zi ko'rinib tursin
    refetchInterval: 30_000,
  });

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const pendingCount = listQuery.data?.pendingCount ?? 0;
  const visible = useMemo(() => items.filter((r) => r.status === filter), [items, filter]);
  const selected = items.find((r) => r.id === selectedId) ?? null;
  const card = cardQuery.data ?? null;

  const refresh = () => Promise.all([listQuery.refetch(), cardQuery.refetch()]);

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={ReceiptText}
          tint="green"
          title={tr("To'lov cheklari")}
          count={listQuery.data ? pendingCount : undefined}
          subtitle={tr("Ota-onalar yuborgan cheklarni tekshirish")}
        />

        {/* Bog'cha kartasi */}
        <Group
          title={tr("Bog'cha kartasi")}
          action={
            canEditCard && card ? (
              <button type="button" onClick={() => setCardOpen(true)} className="inline-flex items-center gap-1 text-[var(--color-primary)] active:opacity-50">
                <Pencil className="h-3.5 w-3.5" />
                {tr("O'zgartirish")}
              </button>
            ) : undefined
          }
          bare
          footer={card ? tr("Bu karta barcha ota-onalarning kabinetida ko'rinadi.") : undefined}
        >
          {cardQuery.isLoading ? (
            <div className="aspect-[1.586/1] max-h-56 w-full animate-pulse rounded-[24px] bg-[#767680]/[0.12] sm:max-w-sm" />
          ) : card ? (
            <div className="sm:max-w-sm">
              <CardVisual cardNumber={card.cardNumber} holderName={card.holderName} bankName={card.bankName} />
            </div>
          ) : (
            <PageCard className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/12 text-[var(--color-primary)]">
                <CreditCard className="h-7 w-7" />
              </span>
              <div>
                <p className="text-[16px] font-semibold text-[var(--color-text)]">{tr("Karta kiritilmagan")}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-[#8e8e93]">
                  {canEditCard
                    ? tr("To'lov kartasini kiriting — ota-onalar shu kartaga pul o'tkazadi.")
                    : tr("To'lov kartasini moliyachi kiritadi.")}
                </p>
              </div>
              {canEditCard && <IosButton label={tr("Karta kiritish")} icon={Plus} variant="primary" onClick={() => setCardOpen(true)} />}
            </PageCard>
          )}
        </Group>

        {/* Cheklar */}
        <Segmented<Filter>
          label={tr("Holat")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "PENDING", label: tr("Kutilmoqda") },
            { value: "APPROVED", label: tr("Tasdiqlangan") },
            { value: "REJECTED", label: tr("Rad etilgan") },
          ]}
        />

        {listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error | null)?.message} onRetry={() => void listQuery.refetch()} retrying={listQuery.isFetching} />
        ) : listQuery.isLoading ? (
          <Group bare>
            <PageCard>
              <SkeletonRows rows={4} />
            </PageCard>
          </Group>
        ) : visible.length === 0 ? (
          <PageCard>
            <EmptyState
              icon={ReceiptText}
              title={filter === "PENDING" ? tr("Tekshiriladigan chek yo'q") : tr("Cheklar yo'q")}
              hint={filter === "PENDING" ? tr("Ota-onalar chek yuborganda shu yerda paydo bo'ladi") : undefined}
            />
          </PageCard>
        ) : (
          <Group>
            {visible.map((r) => {
              const status = RECEIPT_STATUS[r.status];
              return (
                <ListRow
                  key={r.id}
                  avatar={<IosAvatar name={r.child.fullName} />}
                  title={r.child.fullName}
                  subtitle={`${r.guardian.fullName} · ${formatDateTime(r.createdAt)}`}
                  meta={
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{formatMoney(r.claimedAmount, r.currency)}</span>
                      <Pill color={status.color}>{tr(status.label)}</Pill>
                    </span>
                  }
                  onClick={() => setSelectedId(r.id)}
                />
              );
            })}
          </Group>
        )}
      </div>

      <PaymentCardSheet open={cardOpen} onClose={() => setCardOpen(false)} slug={slug} card={card} />
      <ReceiptReviewSheet receipt={selected} slug={slug} canReview={canReview} onClose={() => setSelectedId(null)} />
    </div>
  );
}
