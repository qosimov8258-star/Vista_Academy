"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, getPaginated } from "@/lib/api";
import type { Lead, LeadStage, LeadStats } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate } from "@/lib/format";
import { CreateLeadModal } from "@/features/crm/create-lead-modal";
import { AGE_GROUP_LABEL, SOURCE_LABEL, STAGE_LABEL, STAGE_ORDER, STAGE_TONE } from "@/features/crm/labels";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";

type StageFilter = "ALL" | LeadStage;

export default function CrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  // NOTE: /app/leads/stats does not currently accept a branchId filter (backend
  // limitation, out of scope for this frontend-only change), so these stat
  // cards stay network-wide even inside a branch's panel. The leads list table
  // below IS correctly branch-filtered, which is the primary correctness need.
  const statsQuery = useQuery({
    queryKey: ["lead-stats", slug],
    queryFn: () => api.get<LeadStats>("/app/leads/stats"),
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", slug, page, stageFilter, forcedBranchId],
    queryFn: () =>
      getPaginated<Lead>(
        `/app/leads?page=${page}&limit=20${stageFilter !== "ALL" ? `&stage=${stageFilter}` : ""}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });

  const byStage = statsQuery.data?.byStage;
  const totalActive = byStage ? byStage.NEW + byStage.TRIAL_DAY_SCHEDULED + byStage.CONTRACT : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Arizalar (CRM)
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Yangi mijozlar bilan ishlash bosqichlari</p>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi ariza</Button>}
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="px-4 py-3.5">
          <p className="text-[12px] leading-tight text-[var(--color-text-muted)]">Faol arizalar</p>
          <p className="mt-1.5 text-[22px] font-semibold leading-none tabular-nums text-[var(--color-text)]">
            {totalActive ?? "—"}
          </p>
        </Card>
        {STAGE_ORDER.map((stage) => (
          <Card key={stage} className="px-4 py-3.5">
            <p className="text-[12px] leading-tight text-[var(--color-text-muted)]">{STAGE_LABEL[stage]}</p>
            <p className="mt-1.5 text-[22px] font-semibold leading-none tabular-nums text-[var(--color-text)]">
              {byStage ? byStage[stage] : "—"}
            </p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setStageFilter("ALL");
            setPage(1);
          }}
          className={clsx(
            "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
            stageFilter === "ALL"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
          )}
        >
          Barchasi
        </button>
        {STAGE_ORDER.map((stage) => (
          <button
            key={stage}
            onClick={() => {
              setStageFilter(stage);
              setPage(1);
            }}
            className={clsx(
              "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
              stageFilter === stage
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {STAGE_LABEL[stage]}
          </button>
        ))}
      </div>

      {leadsQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : leadsQuery.isError ? (
        <ErrorState message={(leadsQuery.error as Error).message} />
      ) : !leadsQuery.data || leadsQuery.data.data.length === 0 ? (
        <EmptyState title="Ariza topilmadi" description={canWrite ? "Yangi ariza qo'shish uchun tugmani bosing" : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>Bola</Th>
                <Th>Ota-ona</Th>
                <Th>Yosh guruhi</Th>
                <Th>Manba</Th>
                <Th>Bosqich</Th>
                <Th>Sana</Th>
              </tr>
            </THead>
            <TBody>
              {leadsQuery.data.data.map((lead) => (
                <Tr key={lead.id}>
                  <Td className="font-medium">
                    <Link href={`/${slug}/crm/${lead.id}`} className="text-[var(--color-primary)] hover:underline">
                      {lead.childFullName}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-medium text-[var(--color-text)]">{lead.parentName}</span>
                    <br />
                    <span className="text-[12.5px] tabular-nums text-[var(--color-text-muted)]">
                      {lead.parentPhone}
                    </span>
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">
                    {lead.ageGroup ? AGE_GROUP_LABEL[lead.ageGroup] : "—"}
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">{SOURCE_LABEL[lead.source]}</Td>
                  <Td>
                    <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>
                  </Td>
                  <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDate(lead.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>

          <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
            <span className="tabular-nums">
              Jami {leadsQuery.data.meta.total} ta, {leadsQuery.data.meta.page}-sahifa
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * leadsQuery.data.meta.limit >= leadsQuery.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {canWrite && <CreateLeadModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
    </div>
  );
}
