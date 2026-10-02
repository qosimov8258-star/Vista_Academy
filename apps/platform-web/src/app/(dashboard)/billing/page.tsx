"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiUrl, getPaginated } from "@/lib/api";
import type { BillingOverview, BillingRenewal, BillingTransaction, WalletTransactionType } from "@/lib/types";
import { ErrorState } from "@/components/ui/states";
import { ChevronLeftIcon, ChevronRightIcon, RefreshIcon, SearchIcon } from "@/components/ui/icons";
import { expiryLabel, formatCompactMoney, formatDayMonth, formatDateTime, formatMoney, formatNumber, initials } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";
import { KpiCard } from "@/features/dashboard/kpi";
import { WALLET_TX_TYPE_LABEL } from "@/features/organizations/wallet-labels";

const card = "rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";
const PAGE_SIZE = 25;
const RENEWAL_WINDOWS = [7, 14, 30];
const TX_TYPES: { value: "" | WalletTransactionType; label: string }[] = [
  { value: "", label: "Barcha turlar" },
  { value: "TOP_UP", label: "To'ldirish" },
  { value: "SUBSCRIPTION_CHARGE", label: "Obuna to'lovi" },
  { value: "BONUS", label: "Bonus" },
  { value: "REFUND", label: "Qaytarish" },
  { value: "ADJUSTMENT", label: "Tuzatish" },
];

/**
 * Moliya: platforma tushumi, obuna yechimlari navbati (pul yetadimi) va
 * barcha bog'chalar bo'yicha hamyon amallari jurnali (CSV eksport bilan).
 */
