"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Lead, LeadActivity } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate, formatDateTime } from "@/lib/format";
import { ACTIVITY_LABEL, AGE_GROUP_LABEL, SOURCE_LABEL, STAGE_LABEL, STAGE_TONE } from "@/features/crm/labels";
import { ChangeStageModal } from "@/features/crm/change-stage-modal";
import { ConvertLeadModal } from "@/features/crm/convert-lead-modal";
import { AssignLeadModal } from "@/features/crm/assign-lead-modal";
import { EditLeadDetailsModal } from "@/features/crm/edit-lead-details-modal";
import { LeadActivityForm } from "@/features/crm/lead-activity-form";
import { useBranchContext } from "@/lib/use-branch-context";
import { isCallOperatorUser } from "@/lib/employee-position";
import { canWriteOperational } from "@/lib/permissions";
import { useTr } from "@/i18n/tr";

type LeadActivityWithCreator = LeadActivity & { createdBy?: { id: string; fullName: string } | null };
type LeadDetail = Lead & {
  activities?: LeadActivityWithCreator[];
  assignedTo?: { id: string; fullName: string } | null;
};

export default function LeadDetailPage({ params }: { params: Promise<{ slug: string; leadId: string }> }) {
  const tr = useTr();
  const { slug, leadId } = use(params);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const { user } = useAuth();
  const callOperator = isCallOperatorUser(user);
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug, base } = useBranchContext(slug);
  const crmHref = branchSlug ? `/${slug}/${branchSlug}/crm` : `/${slug}/crm`;

  const leadQuery = useQuery({
    queryKey: ["lead", slug, leadId],
    queryFn: () => api.get<LeadDetail>(`/app/leads/${leadId}`),
  });

  if (leadQuery.isLoading) return <LoadingState />;
  if (leadQuery.isError) return <ErrorState message={tr((leadQuery.error as Error).message)} />;
  const lead = leadQuery.data;
  if (!lead) return null;

  const isFinal = lead.stage === "WON" || lead.stage === "LOST";
  const isConverted = Boolean(lead.convertedChildId);
  const activities = lead.activities ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={crmHref} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          {tr("← Arizalar")}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{tr(lead.childFullName)}</h1>
          <Badge tone={STAGE_TONE[lead.stage]}>{tr(STAGE_LABEL[lead.stage])}</Badge>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {tr(lead.parentName)} • {tr(lead.parentPhone)}
          {lead.ageGroup ? ` • ${AGE_GROUP_LABEL[lead.ageGroup]}` : ""} • {tr(SOURCE_LABEL[lead.source])}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr("Yaratildi:")}{" "}{formatDate(lead.createdAt)} {tr("• Mas'ul:")}{" "}{lead.assignedTo?.fullName ?? "—"}
        </p>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {lead.lostReason && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {tr("Yo'qotish sababi:")}{" "}{tr(lead.lostReason)}
        </div>
      )}

      {isConverted && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-success)]">{tr("Bu ariza bola profiliga aylantirilgan")}</p>
          {!callOperator && (
            <Link href={`${base}/children/${lead.convertedChildId}`}>
              <Button size="sm" variant="outline">
                {tr("Bola profilini ko'rish →")}
              </Button>
            </Link>
          )}
        </div>
      )}

      {canWrite && !isConverted && (
        <Card>
          <CardHeader>
            <CardTitle>{tr("Amallar")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStageModalOpen(true)}>
              {tr("Bosqichni o'zgartirish")}
            </Button>
            <Button variant="outline" onClick={() => setAssignModalOpen(true)}>
              {tr("Mas'ulni belgilash")}
            </Button>
            {/* Bola yaratish call operatorning ishi emas — uni administrator qiladi */}
            {!isFinal && !callOperator && <Button onClick={() => setConvertModalOpen(true)}>{tr("Bolaga aylantirish")}</Button>}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>{tr("Tafsilotlar")}</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setDetailsModalOpen(true)}>
              {tr("Tahrirlash")}
            </Button>
          )}
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr("Keyingi bog'lanish")}</p>
            <p
              className={`mt-1 text-[14px] font-medium ${
                lead.followUpDate && !isFinal && new Date(lead.followUpDate) < new Date()
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-text)]"
              }`}
            >
              {lead.followUpDate ? formatDate(lead.followUpDate) : "Belgilanmagan"}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr("Sinov kuni")}</p>
            <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">
              {lead.trialDate ? formatDate(lead.trialDate) : "Belgilanmagan"}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr("Shartnoma sanasi")}</p>
            <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">
              {lead.contractDate ? formatDate(lead.contractDate) : "Belgilanmagan"}
            </p>
          </div>
          {lead.contractNote && (
            <div className="col-span-2 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3 sm:col-span-3">
              <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr("Shartnoma izohi")}</p>
              <p className="mt-1 text-[14px] text-[var(--color-text)]">{tr(lead.contractNote)}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr("Faoliyat tarixi")}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{tr("Hali faoliyat yo'q")}</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-lg border border-[var(--color-border)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--color-text)]">{tr(ACTIVITY_LABEL[activity.type])}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(activity.createdAt)}</span>
                  </div>
                  {activity.note && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{tr(activity.note)}</p>}
                  {activity.createdBy && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{tr(activity.createdBy.fullName)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <div className="border-t border-[var(--color-border)] pt-4">
              <LeadActivityForm slug={slug} leadId={leadId} />
            </div>
          )}
        </CardBody>
      </Card>

      {canWrite && (
        <ChangeStageModal
          open={stageModalOpen}
          onClose={() => setStageModalOpen(false)}
          slug={slug}
          leadId={leadId}
          currentStage={lead.stage}
        />
      )}
      {canWrite && (
        <ConvertLeadModal open={convertModalOpen} onClose={() => setConvertModalOpen(false)} slug={slug} leadId={leadId} />
      )}
      {canWrite && (
        <AssignLeadModal
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          slug={slug}
          leadId={leadId}
          currentAssignedToUserId={lead.assignedTo?.id}
        />
      )}
      {canWrite && detailsModalOpen && (
        <EditLeadDetailsModal
          open={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          slug={slug}
          leadId={leadId}
          lead={lead}
        />
      )}
    </div>
  );
}
