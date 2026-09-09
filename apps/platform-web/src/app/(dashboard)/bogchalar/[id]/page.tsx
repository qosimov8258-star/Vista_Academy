"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Organization, Wallet, WalletTransaction } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import {
  ArrowLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  InboxIcon,
  LinkIcon,
  PlusIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import { bogchaPublicUrl, formatDateTime, formatMoney } from "@/lib/format";
import { organizationAccessUrl } from "@/lib/admin-web";
import {
  subscriptionStatusLabel,
  subscriptionStatusTone,
} from "@/features/subscriptions/status";
import { AssignSubscriptionModal } from "@/features/organizations/assign-subscription-modal";
import { TopUpModal } from "@/features/organizations/top-up-modal";
import { EditOrganizationModal } from "@/features/organizations/edit-organization-modal";

const TX_TYPE_LABEL: Record<WalletTransaction["type"], string> = {
  TOP_UP: "To'ldirish",
  SUBSCRIPTION_CHARGE: "Obuna to'lovi",
  REFUND: "Qaytarish",
  BONUS: "Bonus",
  ADJUSTMENT: "Tuzatish",
};

export default function BogchaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const [subscriptionModal, setSubscriptionModal] = useState<
    "assign" | "change" | null
  >(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [urlPopoverOpen, setUrlPopoverOpen] = useState(false);
  const [accessLinkCopied, setAccessLinkCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!urlPopoverOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setUrlPopoverOpen(false);
        return;
      }
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setUrlPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [urlPopoverOpen]);

  const orgQuery = useQuery({
    queryKey: ["organizations", id],
    queryFn: () => api.get<Organization>(`/platform/organizations/${id}`),
  });

  const walletQuery = useQuery({
    queryKey: ["wallet", id],
    queryFn: () =>
      api.get<{ wallet: Wallet; transactions: WalletTransaction[] }>(
        `/platform/organizations/${id}/wallet`,
      ),
  });

  const statusMutation = useMutation({
    mutationFn: (action: "suspend" | "activate") =>
      api.patch(`/platform/subscriptions/organization/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", id] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
    onError: (err) =>
      alert(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  if (orgQuery.isLoading) return <LoadingState />;
  if (orgQuery.isError)
    return <ErrorState message={(orgQuery.error as Error).message} />;
  const org = orgQuery.data;
  if (!org) return null;

  const publicUrl = bogchaPublicUrl(org.slug);
  const accessUrl = organizationAccessUrl(org.slug);

  const copyAccessUrl = async () => {
    try {
      await navigator.clipboard.writeText(accessUrl);
      setAccessLinkCopied(true);
      setTimeout(() => setAccessLinkCopied(false), 2000);
    } catch {
      // clipboard may be unavailable — ignore
    }
  };

  return (
    <div className="space-y-5">
      <Link
        href="/bogchalar"
        className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        Bog&apos;chalar
      </Link>

      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold text-[var(--color-text)]">
              {org.name}
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
              {org.contactPhone ?? "telefon ko'rsatilmagan"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge dot tone={org.status === "ACTIVE" ? "success" : "danger"}>
              {org.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
            </Badge>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditOpen(true)}
            >
              Tahrirlash
            </Button>
          </div>
        </CardBody>

        <CardBody className="flex flex-wrap items-center gap-2 border-t border-[var(--color-separator)]">
          {/* Ommaviy (tenant) sahifa havolasi — bosilganda to'g'ridan-to'g'ri ochiladi */}
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-primary)] transition-opacity hover:opacity-80"
          >
            Ommaviy sahifa
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>

          {/* Boshqaruv paneli havolasi — GitHub'ning "Code" tugmasi kabi popoverda ko'rsatiladi */}
          <div ref={popoverRef} className="relative">
            <button
              type="button"
              onClick={() => setUrlPopoverOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Bog&apos;cha URL
            </button>

            {urlPopoverOpen && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[300px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
                <p className="mb-2 text-[12px] font-medium text-[var(--color-text-muted)]">
                  Boshqaruv paneli havolasi
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={accessUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full truncate rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2.5 py-1.5 text-[12px] text-[var(--color-text)]"
                  />
                  <IconButton label="Nusxalash" onClick={copyAccessUrl}>
                    <CopyIcon className="h-4 w-4" />
                  </IconButton>
                </div>
                {accessLinkCopied && (
                  <p className="mt-1.5 text-[11px] text-[var(--color-success)]">
                    Nusxalandi ✓
                  </p>
                )}
              </div>
            )}
          </div>
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
                <Badge
                  dot
                  tone={subscriptionStatusTone(org.subscription.status)}
                >
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
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSubscriptionModal("change")}
                >
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
              description="Bu bog'chaga hali tarif rejasi biriktirilmagan"
              action={
                <Button
                  size="sm"
                  onClick={() => setSubscriptionModal("assign")}
                >
                  Obuna biriktirish
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>

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
              <p className="text-[12px] font-medium text-[var(--color-text-muted)]">
                Joriy balans
              </p>
              <p className="mt-1 text-[28px] font-semibold tabular-nums leading-tight text-[var(--color-text)]">
                {formatMoney(
                  walletQuery.data?.wallet.balance ?? "0",
                  walletQuery.data?.wallet.currency,
                )}
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
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Summa
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Balans
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Izoh</th>
                      <th className="px-5 py-2.5 font-semibold">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-separator)]">
                    {walletQuery.data?.transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="transition-colors hover:bg-[var(--color-surface-hover)]"
                      >
                        <td className="px-5 py-3 text-[var(--color-text)]">
                          {TX_TYPE_LABEL[tx.type]}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-medium tabular-nums ${
                            Number(tx.amount) < 0
                              ? "text-[var(--color-danger)]"
                              : "text-[var(--color-success)]"
                          }`}
                        >
                          {Number(tx.amount) > 0 ? "+" : ""}
                          {formatMoney(tx.amount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">
                          {formatMoney(tx.balanceAfter)}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[var(--color-text-muted)]">
                          {tx.note ?? "—"}
                        </td>
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
      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        organizationId={id}
      />
      <EditOrganizationModal
        open={editOpen}
        organization={org}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
