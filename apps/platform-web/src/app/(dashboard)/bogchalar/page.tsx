"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { Organization, OrganizationSort, OrganizationStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorState, EmptyState, TableSkeleton } from "@/components/ui/states";
import {
  ArrowUpRightIcon,
  BuildingIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  GlobeIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { expiryLabel, formatDayMonth, formatMoney, formatNumber, initials } from "@/lib/format";
import { organizationAccessUrl } from "@/lib/admin-web";
import { useDebounced } from "@/lib/use-debounced";
import { CreateOrganizationModal } from "@/features/organizations/create-organization-modal";
import { EditOrganizationModal } from "@/features/organizations/edit-organization-modal";
import { OrgStatusPill, useEnterOrganization } from "@/features/organizations/lifecycle";

const PAGE_SIZE = 20;
const VIEW_KEY = "zeeron.orgs.view";

type StatusFilter = "" | OrganizationStatus;
type View = "table" | "cards";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Barchasi" },
  { value: "ACTIVE", label: "Faol" },
  { value: "SUSPENDED", label: "To'xtatilgan" },
  { value: "ARCHIVED", label: "Arxiv" },
];

const SORTS: { value: OrganizationSort; label: string }[] = [
  { value: "created", label: "Yangi qo'shilgan" },
  { value: "name", label: "Nomi (A–Z)" },
  { value: "children", label: "Bolalar soni" },
  { value: "balance", label: "Hamyon balansi" },
];

const isUnlimited = (limit: number | null | undefined) => !limit || limit >= 99999;

// useSearchParams Suspense ichida bo'lishi shart (Next prerender)
export default function BogchalarPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <BogchalarContent />
    </Suspense>
  );
}

