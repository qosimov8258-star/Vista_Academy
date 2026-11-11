"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Inbox } from "lucide-react";
import { getPaginated } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import { IosButton } from "@/components/ios/button";
import { Group, ListRow } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { CallButton } from "@/components/ios/call-button";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { PhoneIcon } from "@/components/ios/icons";
import { AGE_GROUP_LABEL, STAGE_COLOR, STAGE_LABEL } from "@/features/crm/labels";
import { useTr } from "@/i18n/tr";

/**
 * Arizalar (CRM) — landing sahifadan kelgan xabarlar.
 * Funksiyalar: ro'yxat (100 tagacha), jami soni, bosqich belgisi, ota-onaga
 * qo'ng'iroq, CSV eksport. Qator bosilsa ariza sahifasi ochiladi.
 */
export default function CrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { branchId: forcedBranchId, branchSlug } = useBranchContext(slug);
  const crmHref = branchSlug ? `/${slug}/${branchSlug}/crm` : `/${slug}/crm`;

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(`/app/exports/leads?source=WEBSITE${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`, "arizalar.csv");
    } catch {
      setExportError("Eksport qilib bo'lmadi — qayta urinib ko'ring");
    } finally {
      setExporting(false);
    }
  };

  const leadsQuery = useQuery({
    queryKey: ["leads", slug, forcedBranchId],
    queryFn: () => getPaginated<Lead>(`/app/leads?page=1&limit=100&source=WEBSITE${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`),
  });

  // Faqat landing sahifadan kelgan xabarlar — o'quv rejimi: ko'rish uchun, tahrirlab bo'lmaydi
  const landingLeads = leadsQuery.data?.data ?? [];
  const totalLeads = leadsQuery.data?.meta.total ?? landingLeads.length;

  return (
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        <PageHeaderCard
          icon={PhoneIcon}
          tint="green"
          title={tr("Arizalar (CRM)")}
          count={leadsQuery.data ? tr("{0} ta xabar", totalLeads) : undefined}
          subtitle={tr("Landing sahifadan kelgan xabarlar")}
          actions={<IosButton label={tr("Eksport (CSV)")} icon={Download} compact loading={exporting} onClick={handleExport} />}
        />

        {exportError && (
          <p role="alert" className="rounded-[18px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[13.5px] text-[#ff3b30]">
            {tr(exportError)}
          </p>
        )}

        {leadsQuery.isLoading ? (
          <SkeletonRows rows={6} />
        ) : leadsQuery.isError && !leadsQuery.data ? (
          <ErrorState message={tr((leadsQuery.error as Error).message)} onRetry={() => leadsQuery.refetch()} retrying={leadsQuery.isFetching} />
        ) : landingLeads.length === 0 ? (
          <EmptyState icon={Inbox} title="Hozircha xabar yo'q" hint="Landing sahifadagi forma to'ldirilsa, ariza shu yerda paydo bo'ladi." />
        ) : (
          <Group title={tr("Xabarlar")} refreshing={leadsQuery.isFetching}>
            {landingLeads.map((lead) => (
              <ListRow
                key={lead.id}
                href={`${crmHref}/${lead.id}`}
                avatar={<IosAvatar name={lead.childFullName || lead.parentName} />}
                // Lending formasida bola ismi so'ralmaydi — unda sarlavha arizachi (ota-ona) ismi
                title={tr(lead.childFullName || lead.parentName)}
                subtitle={
                  <>
                    {lead.childFullName ? tr(lead.parentName) : tr("Bola ismi ko'rsatilmagan")}
                    {lead.ageGroup ? ` · ${tr(AGE_GROUP_LABEL[lead.ageGroup])}` : ""}
                    <span className="max-md:hidden"> · {lead.parentPhone}</span>
                    {" · "}
                    <span className="tabular-nums">{formatDate(lead.createdAt)}</span>
                  </>
                }
                meta={<Pill color={STAGE_COLOR[lead.stage]}>{tr(STAGE_LABEL[lead.stage])}</Pill>}
                trailing={<CallButton phone={lead.parentPhone} name={lead.parentName} />}
              />
            ))}
          </Group>
        )}
      </div>
    </div>
  );
}
