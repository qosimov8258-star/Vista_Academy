"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Organization, Wallet, WalletTransaction } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { formatDateTime, formatMoney } from "@/lib/format";
import { organizationAccessUrl } from "@/lib/admin-web";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/features/subscriptions/status";
import { AssignSubscriptionModal } from "@/features/organizations/assign-subscription-modal";
import { TopUpModal } from "@/features/organizations/top-up-modal";
import { AddBranchModal } from "@/features/organizations/add-branch-modal";

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

  const orgQuery = useQuery({
    queryKey: ["organizations", id],
    queryFn: () => api.get<Organization>(`/platform/organizations/${id}`),
  });

  const walletQuery = useQuery({
    queryKey: ["wallet", id],
    queryFn: () => api.get<{ wallet: Wallet; transactions: WalletTransaction[] }>(`/platform/organizations/${id}/wallet`),
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
    <div className="space-y-6">
      <div>
        <Link href="/organizations" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← Tashkilotlar
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text)]">{org.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              /{org.slug} • {org.contactEmail ?? "email ko'rsatilmagan"} • {org.contactPhone ?? "telefon yo'q"}
            </p>
          </div>
          <Badge tone={org.status === "ACTIVE" ? "success" : "danger"}>
            {org.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
          </Badge>
        </div>
        <a
          href={organizationAccessUrl(org.slug)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
        >
          {organizationAccessUrl(org.slug)} ↗
        </a>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Filiallar ({org.branches.length})</CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setBranchOpen(true)}>
              + Filial qo&apos;shish
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--color-border)]">
              {org.branches.map((branch) => (
                <li key={branch.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{branch.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{branch.address ?? "Manzil ko'rsatilmagan"}</p>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{branch.timezone}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Obuna</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {org.subscription ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text)]">{org.subscription.plan?.name}</span>
                  <Badge tone={subscriptionStatusTone(org.subscription.status)}>
                    {subscriptionStatusLabel(org.subscription.status)}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {formatMoney(org.subscription.plan?.priceMonthly ?? "0")} / oy
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Davr: {formatDateTime(org.subscription.currentPeriodStart)} — {formatDateTime(org.subscription.currentPeriodEnd)}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="secondary" onClick={() => setSubscriptionModal("change")}>
                    Rejani o&apos;zgartirish
                  </Button>
                  {org.subscription.status === "SUSPENDED" ? (
                    <Button size="sm" onClick={() => statusMutation.mutate("activate")} loading={statusMutation.isPending}>
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
              <>
                <p className="text-sm text-[var(--color-text-muted)]">Bu tashkilotda hali obuna yo&apos;q</p>
                <Button size="sm" onClick={() => setSubscriptionModal("assign")}>
                  Obuna biriktirish
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Hamyon</CardTitle>
          <Button size="sm" onClick={() => setTopUpOpen(true)}>
            + To&apos;ldirish
          </Button>
        </CardHeader>
        <CardBody>
          {walletQuery.isLoading ? (
            <LoadingState />
          ) : walletQuery.isError ? (
            <ErrorState message={(walletQuery.error as Error).message} />
          ) : (
            <>
              <p className="text-2xl font-semibold text-[var(--color-text)]">
                {formatMoney(walletQuery.data?.wallet.balance ?? "0", walletQuery.data?.wallet.currency)}
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Turi</th>
                      <th className="py-2 pr-4 font-medium">Summa</th>
                      <th className="py-2 pr-4 font-medium">Balans</th>
                      <th className="py-2 pr-4 font-medium">Izoh</th>
                      <th className="py-2 pr-4 font-medium">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {walletQuery.data?.transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[var(--color-text-muted)]">
                          Tranzaksiyalar yo&apos;q
                        </td>
                      </tr>
                    )}
                    {walletQuery.data?.transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2 pr-4">{TX_TYPE_LABEL[tx.type]}</td>
                        <td
                          className={`py-2 pr-4 font-medium ${Number(tx.amount) < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}
                        >
                          {Number(tx.amount) > 0 ? "+" : ""}
                          {formatMoney(tx.amount)}
                        </td>
                        <td className="py-2 pr-4">{formatMoney(tx.balanceAfter)}</td>
                        <td className="py-2 pr-4 text-[var(--color-text-muted)]">{tx.note ?? "—"}</td>
                        <td className="py-2 pr-4 text-[var(--color-text-muted)]">{formatDateTime(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardBody>
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
    </div>
  );
}
