"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { useBranchContext } from "@/lib/use-branch-context";

export default function AuditLogsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const logsQuery = useQuery({
    queryKey: ["audit-logs", slug, page, forcedBranchId],
    queryFn: () =>
      getPaginated<AuditLogEntry>(
        `/app/audit-logs?page=${page}&limit=30${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <Link
        href={`/${slug}/users`}
        className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
        Administratorlar
      </Link>

      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
          Faoliyat jurnali
        </h1>
        <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
          Kim, qachon, nima o&apos;zgartirgani — hisoblar va moliya bo&apos;yicha
        </p>
      </div>

      {logsQuery.isLoading ? (
        <LoadingState rows={8} />
      ) : logsQuery.isError ? (
        <ErrorState message={(logsQuery.error as Error).message} />
      ) : !logsQuery.data || logsQuery.data.data.length === 0 ? (
        <EmptyState title="Hali yozuv yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>Vaqt</Th>
                <Th>Kim</Th>
                <Th>Amal</Th>
              </tr>
            </THead>
            <TBody>
              {logsQuery.data.data.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="whitespace-nowrap tabular-nums text-[var(--color-text-muted)]">
                    {formatDateTime(entry.createdAt)}
                  </Td>
                  <Td className="font-medium">{entry.actorName}</Td>
                  <Td className="text-[var(--color-text-muted)]">{entry.summary}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>

          <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
            <span className="tabular-nums">
              Jami {logsQuery.data.meta.total} ta, {logsQuery.data.meta.page}-sahifa
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * logsQuery.data.meta.limit >= logsQuery.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
