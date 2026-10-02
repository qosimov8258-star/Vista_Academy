"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopbarAction } from "@/components/layout/topbar-action";
import { PhoneIcon } from "@/components/ui/icons";
import { api, getPaginated } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { AGE_GROUP_LABEL } from "@/features/crm/labels";
import { useBranchContext } from "@/lib/use-branch-context";
import { useTr } from "@/i18n/tr";

export default function CrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(`/app/exports/leads${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`, "arizalar.csv");
    } catch {
      setExportError(tr("Eksport qilib bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setExporting(false);
    }
  };

  const leadsQuery = useQuery({
    queryKey: ["leads", slug, forcedBranchId],
    queryFn: () => getPaginated<Lead>(`/app/leads?page=1&limit=100${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`),
  });

  // Faqat landing sahifadan kelgan xabarlar — o'quv rejimi: ko'rish uchun, tahrirlab bo'lmaydi
  const landingLeads = leadsQuery.data?.data.filter((lead) => lead.source === "WEBSITE") ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {tr("Arizalar (CRM)")}
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            {tr("Landing sahifadan kelgan xabarlar — faqat ko'rish uchun")}
          </p>
        </div>
        <TopbarAction>
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            {tr("Eksport (CSV)")}
          </Button>
        </TopbarAction>
        <div className="hidden md:flex">
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            {tr("Eksport (CSV)")}
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {tr(exportError)}
        </div>
      )}

      {leadsQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : leadsQuery.isError ? (
        <ErrorState message={tr((leadsQuery.error as Error).message)} />
      ) : landingLeads.length === 0 ? (
        <EmptyState title={tr("Hozircha xabar yo'q")} />
      ) : (
        <>
          <p className="text-[13px] tabular-nums text-[var(--color-text-muted)]">{tr("Jami")}{" "}{tr(landingLeads.length)} {tr("ta xabar")}</p>
          {/* Telefonda jadval o'rniga kartochkalar */}
          <ul className="space-y-3 md:hidden">
            {landingLeads.map((lead) => (
              <li key={lead.id} className="rounded-[20px] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
                <p className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">{tr(lead.childFullName)}</p>
                <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                  {tr(lead.parentName)}
                  {lead.ageGroup ? ` · ${AGE_GROUP_LABEL[lead.ageGroup]}` : ""}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${lead.parentPhone}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 text-[14.5px] font-semibold tabular-nums text-[var(--accent-soft-ink)] active:scale-[0.98]"
                  >
                    <PhoneIcon className="h-4 w-4 text-[var(--accent-soft-icon)]" />
                    {tr(lead.parentPhone)}
                  </a>
                  <span className="text-[12.5px] tabular-nums text-[var(--color-text-muted)]">{formatDate(lead.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
          <Card className="hidden overflow-hidden md:block">
            <DataTable>
              <THead>
                <tr>
                  <Th>{tr("Bola")}</Th>
                  <Th>{tr("Ota-ona")}</Th>
                  <Th>{tr("Yosh guruhi")}</Th>
                  <Th>{tr("Sana")}</Th>
                </tr>
              </THead>
              <TBody>
                {landingLeads.map((lead) => (
                  <Tr key={lead.id}>
                    <Td className="font-medium">{tr(lead.childFullName)}</Td>
                    <Td>
                      <span className="font-medium text-[var(--color-text)]">{tr(lead.parentName)}</span>
                      <br />
                      <span className="text-[12.5px] tabular-nums text-[var(--color-text-muted)]">{tr(lead.parentPhone)}</span>
                    </Td>
                    <Td className="text-[var(--color-text-muted)]">{lead.ageGroup ? AGE_GROUP_LABEL[lead.ageGroup] : "—"}</Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDate(lead.createdAt)}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          </Card>
        </>
      )}
    </div>
  );
}
