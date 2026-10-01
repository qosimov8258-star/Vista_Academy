"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { CallsList } from "./calls-list";
import { CALL_KIND_LABEL, todayTashkent, type CallKind, type CallsResult } from "./shared";
import { useTr } from "@/i18n/tr";

const KIND_STYLE: Record<CallKind, { dot: string; suffix: string }> = {
  LEAD: { dot: "bg-[var(--accent-bright)]", suffix: "crm" },
  DEBT: { dot: "bg-[#fb7185]", suffix: "debtors" },
  ABSENT: { dot: "bg-[#fbbf24]", suffix: "calls" },
  FAKE_RECEIPT: { dot: "bg-[var(--color-danger)]", suffix: "calls" },
};

const ACTIONS = [
  { label: "Arizalar (CRM)", suffix: "crm" },
  { label: "Qarzdorlar", suffix: "debtors" },
  { label: "Bildirishnomalar", suffix: "notifications" },
  { label: "Qo'ng'iroqlar", suffix: "calls" },
];

function todayLabel() {
  return new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "long", weekday: "long", timeZone: "Asia/Tashkent" }).format(new Date());
}

/**
 * Call operatorning bosh sahifasi: salom, bugun nechta qo'ng'iroq qolgani va
 * turlari bo'yicha bo'linishi, keyin ro'yxatning o'zi. Ovqat, xodimlar davomati
 * kabi operatorga aloqasi yo'q raqamlar bu yerda yo'q.
 */
export function OperatorHome({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const date = todayTashkent();
  // CallsList bilan bir xil kalit — so'rov bir marta yuboriladi
  const calls = useQuery({
    queryKey: ["desk-calls", slug, date],
    queryFn: () => api.get<CallsResult>(`/app/desk/calls?date=${date}`),
    refetchInterval: 60_000,
  });

  const items = calls.data?.items ?? [];
  const open = calls.data?.open ?? 0;
  const total = items.length;
  const doneCount = total - open;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const openBy = (k: CallKind) => items.filter((i) => i.kind === k && !i.done).length;
  const firstName = user?.fullName?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,var(--accent-rail)_0%,var(--accent-rail-2)_100%)] p-5 text-white shadow-[0_18px_40px_-20px_color-mix(in_srgb,var(--accent-rail)_70%,transparent)]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[var(--accent-bright)]/15 blur-2xl" aria-hidden="true" />
        <p className="text-[13px] font-medium text-[var(--accent-pale)]/80">{todayLabel()}</p>
        <h1 data-hero className="mt-0.5 text-[24px] font-bold tracking-[-0.02em]">{tr("Salom")}{firstName ? `, ${firstName}` : ""}</h1>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[44px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{calls.isLoading ? "–" : open}</p>
            <p className="mt-1.5 text-[13px] text-[var(--accent-pale)]/80">{tr("bugun qo'ng'iroq qilish kerak")}</p>
          </div>
          {total > 0 && (
            <div className="text-right">
              <p className="text-[20px] font-bold tabular-nums text-[var(--accent-light)]">{tr(pct)}%</p>
              <p className="text-[12px] text-[var(--accent-pale)]/70">
                {tr(doneCount)}/{tr(total)} {tr("bajarildi")}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--accent-bright)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["LEAD", "DEBT", "ABSENT"] as const).map((k) => (
            <Link
              key={k}
              href={`/${slug}/${KIND_STYLE[k].suffix}`}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-semibold backdrop-blur transition-colors active:bg-white/20"
            >
              <span className={`h-2 w-2 rounded-full ${KIND_STYLE[k].dot}`} aria-hidden="true" />
              {tr(CALL_KIND_LABEL[k])}
              <span className="tabular-nums text-[var(--accent-light)]">{openBy(k)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between px-0.5">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">{tr("Qo'ng'iroqlar")}</h2>
          <Link href={`/${slug}/calls`} className="text-[13px] font-semibold text-[var(--accent-soft-icon)]">
            {tr("Hammasi")}
          </Link>
        </div>
        <CallsList slug={slug} limit={6} />
      </section>

      <section>
        <h2 className="mb-3 px-0.5 text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">{tr("Tez o'tish")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {ACTIONS.map((a) => (
            <Link
              key={a.suffix}
              href={`/${slug}/${a.suffix}`}
              className="flex h-14 items-center justify-center rounded-[18px] border border-[var(--color-border-hair)] bg-[var(--color-surface)] text-[14px] font-semibold text-[var(--color-text)] shadow-[var(--shadow-card)] transition-transform active:scale-[0.97]"
            >
              {tr(a.label)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
