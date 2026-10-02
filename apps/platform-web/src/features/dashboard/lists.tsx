"use client";

import Link from "next/link";
import clsx from "clsx";
import type { DashboardAnalytics } from "@/lib/types";
import { expiryLabel, formatDayMonth, formatMoney, initials } from "@/lib/format";
import { WALLET_TX_TYPE_LABEL } from "@/features/organizations/wallet-labels";
import { ArrowUpRightIcon, RefreshIcon } from "@/components/ui/icons";

/** Pul kirimi (to'ldirish/bonus) — to'q pill, chiqim/tuzatish — och pill. */
const INCOMING = new Set(["TOP_UP", "BONUS", "REFUND"]);

export function RecentTransactions({
  items,
  onRefresh,
  refreshing,
}: {
  items: DashboardAnalytics["recentTransactions"];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 className="text-[17px] font-medium text-[var(--color-text)]">So&apos;nggi hamyon amallari</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Yangilash"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
          >
            <RefreshIcon className={clsx("h-4 w-4", refreshing && "animate-spin")} />
          </button>
          <Link
            href="/bogchalar"
            aria-label="Bog'chalar"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
          >
            <ArrowUpRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 pb-8 pt-4 text-center text-[13.5px] text-[var(--color-text-muted)]">Hali hamyon amallari yo&apos;q</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-y border-[var(--color-border)] text-[14px] text-[var(--color-text-muted)]">
                <th className="px-5 py-3 font-normal">Bog&apos;cha</th>
                <th className="px-3 py-3 font-normal">Kim kiritdi</th>
                <th className="px-3 py-3 font-normal">Sana</th>
                <th className="px-3 py-3 text-right font-normal">Summa</th>
                <th className="px-5 py-3 font-normal">Turi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-separator)]">
              {items.map((tx) => (
                <tr key={tx.id} className="text-[13.5px] transition-colors hover:bg-[var(--color-surface-hover)]">
                  <td className="px-5 py-3">
                    <Link href={`/bogchalar/${tx.organization.id}`} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-surface-sunken)] text-[13px] font-semibold text-[var(--color-text)]"
                      >
                        {initials(tx.organization.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--color-text)]">{tx.organization.name}</span>
                        {tx.note && <span className="block truncate text-[12px] text-[var(--color-text-muted)]">{tx.note}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-text)]">{tx.createdBy ?? "Tizim"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--color-text)]">{formatDayMonth(tx.createdAt)}</td>
                  <td
                    className={clsx(
                      "whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums",
                      tx.amount < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text)]",
                    )}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {formatMoney(tx.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={clsx(
                        "inline-flex rounded-full px-4 py-1.5 text-[12.5px] font-medium",
                        INCOMING.has(tx.type)
                          ? "bg-[var(--color-accent-muted)] text-white"
                          : "bg-[var(--color-surface-sunken)] text-[var(--color-text)]",
                      )}
                    >
                      {WALLET_TX_TYPE_LABEL[tx.type]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Qora karta: muddati o'tgan va yaqinda tugaydigan obunalar — operator navbati. */
export function ExpiringCard({ items }: { items: DashboardAnalytics["expiring"] }) {
  const overdue = items.filter((item) => new Date(item.periodEnd).getTime() < Date.now()).length;
  return (
    <section className="flex flex-col rounded-[var(--radius-xl)] bg-[var(--color-ink)] p-5 text-[var(--color-ink-text)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-medium">Muddati tugayotganlar</h2>
          <p className="text-[12.5px] text-[var(--color-ink-muted)]">
            {items.length === 0
              ? "14 kun ichida tugaydigan obuna yo'q"
              : overdue > 0
                ? `${overdue} tasining muddati o'tgan — uzaytiring yoki to'xtating`
                : "14 kun ichida tugaydi"}
          </p>
        </div>
        <Link
          href="/subscriptions"
          aria-label="Obunalar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink-raised)] text-white transition-colors hover:bg-[#3a3a3f]"
        >
          <ArrowUpRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <ul className="mt-4 flex-1 space-y-1 overflow-y-auto">
        {items.slice(0, 7).map((item) => {
          const expiry = expiryLabel(item.periodEnd);
          return (
            <li key={item.organization.id}>
              <Link
                href={`/bogchalar/${item.organization.id}`}
                className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{item.organization.name}</span>
                  <span className="block text-[12px] text-[var(--color-ink-muted)]">
                    {item.plan.name} · {formatDayMonth(item.periodEnd)}
                  </span>
                </span>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                    expiry.tone === "danger"
                      ? "bg-[var(--color-danger-on-ink)]/15 text-[var(--color-danger-on-ink)]"
                      : expiry.tone === "warning"
                        ? "bg-amber-300/15 text-amber-300"
                        : "bg-white/10 text-[var(--color-ink-text)]",
                  )}
                >
                  {expiry.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length > 7 && (
        <Link href="/subscriptions" className="mt-2 text-center text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-white">
          Yana {items.length - 7} ta
        </Link>
      )}
    </section>
  );
}
