"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { Organization } from "@/lib/types";
import { Button, IconButton } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, EmptyState, TableSkeleton } from "@/components/ui/states";
import {
  BuildingIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  PlusIcon,
} from "@/components/ui/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { organizationAccessUrl } from "@/lib/admin-web";
import { useDebounced } from "@/lib/use-debounced";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/features/subscriptions/status";
import { CreateOrganizationModal } from "@/features/organizations/create-organization-modal";
import { EditOrganizationModal } from "@/features/organizations/edit-organization-modal";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "Barchasi" },
  { value: "ACTIVE", label: "Faol" },
  { value: "SUSPENDED", label: "To'xtatilgan" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

// Tashkilot nomidan avatar uchun bosh harf
function initial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

export default function BogchalarPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);

  // Har bir harf uchun emas, yozish tugagach so'rov yuboriladi
  const debouncedSearch = useDebounced(search, 300);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (status) params.set("status", status);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["organizations", { search: debouncedSearch, status, page }],
    queryFn: () => getPaginated<Organization>(`/platform/organizations?${params.toString()}`),
    placeholderData: (prev) => prev,
  });

  const resetToFirstPage = () => setPage(1);
  const isFiltered = Boolean(debouncedSearch || status);

  const rangeFrom = data ? (data.meta.page - 1) * data.meta.limit + 1 : 0;
  const rangeTo = data ? Math.min(data.meta.page * data.meta.limit, data.meta.total) : 0;
  const hasNextPage = data ? data.meta.page * data.meta.limit < data.meta.total : false;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bog'chalar"
        description="Bog'chalar tarmoqlari (tenant)"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Yangi bog&apos;cha
          </Button>
        }
      />

      {/* Filtrlar paneli emas, yengil asboblar qatori — ortiqcha ramka yo'q */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onValueChange={(value) => {
            resetToFirstPage();
            setSearch(value);
          }}
          placeholder="Nomi bo'yicha qidirish"
          aria-label="Bog'cha nomi bo'yicha qidirish"
          className="sm:max-w-xs sm:flex-1"
        />
        <Segmented
          ariaLabel="Holat bo'yicha filtr"
          options={[...STATUS_OPTIONS]}
          value={status}
          onChange={(value) => {
            resetToFirstPage();
            setStatus(value);
          }}
          className="w-full sm:w-auto"
        />
      </div>

      {isError ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <Card className="overflow-hidden">
          <TableSkeleton rows={5} columns={5} />
        </Card>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title={isFiltered ? "Mos bog'cha topilmadi" : "Hali bog'cha yo'q"}
          description={
            isFiltered
              ? "Qidiruv so'zini yoki holat filtrini o'zgartirib ko'ring"
              : "Birinchi bog'chalar tarmog'ini yarating"
          }
          action={
            isFiltered ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  resetToFirstPage();
                }}
              >
                Filtrlarni tozalash
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                Yangi bog&apos;cha
              </Button>
            )
          }
        />
      ) : (
        <Card
          className={`overflow-hidden transition-opacity duration-200 ${isFetching ? "opacity-60" : "opacity-100"}`}
        >
          {/* Katta ekranda jadval */}
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-sunken)] text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Bog&apos;cha</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Filiallar</th>
                  <th className="px-3 py-2.5 font-semibold">Obuna</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Hamyon</th>
                  <th className="px-3 py-2.5 font-semibold">Holat</th>
                  <th className="px-3 py-2.5 font-semibold">Yaratilgan</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-separator)]">
                {data.data.map((org) => (
                  <tr
                    key={org.id}
                    // Qator butunlay bosiladigan — nomga aniq tegish shart emas.
                    // Ichkaridagi havola/tugmalar o'z bosilishini to'xtatadi.
                    onClick={() => router.push(`/bogchalar/${org.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--color-primary-soft)] text-[14px] font-semibold text-[var(--color-primary)]"
                        >
                          {initial(org.name)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/bogchalar/${org.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate text-[14px] font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                          >
                            {org.name}
                          </Link>
                          <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
                            <span className="truncate">
                              {org.contactEmail ?? org.contactPhone ?? "aloqa ma'lumoti yo'q"}
                            </span>
                            <a
                              href={organizationAccessUrl(org.slug)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Bog'cha paneliga kirish"
                              className="inline-flex shrink-0 items-center gap-1 text-[var(--color-primary)] hover:underline"
                            >
                              /{org.slug}
                              <ExternalLinkIcon className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">
                      {org.branches.length}
                    </td>
                    <td className="px-3 py-3">
                      {org.subscription ? (
                        <Badge dot tone={subscriptionStatusTone(org.subscription.status)}>
                          {subscriptionStatusLabel(org.subscription.status)}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Tarifsiz</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">
                      {org.wallet ? formatMoney(org.wallet.balance, org.wallet.currency) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge dot tone={org.status === "ACTIVE" ? "success" : "danger"}>
                        {org.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
                      {formatDate(org.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditOrg(org);
                          }}
                        >
                          Tahrirlash
                        </Button>
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)] transition-transform duration-150 group-hover:translate-x-0.5" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Telefonda jadval o'rniga qatorlar ro'yxati — yon tomonga siljitish shart emas */}
          <ul className="divide-y divide-[var(--color-separator)] md:hidden">
            {data.data.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/bogchalar/${org.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-[var(--color-surface-hover)]"
                >
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-primary-soft)] text-[15px] font-semibold text-[var(--color-primary)]"
                  >
                    {initial(org.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[var(--color-text)]">{org.name}</p>
                    <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {org.branches.length} filial ·{" "}
                      {org.wallet ? formatMoney(org.wallet.balance, org.wallet.currency) : "hamyon yo'q"}
                    </p>
                    {/* Jadvaldagidek ustun sarlavhalari yo'q, shuning uchun ikkita
                        "Faol" yonma-yon turmasin: tashkilot holati faqat u
                        odatdagidan chetga chiqqanda (to'xtatilgan) ko'rsatiladi,
                        obuna holati esa doim. */}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {org.status !== "ACTIVE" && (
                        <Badge dot tone="danger">
                          To&apos;xtatilgan
                        </Badge>
                      )}
                      {org.subscription ? (
                        <Badge dot tone={subscriptionStatusTone(org.subscription.status)}>
                          Obuna: {subscriptionStatusLabel(org.subscription.status).toLowerCase()}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Obunasiz</Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)]" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-4 py-2.5 sm:px-5">
            <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
              {rangeFrom}–{rangeTo} / {data.meta.total} ta
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                label="Oldingi sahifa"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </IconButton>
              <IconButton label="Keyingi sahifa" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>
                <ChevronRightIcon className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </Card>
      )}

      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editOrg && <EditOrganizationModal open organization={editOrg} onClose={() => setEditOrg(null)} />}
    </div>
  );
}
