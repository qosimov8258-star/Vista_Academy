"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { Organization, OrganizationUsage, Wallet, WalletTransaction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  InboxIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import { expiryLabel, formatDayMonth, formatDateTime, formatMoney, initials } from "@/lib/format";
import { organizationAccessUrl } from "@/lib/admin-web";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/features/subscriptions/status";
import { AssignSubscriptionModal } from "@/features/organizations/assign-subscription-modal";
import { TopUpModal } from "@/features/organizations/top-up-modal";
import { EditOrganizationModal } from "@/features/organizations/edit-organization-modal";
import { WALLET_TX_TYPE_LABEL } from "@/features/organizations/wallet-labels";
import { AdjustWalletModal, ExtendSubscriptionModal } from "@/features/billing/modals";
import {
  AdminsCard,
  ArchiveModal,
  BranchesCard,
  NotesCard,
  OrgStatusPill,
  SuspendModal,
  UsageTiles,
  useEnterOrganization,
  useInvalidateOrganization,
} from "@/features/organizations/lifecycle";

const card = "rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export default function BogchaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const invalidate = useInvalidateOrganization(id);

  const [subscriptionModal, setSubscriptionModal] = useState<"assign" | "change" | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const orgQuery = useQuery({
    queryKey: ["organizations", id],
    queryFn: () => api.get<Organization>(`/platform/organizations/${id}`),
  });
  const usageQuery = useQuery({
    queryKey: ["organization-usage", id],
    queryFn: () => api.get<OrganizationUsage>(`/platform/organizations/${id}/usage`),
  });
  const walletQuery = useQuery({
    queryKey: ["wallet", id],
    queryFn: () => api.get<{ wallet: Wallet; transactions: WalletTransaction[] }>(`/platform/organizations/${id}/wallet`),
  });

  const activateMutation = useMutation({
    mutationFn: () => api.post(`/platform/organizations/${id}/activate`),
    onSuccess: invalidate,
  });
  const restoreMutation = useMutation({
    mutationFn: () => api.post(`/platform/organizations/${id}/restore`),
    onSuccess: invalidate,
  });
  const subscriptionMutation = useMutation({
    mutationFn: (action: "suspend" | "activate") => api.patch(`/platform/subscriptions/organization/${id}/${action}`),
    onSuccess: invalidate,
  });

  const { enter: enterOrganization, mutation: enterMutation } = useEnterOrganization();
  const enter = () => enterOrganization(id);

  if (orgQuery.isLoading) return <LoadingState />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  const org = orgQuery.data;
  if (!org) return null;

  const accessUrl = organizationAccessUrl(org.slug);
  const websiteUrl = org.website ? `https://${org.website}` : null;
  const archived = org.status === "ARCHIVED";
  const actionError = [enterMutation.error, activateMutation.error, restoreMutation.error, subscriptionMutation.error].find(Boolean);

  const copyAccessUrl = async () => {
    try {
      await navigator.clipboard.writeText(accessUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard yopiq bo'lishi mumkin — havola baribir ko'rinib turibdi
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/bogchalar"
        className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        Bog&apos;chalar
      </Link>

      {/* Sarlavha kartasi */}
      <section className={clsx(card, "p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[var(--color-ink)] text-[20px] font-semibold text-white"
            >
              {initials(org.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[26px] font-medium tracking-[-0.02em] text-[var(--color-text)]">{org.name}</h1>
                <OrgStatusPill status={org.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-text-muted)]">
                <button type="button" onClick={copyAccessUrl} className="inline-flex cursor-pointer items-center gap-1 hover:text-[var(--color-text)]" title="Nusxalash">
                  {accessUrl.replace(/^https?:\/\//, "")}
                  <CopyIcon className="h-3.5 w-3.5" />
                  {copied && <span className="text-[var(--color-success)]">nusxalandi</span>}
                </button>
                <span>{org.contactPhone ?? "telefon ko'rsatilmagan"}</span>
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--color-text)]">
                    {org.website}
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                )}
                <span>Qo&apos;shilgan {formatDayMonth(org.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {org.status === "ACTIVE" && (
              <Button onClick={enter} loading={enterMutation.isPending}>
                <ArrowUpRightIcon className="h-4 w-4" />
                Bog&apos;chaga kirish
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <PencilIcon className="h-4 w-4" />
              Tahrirlash
            </Button>
            {org.status === "ACTIVE" && (
              <Button variant="dangerSoft" onClick={() => setSuspendOpen(true)}>
                To&apos;xtatish
              </Button>
            )}
            {org.status === "SUSPENDED" && (
              <Button onClick={() => activateMutation.mutate()} loading={activateMutation.isPending}>
                Faollashtirish
              </Button>
            )}
            {archived && (
              <Button onClick={() => restoreMutation.mutate()} loading={restoreMutation.isPending}>
                Arxivdan qaytarish
              </Button>
            )}
          </div>
        </div>

        {actionError && (
          <p className="mt-3 text-[13px] text-[var(--color-danger)]">
            {actionError instanceof ApiError ? actionError.message : "Kutilmagan xatolik"}
          </p>
        )}

        {org.status === "SUSPENDED" && (
          <div className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-[var(--color-danger-bg)] px-4 py-3 text-[13.5px] text-[var(--color-danger)]">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Panel va ota-ona kabineti yopiq{org.suspendedAt ? ` (${formatDayMonth(org.suspendedAt)} dan)` : ""}.{" "}
              {org.suspendReason ? `Sabab: ${org.suspendReason}` : "Sabab yozilmagan."}
            </span>
          </div>
        )}
        {archived && (
          <div className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-[var(--color-surface-sunken)] px-4 py-3 text-[13.5px] text-[var(--color-text-muted)]">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Arxivda{org.archivedAt ? ` (${formatDayMonth(org.archivedAt)} dan)` : ""}: panel yopiq, ma&apos;lumotlar saqlangan. Butunlay
              o&apos;chirish — &quot;Tahrirlash&quot; oynasida.
            </span>
          </div>
        )}
      </section>

      {/* Foydalanish va tarif limitlari */}
      {usageQuery.data ? (
        <UsageTiles usage={usageQuery.data} />
      ) : usageQuery.isError ? (
        <ErrorState message={(usageQuery.error as Error).message} />
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[112px] animate-pulse rounded-[var(--radius-xl)] bg-[var(--color-surface)]/70" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {usageQuery.data && <BranchesCard usage={usageQuery.data} />}

          {/* Hamyon */}
          <section className={clsx(card, "overflow-hidden")}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="text-[17px] font-medium text-[var(--color-text)]">Hamyon</h2>
                <p className="mt-1 text-[28px] font-semibold tabular-nums leading-tight tracking-[-0.02em] text-[var(--color-text)]">
                  {formatMoney(walletQuery.data?.wallet.balance ?? "0", walletQuery.data?.wallet.currency)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setAdjustOpen(true)} disabled={archived}>
                  Tuzatish
                </Button>
                <Button size="sm" onClick={() => setTopUpOpen(true)} disabled={archived}>
                  <PlusIcon className="h-3.5 w-3.5" />
                  To&apos;ldirish
                </Button>
              </div>
            </div>
            {walletQuery.isLoading ? (
              <LoadingState />
            ) : walletQuery.isError ? (
              <div className="p-5">
                <ErrorState message={(walletQuery.error as Error).message} />
              </div>
            ) : walletQuery.data?.transactions.length === 0 ? (
              <EmptyState compact icon={InboxIcon} title="Tranzaksiyalar yo'q" description="Hamyon to'ldirilgandan keyin bu yerda tarix ko'rinadi" />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead>
                    <tr className="border-y border-[var(--color-border)] text-[13.5px] text-[var(--color-text-muted)]">
                      <th className="px-5 py-2.5 font-normal">Turi</th>
                      <th className="px-3 py-2.5 text-right font-normal">Summa</th>
                      <th className="px-3 py-2.5 text-right font-normal">Balans</th>
                      <th className="px-3 py-2.5 font-normal">Izoh</th>
                      <th className="px-5 py-2.5 font-normal">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-separator)]">
                    {walletQuery.data?.transactions.map((tx) => (
                      <tr key={tx.id} className="text-[13.5px]">
                        <td className="px-5 py-3 text-[var(--color-text)]">{WALLET_TX_TYPE_LABEL[tx.type]}</td>
                        <td
                          className={clsx(
                            "px-3 py-3 text-right font-medium tabular-nums",
                            Number(tx.amount) < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]",
                          )}
                        >
                          {Number(tx.amount) > 0 ? "+" : ""}
                          {formatMoney(tx.amount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">{formatMoney(tx.balanceAfter)}</td>
                        <td className="px-3 py-3 text-[var(--color-text-muted)]">{tx.note ?? "—"}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-[var(--color-text-muted)]">{formatDateTime(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          {/* Obuna — qora karta */}
          <section className="rounded-[var(--radius-xl)] bg-[var(--color-ink)] p-5 text-[var(--color-ink-text)]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[17px] font-medium">Obuna</h2>
              {org.subscription && (
                <Badge dot tone={subscriptionStatusTone(org.subscription.status)}>
                  {subscriptionStatusLabel(org.subscription.status)}
                </Badge>
              )}
            </div>
            {org.subscription ? (
              <>
                <p className="mt-3 flex items-center gap-2 text-[24px] font-semibold tracking-[-0.02em]">
                  {org.subscription.plan?.name}
                  {org.subscription.trialEndsAt && new Date(org.subscription.trialEndsAt) > new Date() && (
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold tracking-normal">Sinov</span>
                  )}
                </p>
                <p className="text-[13.5px] text-[var(--color-ink-muted)]">{formatMoney(org.subscription.plan?.priceMonthly ?? "0")} / oy</p>
                <dl className="mt-4 space-y-2 rounded-[16px] bg-white/[0.06] px-4 py-3 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-ink-muted)]">Davr</dt>
                    <dd className="tabular-nums">
                      {formatDayMonth(org.subscription.currentPeriodStart)} – {formatDayMonth(org.subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-ink-muted)]">Muddat</dt>
                    <dd className={clsx(expiryLabel(org.subscription.currentPeriodEnd).tone === "danger" && "text-[var(--color-danger-on-ink)]")}>
                      {expiryLabel(org.subscription.currentPeriodEnd).label}
                    </dd>
                  </div>
                </dl>
                {org.subscription.status === "GRACE_PERIOD" && org.subscription.graceUntil && (
                  <p className="mt-3 rounded-[14px] bg-[var(--color-danger-on-ink)]/15 px-3.5 py-2.5 text-[12.5px] text-[var(--color-danger-on-ink)]">
                    Hamyonda mablag&apos; yetmadi — imtiyozli davr. {formatDayMonth(org.subscription.graceUntil)} da panel yopiladi.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExtendOpen(true)}
                    disabled={archived}
                    className="cursor-pointer rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Uzaytirish
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubscriptionModal("change")}
                    className="cursor-pointer rounded-full bg-[var(--color-ink-raised)] px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-[#3a3a3f]"
                  >
                    Rejani o&apos;zgartirish
                  </button>
                  <button
                    type="button"
                    onClick={() => subscriptionMutation.mutate(org.subscription?.status === "SUSPENDED" ? "activate" : "suspend")}
                    disabled={subscriptionMutation.isPending}
                    className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-white/15 disabled:opacity-60"
                  >
                    {org.subscription.status === "SUSPENDED" ? "Obunani faollashtirish" : "Obunani to'xtatish"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-3">
                <p className="text-[13.5px] text-[var(--color-ink-muted)]">Bu bog&apos;chaga hali tarif biriktirilmagan.</p>
                <button
                  type="button"
                  onClick={() => setSubscriptionModal("assign")}
                  className="mt-3 cursor-pointer rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)]"
                >
                  Obuna biriktirish
                </button>
              </div>
            )}
          </section>

          {usageQuery.data && <AdminsCard usage={usageQuery.data} />}
          <NotesCard organization={org} />

          {!archived && (
            <section className={clsx(card, "p-5")}>
              <h2 className="text-[17px] font-medium text-[var(--color-text)]">Arxiv</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                Hamkorlik tugasa — panel yopiladi, ma&apos;lumot saqlanadi. Butunlay o&apos;chirish faqat arxivdan keyin.
              </p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
                <RefreshIcon className="h-3.5 w-3.5" />
                Arxivga olish
              </Button>
            </section>
          )}
        </div>
      </div>

      {subscriptionModal && (
        <AssignSubscriptionModal open mode={subscriptionModal} organizationId={id} onClose={() => setSubscriptionModal(null)} />
      )}
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} organizationId={id} />
      <EditOrganizationModal
        open={editOpen}
        organization={org}
        onClose={() => setEditOpen(false)}
        onDeleted={() => {
          setEditOpen(false);
          router.push("/bogchalar");
        }}
      />
      <SuspendModal organization={org} open={suspendOpen} onClose={() => setSuspendOpen(false)} />
      {org.subscription && (
        <ExtendSubscriptionModal
          open={extendOpen}
          onClose={() => setExtendOpen(false)}
          organizationId={id}
          subscription={org.subscription}
          balance={Number(walletQuery.data?.wallet.balance ?? 0)}
        />
      )}
      <AdjustWalletModal open={adjustOpen} onClose={() => setAdjustOpen(false)} organizationId={id} />
      <ArchiveModal organization={org} open={archiveOpen} onClose={() => setArchiveOpen(false)} />
    </div>
  );
}
