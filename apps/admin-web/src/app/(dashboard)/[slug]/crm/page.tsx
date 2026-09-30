"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopbarAction } from "@/components/layout/topbar-action";
import clsx from "clsx";
import { PhoneIcon } from "@/components/ui/icons";
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
import { downloadCsv } from "@/lib/download";
import { CreateLeadModal } from "@/features/crm/create-lead-modal";
import { AGE_GROUP_LABEL, SOURCE_LABEL, SOURCE_ORDER, STAGE_LABEL, STAGE_ORDER, STAGE_TONE } from "@/features/crm/labels";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";

type StageFilter = "ALL" | LeadStage;

export default function CrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(`/app/exports/leads${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`, "arizalar.csv");
    } catch {
      setExportError("Eksport qilib bo'lmadi — qayta urinib ko'ring");
    } finally {
      setExporting(false);
    }
  };

  const statsQuery = useQuery({
    queryKey: ["lead-stats", slug, forcedBranchId],
    queryFn: () => api.get<LeadStats>(`/app/leads/stats${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
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
        {/* Mobilda "+ Yangi ariza" sarlavha qatorining o'ng tomonida turadi, kompyuterda esa avvalgidek tugmalar guruhida */}
        <div className="flex w-full items-start justify-between gap-3 md:w-auto">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
              Arizalar (CRM)
            </h1>
            <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Yangi mijozlar bilan ishlash bosqichlari</p>
          </div>
          {canWrite && (
            <div className="shrink-0 md:hidden">
              <Button onClick={() => setCreateOpen(true)}>+ Yangi ariza</Button>
            </div>
          )}
        </div>
        <TopbarAction>
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            Eksport (CSV)
          </Button>
        </TopbarAction>
        <div className="hidden gap-2 md:flex">
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            Eksport (CSV)
          </Button>
          {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi ariza</Button>}
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {exportError}
        </div>
      )}

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {/* Telefonda raqamlar bir qatorda yonga suriladi — ekranning yarmini egallamaydi */}
      <div className="-mx-6 flex gap-2.5 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[128px] shrink-0 rounded-[var(--radius-xl)] bg-[linear-gradient(145deg,var(--accent-rail)_0%,var(--accent-rail-2)_100%)] px-4 py-3.5 text-white shadow-[var(--shadow-card)] md:min-w-0">
          <p className="text-[12px] leading-tight text-[var(--accent-pale)]/80">Faol arizalar</p>
          <p className="mt-1.5 text-[24px] font-bold leading-none tabular-nums">{totalActive ?? "—"}</p>
        </div>
        {STAGE_ORDER.map((stage) => (
          <Card key={stage} className="min-w-[128px] shrink-0 px-4 py-3.5 md:min-w-0">
            <p className="text-[12px] leading-tight text-[var(--color-text-muted)]">{STAGE_LABEL[stage]}</p>
            <p className="mt-1.5 text-[22px] font-semibold leading-none tabular-nums text-[var(--color-text)]">
              {byStage ? byStage[stage] : "—"}
            </p>
          </Card>
        ))}
      </div>

      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {SOURCE_ORDER.map((source) => (
          <Card key={source} className="min-w-[112px] shrink-0 px-4 py-3 md:min-w-0 md:py-3.5">
            <p className="text-[12px] leading-tight text-[var(--color-text-muted)]">{SOURCE_LABEL[source]}</p>
            <p className="mt-1.5 text-[18px] font-semibold leading-none tabular-nums text-[var(--color-text)]">
              {statsQuery.data ? statsQuery.data.bySource[source] : "—"}
            </p>
          </Card>
        ))}
      </div>

      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden [&>button]:shrink-0 [&>button]:whitespace-nowrap">
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
        <>
        {/* Telefonda jadval o'rniga kartochkalar: bola, ota-ona telefoni, bosqich */}
        <ul className="space-y-3 md:hidden">
          {leadsQuery.data.data.map((lead) => {
            const overdue =
              !!lead.followUpDate && lead.stage !== "WON" && lead.stage !== "LOST" && new Date(lead.followUpDate) < new Date();
            return (
              <li key={lead.id} className="rounded-[20px] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/${slug}/crm/${lead.id}`} className="min-w-0 text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">
                    {lead.childFullName}
                  </Link>
                  <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>
                </div>
                <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                  {lead.parentName} · {lead.ageGroup ? AGE_GROUP_LABEL[lead.ageGroup] : SOURCE_LABEL[lead.source]}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${lead.parentPhone}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 text-[14.5px] font-semibold tabular-nums text-[var(--accent-soft-ink)] active:scale-[0.98]"
                  >
                    <PhoneIcon className="h-4 w-4 text-[var(--accent-soft-icon)]" />
                    {lead.parentPhone}
                  </a>
                  {lead.followUpDate && (
                    <span className={clsx("text-[12.5px] tabular-nums", overdue ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>
                      {overdue ? "Kechikdi · " : "Eslatma · "}
                      {formatDate(lead.followUpDate)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <Card className="hidden overflow-hidden md:block">
          <DataTable>
            <THead>
              <tr>
                <Th>Bola</Th>
                <Th>Ota-ona</Th>
                <Th>Yosh guruhi</Th>
                <Th>Manba</Th>
                <Th>Bosqich</Th>
                <Th>Mas&apos;ul</Th>
                <Th>Eslatma</Th>
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
                  <Td className="text-[var(--color-text-muted)]">{lead.assignedTo?.fullName ?? "—"}</Td>
                  <Td className="tabular-nums">
                    {lead.followUpDate ? (
                      <span
                        className={
                          lead.stage !== "WON" && lead.stage !== "LOST" && new Date(lead.followUpDate) < new Date()
                            ? "font-medium text-[var(--color-danger)]"
                            : "text-[var(--color-text-muted)]"
                        }
                      >
                        {formatDate(lead.followUpDate)}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
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
        <div className="flex items-center justify-between gap-3 text-[12.5px] text-[var(--color-text-muted)] md:hidden">
          <span className="tabular-nums">Jami {leadsQuery.data.meta.total} ta, {leadsQuery.data.meta.page}-sahifa</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Oldingi</Button>
            <Button variant="outline" size="sm" disabled={page * leadsQuery.data.meta.limit >= leadsQuery.data.meta.total} onClick={() => setPage((p) => p + 1)}>Keyingi</Button>
          </div>
        </div>
        </>
      )}

      {canWrite && <CreateLeadModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
    </div>
  );
}
