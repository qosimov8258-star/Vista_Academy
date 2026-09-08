"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Organization, Wallet, WalletTransaction } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import {
  ArrowLeftIcon,
  BuildingIcon,
  ExternalLinkIcon,
  InboxIcon,
  PlusIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import { formatDateTime, formatMoney } from "@/lib/format";
import { organizationAccessUrl } from "@/lib/admin-web";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/features/subscriptions/status";
import { AssignSubscriptionModal } from "@/features/organizations/assign-subscription-modal";
import { TopUpModal } from "@/features/organizations/top-up-modal";
import { AddBranchModal } from "@/features/organizations/add-branch-modal";
import { EditOrganizationModal } from "@/features/organizations/edit-organization-modal";

const TX_TYPE_LABEL: Record<WalletTransaction["type"], string> = {
  TOP_UP: "To'ldirish",
  SUBSCRIPTION_CHARGE: "Obuna to'lovi",
  REFUND: "Qaytarish",
  BONUS: "Bonus",
  ADJUSTMENT: "Tuzatish",
};

export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const [subscriptionModal, setSubscriptionModal] = useState<"assign" | "change" | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const orgQuery = useQuery({
    queryKey: ["organizations", id],
    queryFn: () => api.get<Organization>(`/platform/organizations/${id}`),
  });

  const walletQuery = useQuery({
    queryKey: ["wallet", id],
    queryFn: () =>
      api.get<{ wallet: Wallet; transactions: WalletTransaction[] }>(`/platform/organizations/${id}/wallet`),
  });

  const statusMutation = useMutation({
    mutationFn: (action: "suspend" | "activate") =>
      api.patch(`/platform/subscriptions/organization/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", id] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
    onError: (err) => alert(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  if (orgQuery.isLoading) return <LoadingState />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  const org = orgQuery.data;
  if (!org) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={org.name}
        description={`/${org.slug} · ${org.contactEmail ?? "email ko'rsatilmagan"} · ${org.contactPhone ?? "telefon yo'q"}`}
        back={
          <Link
            href="/organizations"
            className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Tashkilotlar
          </Link>
        }
        actions={
          <>
            <Badge dot tone={org.status === "ACTIVE" ? "success" : "danger"}>
              {org.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Tahrirlash
            </Button>
          </>
        }
      />

      {/* Tashkilot paneliga o'tish — bu sahifadagi eng ko'p bosiladigan havola */}
      <a
        href={organizationAccessUrl(org.slug)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-primary)] transition-opacity hover:opacity-80"
      >
        {organizationAccessUrl(org.slug)}
        <ExternalLinkIcon className="h-3.5 w-3.5" />
      </a>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex items-center justify-between gap-3">
            <CardTitle>Filiallar ({org.branches.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setBranchOpen(true)}>
              <PlusIcon className="h-3.5 w-3.5" />
              Filial
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {org.branches.length === 0 ? (
              <EmptyState
                compact
                icon={BuildingIcon}
                title="Filial yo'q"
                description="Bu tashkilotga birinchi filialni qo'shing"
              />
            ) : (
              <ul className="divide-y divide-[var(--color-separator)]">
                {org.branches.map((branch) => (
                  <li key={branch.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{branch.name}</p>
                      <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                        {branch.address ?? "Manzil ko'rsatilmagan"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 text-[11px] text-[var(--color-text-muted)]">
                      {branch.timezone}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Obuna</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {org.subscription ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-[var(--color-text)]">
                    {org.subscription.plan?.name}
                  </span>
                  <Badge dot tone={subscriptionStatusTone(org.subscription.status)}>
                    {subscriptionStatusLabel(org.subscription.status)}
                  </Badge>
                </div>
                <p className="text-[13px] tabular-nums text-[var(--color-text)]">
                  {formatMoney(org.subscription.plan?.priceMonthly ?? "0")}
                  <span className="text-[var(--color-text-muted)]"> / oy</span>
                </p>
                <dl className="space-y-1.5 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-3.5 py-3 text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-text-muted)]">Davr boshi</dt>
                    <dd className="tabular-nums text-[var(--color-text)]">
                      {formatDateTime(org.subscription.currentPeriodStart)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-text-muted)]">Davr oxiri</dt>
                    <dd className="tabular-nums text-[var(--color-text)]">
                      {formatDateTime(org.subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setSubscriptionModal("change")}>
                    Rejani o&apos;zgartirish
                  </Button>
                  {org.subscription.status === "SUSPENDED" ? (
                    <Button
                      size="sm"
                      onClick={() => statusMutation.mutate("activate")}
                      loading={statusMutation.isPending}
                    >
                      Faollashtirish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => statusMutation.mutate("suspend")}
                      loading={statusMutation.isPending}
                    >
                      To&apos;xtatish
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                compact
                icon={RefreshIcon}
                title="Obuna yo'q"
                description="Bu tashkilotga hali tarif rejasi biriktirilmagan"
                action={
                  <Button size="sm" onClick={() => setSubscriptionModal("assign")}>
                    Obuna biriktirish
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Hamyon</CardTitle>
          <Button size="sm" onClick={() => setTopUpOpen(true)}>
            <PlusIcon className="h-3.5 w-3.5" />
            To&apos;ldirish
          </Button>
        </CardHeader>

        {walletQuery.isLoading ? (
          <LoadingState />
        ) : walletQuery.isError ? (
          <CardBody>
            <ErrorState message={(walletQuery.error as Error).message} />
          </CardBody>
        ) : (
          <>
            <CardBody className="border-b border-[var(--color-separator)]">
              <p className="text-[12px] font-medium text-[var(--color-text-muted)]">Joriy balans</p>
              <p className="mt-1 text-[28px] font-semibold tabular-nums leading-tight text-[var(--color-text)]">
                {formatMoney(walletQuery.data?.wallet.balance ?? "0", walletQuery.data?.wallet.currency)}
              </p>
            </CardBody>

            {walletQuery.data?.transactions.length === 0 ? (
              <EmptyState
                compact
                icon={InboxIcon}
                title="Tranzaksiyalar yo'q"
                description="Hamyon to'ldirilgandan keyin bu yerda tarix ko'rinadi"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[var(--color-surface-sunken)] text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Turi</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Summa</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Balans</th>
                      <th className="px-3 py-2.5 font-semibold">Izoh</th>
                      <th className="px-5 py-2.5 font-semibold">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-separator)]">
                    {walletQuery.data?.transactions.map((tx) => (
                      <tr key={tx.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                        <td className="px-5 py-3 text-[var(--color-text)]">{TX_TYPE_LABEL[tx.type]}</td>
                        <td
                          className={`px-3 py-3 text-right font-medium tabular-nums ${
                            Number(tx.amount) < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"
                          }`}
                        >
                          {Number(tx.amount) > 0 ? "+" : ""}
                          {formatMoney(tx.amount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">
                          {formatMoney(tx.balanceAfter)}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[var(--color-text-muted)]">{tx.note ?? "—"}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
                          {formatDateTime(tx.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      {subscriptionModal && (
        <AssignSubscriptionModal
          open
          mode={subscriptionModal}
          organizationId={id}
          onClose={() => setSubscriptionModal(null)}
        />
      )}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} organizationId={id} />
      <AddBranchModal open={branchOpen} onClose={() => setBranchOpen(false)} organizationId={id} />
      <EditOrganizationModal open={editOpen} organization={org} onClose={() => setEditOpen(false)} />
    </div>
  );
}