export default function BillingPage() {
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({
    queryKey: ["billing", "overview"],
    queryFn: () => api.get<BillingOverview>("/platform/billing/overview"),
  });
  const runMutation = useMutation({
    mutationFn: () => api.post<{ checked: number; renewed: number; grace: number; suspended: number }>("/platform/billing/run"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const o = overviewQuery.data;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text)]">Moliya</h1>
          <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-[var(--color-text-muted)]">
            {o && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                  o.autoRenew ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {o.autoRenew ? "Avtomatik yangilash yoqilgan" : "Avtomatik yangilash o'chiq"}
              </span>
            )}
            {o?.autoRenew
              ? "Har 15 daqiqada: hamyondan yechish → 7 kun imtiyoz → to'xtatish"
              : "Serverda SUBSCRIPTION_BILLING_CRON=on qo'yilganda yoqiladi"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {runMutation.data && (
            <span className="text-[12.5px] text-[var(--color-text-muted)]">
              {runMutation.data.checked === 0
                ? "Muddati tugagan obuna yo'q"
                : `${runMutation.data.checked} ta: yangilandi ${runMutation.data.renewed}, imtiyozli ${runMutation.data.grace}, to'xtatildi ${runMutation.data.suspended}`}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              // Haqiqiy obunalarni imtiyozli davrga/to'xtatishga o'tkazishi mumkin
              if (window.confirm("Muddati tugagan obunalar hozir hisob-kitob qilinadi: pul yetsa yechiladi, yetmasa imtiyozli davrga, imtiyozi o'tganlari to'xtatiladi. Davom etasizmi?")) {
                runMutation.mutate();
              }
            }}
            disabled={runMutation.isPending}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-surface)] px-4 text-[13.5px] font-medium text-[var(--color-text)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
          >
            <RefreshIcon className={clsx("h-4 w-4", runMutation.isPending && "animate-spin")} />
            Hozir tekshirish
          </button>
        </div>
      </header>

      {overviewQuery.isError ? (
        <ErrorState message={(overviewQuery.error as Error).message} />
      ) : (
        <section aria-label="Moliya ko'rsatkichlari" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            dark
            label="Shu oy tushum"
            value={o ? formatCompactMoney(o.topUps.amount) : ""}
            unit="so'm"
            loading={!o}
            footer={o && <p className="text-[12.5px] text-[var(--color-ink-muted)]">{o.topUps.count} ta to&apos;ldirish</p>}
          />
          <KpiCard
            label="Yechilgan obuna to'lovlari"
            value={o ? formatCompactMoney(o.charges.amount) : ""}
            unit="so'm"
            loading={!o}
            footer={o && <p className="text-[12.5px] text-[var(--color-text-muted)]">shu oyda {o.charges.count} ta</p>}
          />
          <KpiCard
            label="7 kunda yechiladi"
            value={o ? formatCompactMoney(o.upcomingWeek.amount) : ""}
            unit="so'm"
            loading={!o}
            footer={
              o && (
                <p className={clsx("text-[12.5px]", o.upcomingWeek.insufficient ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>
                  {o.upcomingWeek.count} ta obuna
                  {o.upcomingWeek.insufficient ? ` · ${o.upcomingWeek.insufficient} tasida pul yetmaydi` : ""}
                </p>
              )
            }
          />
          <KpiCard
            label="Qarzdorlik"
            value={o ? formatCompactMoney(o.overdue.amount) : ""}
            unit="so'm"
            loading={!o}
            footer={
              o && (
                <p className="text-[12.5px] text-[var(--color-text-muted)]">
                  imtiyozli {o.overdue.grace} · to&apos;xtatilgan {o.overdue.suspended} · hamyonlarda {formatCompactMoney(o.walletBalance)}
                </p>
              )
            }
          />
        </section>
      )}

      <RenewalsSection />
      <TransactionsSection />
    </div>
  );
}

function RenewalsSection() {
  const [days, setDays] = useState(14);
  const query = useQuery({
    queryKey: ["billing", "renewals", days],
    queryFn: () => api.get<BillingRenewal[]>(`/platform/billing/renewals?days=${days}`),
    placeholderData: keepPreviousData,
  });
  const rows = query.data ?? [];

  return (
    <section className={clsx(card, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-[17px] font-medium text-[var(--color-text)]">Yechimlar navbati</h2>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Muddati yaqinlashgan, o&apos;tgan va imtiyozli davrdagi obunalar</p>
        </div>
        <div role="radiogroup" aria-label="Davr" className="flex gap-1 rounded-full bg-[var(--color-surface-sunken)] p-1">
          {RENEWAL_WINDOWS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={days === value}
              onClick={() => setDays(value)}
              className={clsx(
                "h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-medium transition-colors",
                days === value ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {value} kun
            </button>
          ))}
        </div>
      </div>
      {query.isError ? (
        <div className="p-5">
          <ErrorState message={(query.error as Error).message} />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-8 pt-4 text-center text-[13.5px] text-[var(--color-text-muted)]">
          {query.isLoading ? "Yuklanmoqda…" : `${days} kun ichida yangilanadigan obuna yo'q`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-y border-[var(--color-border)] text-[13.5px] text-[var(--color-text-muted)]">
                <th className="px-5 py-2.5 font-normal">Bog&apos;cha</th>
                <th className="px-3 py-2.5 font-normal">Tarif</th>
                <th className="px-3 py-2.5 font-normal">Muddat</th>
                <th className="px-3 py-2.5 text-right font-normal">Hamyonda</th>
                <th className="px-5 py-2.5 font-normal">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-separator)]">
              {rows.map((row) => {
                const expiry = expiryLabel(row.periodEnd);
                return (
                  <tr key={row.organization.id} className="text-[13.5px] transition-colors hover:bg-[var(--color-surface-hover)]">
                    <td className="px-5 py-3">
                      <Link href={`/bogchalar/${row.organization.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-surface-sunken)] text-[12.5px] font-semibold text-[var(--color-text)]">
                          {initials(row.organization.name)}
                        </span>
                        <span className="font-medium text-[var(--color-text)] hover:underline">{row.organization.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-medium text-[var(--color-text)]">{row.plan.name}</span>{" "}
                      <span className="text-[12px] text-[var(--color-text-muted)]">{formatMoney(row.plan.priceMonthly)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[var(--color-text)]">{formatDayMonth(row.periodEnd)}</span>
                      <span
                        className={clsx(
                          "ml-2 text-[12px]",
                          expiry.tone === "danger" ? "text-[var(--color-danger)]" : expiry.tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]",
                        )}
                      >
                        {expiry.label}
                      </span>
                      {row.trialEndsAt && <span className="ml-2 rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">sinov</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[var(--color-text)]">{formatMoney(row.balance)}</td>
                    <td className="px-5 py-3">
                      <RenewalState row={row} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RenewalState({ row }: { row: BillingRenewal }) {
  const pill = (text: string, tone: "success" | "warning" | "danger" | "neutral") => (
    <span
      className={clsx(
        "inline-flex rounded-full px-3 py-1 text-[12.5px] font-semibold",
        tone === "success" && "bg-[var(--color-success-bg)] text-[var(--color-success)]",
        tone === "warning" && "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
        tone === "danger" && "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
        tone === "neutral" && "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
      )}
    >
      {text}
    </span>
  );
  if (row.organization.status !== "ACTIVE") return pill("Bog'cha to'xtatilgan", "neutral");
  if (row.status === "SUSPENDED") return pill(row.enough ? "Qayta ochiladi" : "To'xtatilgan — pul yo'q", "danger");
  if (row.status === "GRACE_PERIOD") {
    return pill(row.graceUntil ? `Imtiyozli · ${formatDayMonth(row.graceUntil)} gacha` : "Imtiyozli davr", "warning");
  }
  return row.enough ? pill("Pul yetadi", "success") : pill(`Yetmaydi: −${formatCompactMoney(row.plan.priceMonthly - row.balance)}`, "danger");
}

function TransactionsSection() {
  const [type, setType] = useState<"" | WalletTransactionType>("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim(), 300);

  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (debouncedSearch) params.set("search", debouncedSearch);
  // Sana oralig'i: "dan" kiradi, "gacha" kuni ham kiradi (keyingi kun boshigacha)
  if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
  if (to) params.set("to", new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString());
  const filterQuery = params.toString();

  const query = useQuery({
    queryKey: ["billing", "transactions", filterQuery, page],
    queryFn: () =>
      getPaginated<BillingTransaction>(`/platform/billing/transactions?page=${page}&limit=${PAGE_SIZE}${filterQuery ? `&${filterQuery}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const totals = (data?.meta as { totals?: Partial<Record<WalletTransactionType, number>> } | undefined)?.totals ?? {};
  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.limit)) : 1;
  const resetPage = () => setPage(1);

  const fieldClass =
    "h-10 rounded-full bg-[var(--color-surface-sunken)] px-4 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]";

  return (
    <section className={clsx(card, "overflow-hidden")}>
      <div className="space-y-3 px-5 pb-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-medium text-[var(--color-text)]">Hamyon amallari</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Barcha bog&apos;chalar bo&apos;yicha — to&apos;ldirishlar, obuna to&apos;lovlari va tuzatishlar</p>
          </div>
          <a
            href={apiUrl(`/platform/billing/transactions.csv${filterQuery ? `?${filterQuery}` : ""}`)}
            className="inline-flex h-10 items-center rounded-full bg-[var(--color-ink)] px-4 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            CSV yuklab olish
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={clsx(fieldClass, "flex min-w-[220px] flex-1 items-center gap-2 sm:max-w-[280px]")}>
            <SearchIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <span className="sr-only">Bog&apos;cha</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Bog'cha nomi"
              className="w-full bg-transparent"
              style={{ outline: "none" }}
            />
          </label>
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as "" | WalletTransactionType);
              resetPage();
            }}
            aria-label="Turi"
            className={clsx(fieldClass, "cursor-pointer")}
            style={{ outline: "none" }}
          >
            {TX_TYPES.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
            dan
            <input type="date" value={from} onChange={(e) => (setFrom(e.target.value), resetPage())} className={fieldClass} style={{ outline: "none" }} />
          </label>
          <label className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
            gacha
            <input type="date" value={to} onChange={(e) => (setTo(e.target.value), resetPage())} className={fieldClass} style={{ outline: "none" }} />
          </label>
        </div>
        {Object.keys(totals).length > 0 && (
          <div className="flex flex-wrap gap-2 text-[12.5px]">
            {Object.entries(totals).map(([key, sum]) => (
              <span key={key} className="rounded-full bg-[var(--color-surface-sunken)] px-3 py-1 text-[var(--color-text-muted)]">
                {WALLET_TX_TYPE_LABEL[key as WalletTransactionType]}:{" "}
                <b className={clsx("font-semibold tabular-nums", (sum ?? 0) < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text)]")}>
                  {formatMoney(sum ?? 0)}
                </b>
              </span>
            ))}
          </div>
        )}
      </div>

      {query.isError ? (
        <div className="p-5">
          <ErrorState message={(query.error as Error).message} />
        </div>
      ) : !data || data.data.length === 0 ? (
        <p className="px-5 pb-8 pt-4 text-center text-[13.5px] text-[var(--color-text-muted)]">
          {query.isLoading ? "Yuklanmoqda…" : "Bu filtr bo'yicha amal topilmadi"}
        </p>
      ) : (
        <>
          <div className={clsx("overflow-x-auto transition-opacity", query.isFetching && "opacity-70")}>
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-y border-[var(--color-border)] text-[13.5px] text-[var(--color-text-muted)]">
                  <th className="px-5 py-2.5 font-normal">Sana</th>
                  <th className="px-3 py-2.5 font-normal">Bog&apos;cha</th>
                  <th className="px-3 py-2.5 font-normal">Turi</th>
                  <th className="px-3 py-2.5 text-right font-normal">Summa</th>
                  <th className="px-3 py-2.5 text-right font-normal">Balans</th>
                  <th className="px-5 py-2.5 font-normal">Izoh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-separator)]">
                {data.data.map((tx) => (
                  <tr key={tx.id} className="text-[13.5px]">
                    <td className="whitespace-nowrap px-5 py-3 text-[var(--color-text-muted)]">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/bogchalar/${tx.organization.id}`} className="font-medium text-[var(--color-text)] hover:underline">
                        {tx.organization.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text)]">{WALLET_TX_TYPE_LABEL[tx.type]}</td>
                    <td className={clsx("whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums", tx.amount < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]")}>
                      {tx.amount > 0 ? "+" : ""}
                      {formatMoney(tx.amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[var(--color-text)]">{formatMoney(tx.balanceAfter)}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      {tx.note ?? "—"}
                      <span className="block text-[11.5px] text-[var(--color-text-subtle)]">{tx.createdBy ?? "Tizim (avtomatik)"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-separator)] px-5 py-3">
            <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">{formatNumber(data.meta.total)} ta amal</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                aria-label="Oldingi sahifa"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface-sunken)] disabled:cursor-default disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Keyingi sahifa"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface-sunken)] disabled:cursor-default disabled:opacity-40"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
