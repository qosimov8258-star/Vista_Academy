"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/features/subscriptions/status";
import { CreateOrganizationModal } from "@/features/organizations/create-organization-modal";

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["organizations", { search, status, page }],
    queryFn: () => getPaginated<Organization>(`/platform/organizations?${params.toString()}`),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Tashkilotlar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Bog'chalar tarmoqlari (tenant)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Yangi tashkilot</Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Nomi bo'yicha qidirish..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="sm:max-w-xs"
          />
          <Select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="sm:max-w-[180px]"
          >
            <option value="">Barcha holatlar</option>
            <option value="ACTIVE">Faol</option>
            <option value="SUSPENDED">To'xtatilgan</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Tashkilot topilmadi" description="Qidiruv shartlarini o'zgartiring yoki yangi tashkilot yarating" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Tashkilot</th>
                  <th className="px-5 py-3 font-medium">Filiallar</th>
                  <th className="px-5 py-3 font-medium">Obuna</th>
                  <th className="px-5 py-3 font-medium">Hamyon</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium">Yaratilgan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.data.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/organizations/${org.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                        {org.name}
                      </Link>
                      <p className="text-xs text-[var(--color-text-muted)]">{org.contactEmail ?? org.contactPhone ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text)]">{org.branches.length}</td>
                    <td className="px-5 py-3">
                      {org.subscription ? (
                        <Badge tone={subscriptionStatusTone(org.subscription.status)}>
                          {subscriptionStatusLabel(org.subscription.status)}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Obunasiz</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text)]">
                      {org.wallet ? formatMoney(org.wallet.balance, org.wallet.currency) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={org.status === "ACTIVE" ? "success" : "danger"}>
                        {org.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDate(org.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-muted)]">
            <span>
              Jami {data.meta.total} ta, {data.meta.page}-sahifa
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * data.meta.limit >= data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </Button>
            </div>
          </div>
        </Card>
      )}

      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