function BogchalarContent() {
  const router = useRouter();
  const urlSearch = useSearchParams().get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [status, setStatus] = useState<StatusFilter>("");
  const [sort, setSort] = useState<OrganizationSort>("created");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>("table");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const { enter, mutation: enterMutation } = useEnterOrganization();

  // Yuqoridagi umumiy qidiruvdan kelganda (sahifa ochiq bo'lsa ham) maydon yangilanadi
  useEffect(() => {
    setSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);

  // Ko'rinish (jadval/kartalar) shu brauzerda eslab qolinadi
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "cards") setView("cards");
    } catch {
      // bloklangan saqlash — jadval qoladi
    }
  }, []);
  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // e'tiborsiz
    }
  };

  // Har bir harf uchun emas, yozish tugagach so'rov yuboriladi
  const debouncedSearch = useDebounced(search.trim(), 300);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (status) params.set("status", status);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["organizations", { search: debouncedSearch, status, page, sort }],
    queryFn: () => getPaginated<Organization>(`/platform/organizations?${params.toString()}`),
    placeholderData: keepPreviousData,
  });

  const counts = data?.meta.statusCounts;
  const tabCount = (value: StatusFilter) =>
    counts ? (value ? (counts[value] ?? 0) : (counts.ACTIVE ?? 0) + (counts.SUSPENDED ?? 0)) : null;
  const isFiltered = Boolean(debouncedSearch || status);
  const rangeFrom = data ? (data.meta.page - 1) * data.meta.limit + 1 : 0;
  const rangeTo = data ? Math.min(data.meta.page * data.meta.limit, data.meta.total) : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.limit)) : 1;

  const open = (org: Organization) => router.push(`/bogchalar/${org.id}`);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text)]">Bog&apos;chalar</h1>
          <p className="text-[13.5px] text-[var(--color-text-muted)]">
            {counts
              ? `${(counts.ACTIVE ?? 0) + (counts.SUSPENDED ?? 0)} ta bog'cha${counts.ARCHIVED ? ` · ${counts.ARCHIVED} tasi arxivda` : ""}`
              : "Platformadagi bog'chalar"}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          Yangi bog&apos;cha
        </Button>
      </header>

      {/* Asboblar qatori: qidiruv, holat (sonlar bilan), saralash, ko'rinish */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-11 min-w-0 flex-1 basis-[260px] items-center gap-2.5 rounded-full bg-[var(--color-surface)] px-4 shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/25 sm:max-w-[340px]">
          <SearchIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-text-muted)]" />
          <span className="sr-only">Qidirish</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Nomi, manzil, telefon yoki email"
            className="w-full bg-transparent text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
            style={{ outline: "none" }}
          />
        </label>

        <div
          role="radiogroup"
          aria-label="Holat"
          // Telefonda bitta qatorda gorizontal suriladi — ikki qatorga bo'linmasin
          className="flex max-w-full gap-1.5 overflow-x-auto rounded-full bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)] [scrollbar-width:none]"
        >
          {STATUS_TABS.map((tab) => {
            const active = tab.value === status;
            const count = tabCount(tab.value);
            return (
              <button
                key={tab.value || "all"}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
                className={clsx(
                  "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-medium transition-colors",
                  active ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {tab.label}
                {count !== null && (
                  <span
                    className={clsx(
                      "min-w-[20px] rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums",
                      active ? "bg-white/15" : "bg-[var(--color-surface-sunken)]",
                      tab.value === "SUSPENDED" && count > 0 && !active && "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex h-11 items-center gap-2 rounded-full bg-[var(--color-surface)] pl-4 pr-2 text-[13.5px] shadow-[var(--shadow-card)]">
            <span className="text-[var(--color-text-muted)]">Saralash:</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as OrganizationSort);
                setPage(1);
              }}
              className="cursor-pointer bg-transparent pr-1 font-medium text-[var(--color-text)]"
              style={{ outline: "none" }}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label="Ko'rinish" className="hidden h-11 items-center gap-1 rounded-full bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)] md:flex">
            {(
              [
                { value: "table", label: "Jadval", icon: ListIcon },
                { value: "cards", label: "Kartalar", icon: GridIcon },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={view === option.value}
                aria-label={option.label}
                title={option.label}
                onClick={() => changeView(option.value)}
                className={clsx(
                  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors",
                  view === option.value ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                <option.icon className="h-[17px] w-[17px]" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {enterMutation.error && (
        <p className="text-[13px] text-[var(--color-danger)]">{(enterMutation.error as Error).message}</p>
      )}

      {isError ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <TableSkeleton rows={5} columns={6} />
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title={isFiltered ? "Mos bog'cha topilmadi" : "Hali bog'cha yo'q"}
          description={isFiltered ? "Qidiruv so'zini yoki holat filtrini o'zgartirib ko'ring" : "Birinchi bog'chani qo'shing"}
          action={
            !isFiltered ? (
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                Yangi bog&apos;cha
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Jadval — keng ekranda; telefonda doim kartalar */}
          <div
            className={clsx(
              "overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-opacity",
              view === "table" ? "hidden md:block" : "hidden",
              isFetching && "opacity-70",
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[13.5px] text-[var(--color-text-muted)]">
                    <th className="px-5 py-3.5 font-normal">Bog&apos;cha</th>
                    <th className="px-3 py-3.5 font-normal">Tarif</th>
                    <th className="px-3 py-3.5 font-normal">Bolalar</th>
                    <th className="px-3 py-3.5 text-right font-normal">Filiallar</th>
                    <th className="px-3 py-3.5 text-right font-normal">Hamyon</th>
                    <th className="px-3 py-3.5 font-normal">Holat</th>
                    <th className="px-5 py-3.5 text-right font-normal">
                      <span className="sr-only">Amallar</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-separator)]">
                  {data.data.map((org) => (
                    <tr
                      key={org.id}
                      onClick={() => open(org)}
                      className="group cursor-pointer text-[13.5px] transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <OrgAvatar org={org} />
                          <div className="min-w-0">
                            <Link
                              href={`/bogchalar/${org.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="block truncate text-[14.5px] font-semibold text-[var(--color-text)] hover:underline"
                            >
                              {org.name}
                            </Link>
                            <div className="mt-1">
                              <DomainChip slug={org.slug} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <PlanCell org={org} />
                      </td>
                      <td className="px-3 py-3.5">
                        <ChildrenMeter org={org} />
                      </td>
                      <td
                        className={clsx(
                          "px-3 py-3.5 text-right tabular-nums",
                          org.subscription?.plan &&
                            !isUnlimited(org.subscription.plan.maxBranches) &&
                            org.branches.length > org.subscription.plan.maxBranches
                            ? "font-semibold text-[var(--color-danger)]"
                            : "text-[var(--color-text)]",
                        )}
                      >
                        {org.branches.length}
                        {org.subscription?.plan && !isUnlimited(org.subscription.plan.maxBranches) && (
                          <span className="text-[var(--color-text-subtle)]"> / {org.subscription.plan.maxBranches}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-[var(--color-text)]">
                        {formatMoney(org.wallet?.balance ?? "0")}
                      </td>
                      <td className="px-3 py-3.5">
                        <OrgStatusPill status={org.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <RowActions org={org} onEnter={() => enter(org.id)} onEdit={() => setEditOrg(org)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kartalar */}
          <div
            className={clsx(
              "grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3",
              view === "cards" ? "" : "md:hidden",
              isFetching && "opacity-70",
            )}
          >
            {data.data.map((org) => (
              <article
                key={org.id}
                onClick={() => open(org)}
                className="group flex cursor-pointer flex-col rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-raised)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <OrgAvatar org={org} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold text-[var(--color-text)]">{org.name}</p>
                      <div className="mt-1">
                        <DomainChip slug={org.slug} />
                      </div>
                    </div>
                  </div>
                  <OrgStatusPill status={org.status} />
                </div>

                <div className="mt-4 rounded-[16px] bg-[var(--color-surface-sunken)] px-4 py-3">
                  <PlanCell org={org} />
                </div>

                <div className="mt-4">
                  <ChildrenMeter org={org} wide />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-separator)] pt-3.5 text-[13px]">
                  <span className="text-[var(--color-text-muted)]">
                    {org.branches.length} filial · {formatMoney(org.wallet?.balance ?? "0")}
                  </span>
                  <RowActions org={org} onEnter={() => enter(org.id)} onEdit={() => setEditOrg(org)} />
                </div>
              </article>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
              {rangeFrom}–{rangeTo} / {data.meta.total} ta
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                aria-label="Oldingi sahifa"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-card)] disabled:cursor-default disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Keyingi sahifa"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-card)] disabled:cursor-default disabled:opacity-40"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editOrg && (
        <EditOrganizationModal
          open
          organization={editOrg}
          onClose={() => setEditOrg(null)}
          onDeleted={() => setEditOrg(null)}
        />
      )}
    </div>
  );
}

function OrgAvatar({ org, size = "md" }: { org: Organization; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "flex shrink-0 items-center justify-center font-semibold",
        size === "lg" ? "h-12 w-12 rounded-[16px] text-[15px]" : "h-11 w-11 rounded-[14px] text-[14px]",
        org.status === "ACTIVE"
          ? "bg-[var(--color-ink)] text-white"
          : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
      )}
    >
      {initials(org.name)}
    </span>
  );
}

/** Bog'cha manzili — to'liq domen "pill" ko'rinishida, ochish va nusxalash bilan. */
function DomainChip({ slug }: { slug: string }) {
  const url = organizationAccessUrl(slug);
  const host = url.replace(/^https?:\/\//, "");
  const [copied, setCopied] = useState(false);
  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard yopiq — manzil baribir ko'rinib turibdi
    }
  };
  return (
    <span className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-[var(--color-surface-sunken)] py-0.5 pl-2.5 pr-1 text-[12px] text-[var(--color-text-muted)]">
      <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="ml-1 truncate font-medium hover:text-[var(--color-text)] hover:underline"
      >
        {host}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={`${host} manzilini nusxalash`}
        className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
      >
        {copied ? <CheckIcon className="h-3 w-3 text-[var(--color-success)]" /> : <CopyIcon className="h-3 w-3" />}
      </button>
    </span>
  );
}

function PlanCell({ org }: { org: Organization }) {
  const sub = org.subscription;
  if (!sub || !sub.plan) {
    return <span className="text-[13px] text-[var(--color-text-subtle)]">Tarifsiz</span>;
  }
  const expiry = expiryLabel(sub.currentPeriodEnd);
  const statusNote =
    sub.status === "SUSPENDED" ? "obuna to'xtatilgan" : sub.status === "GRACE_PERIOD" ? "imtiyozli davr" : sub.status === "CANCELLED" ? "bekor qilingan" : null;
  return (
    <div className="min-w-0">
      <p className="flex items-baseline gap-1.5">
        <span className="font-semibold text-[var(--color-text)]">{sub.plan.name}</span>
        <span className="text-[12px] text-[var(--color-text-muted)]">{formatMoney(sub.plan.priceMonthly)}/oy</span>
      </p>
      <p
        className={clsx(
          "mt-0.5 text-[12px]",
          statusNote || expiry.tone === "danger"
            ? "text-[var(--color-danger)]"
            : expiry.tone === "warning"
              ? "text-[var(--color-warning)]"
              : "text-[var(--color-text-muted)]",
        )}
      >
        {statusNote ?? `${formatDayMonth(sub.currentPeriodEnd)} · ${expiry.label}`}
      </p>
    </div>
  );
}

/** Faol bolalar tarif limitiga nisbatan — chiziq, limitdan oshsa qizil. */
function ChildrenMeter({ org, wide }: { org: Organization; wide?: boolean }) {
  const children = org._count?.children ?? 0;
  const limit = org.subscription?.plan?.maxChildren;
  const unlimited = isUnlimited(limit);
  const ratio = unlimited ? 0 : children / (limit as number);
  const over = ratio > 1;
  return (
    <div className={clsx(wide ? "w-full" : "w-[150px]")}>
      <p className="flex items-baseline justify-between gap-2 text-[13px]">
        <span>
          <span className="font-semibold tabular-nums text-[var(--color-text)]">{formatNumber(children)}</span>
          <span className="text-[var(--color-text-subtle)]">{unlimited ? " bola" : ` / ${formatNumber(limit as number)}`}</span>
        </span>
        {over && <span className="text-[11.5px] font-semibold text-[var(--color-danger)]">oshgan</span>}
      </p>
      {!unlimited && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
          <div
            className={clsx(
              "h-full rounded-full",
              over ? "bg-[var(--color-danger)]" : ratio >= 0.85 ? "bg-[var(--color-warning)]" : "bg-[var(--color-accent-muted)]",
            )}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function RowActions({ org, onEnter, onEdit }: { org: Organization; onEnter: () => void; onEdit: () => void }) {
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };
  return (
    <div className="flex items-center justify-end gap-1.5">
      {org.status === "ACTIVE" && (
        <button
          type="button"
          onClick={stop(onEnter)}
          title="Bog'chaga kirish"
          aria-label={`${org.name} paneliga kirish`}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 text-[12.5px] font-semibold text-white opacity-90 transition-opacity hover:opacity-100"
        >
          <ArrowUpRightIcon className="h-3.5 w-3.5" />
          Kirish
        </button>
      )}
      <button
        type="button"
        onClick={stop(onEdit)}
        title="Tahrirlash"
        aria-label={`${org.name} — tahrirlash`}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
