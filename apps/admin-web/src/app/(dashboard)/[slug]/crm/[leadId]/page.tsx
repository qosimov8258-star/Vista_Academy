"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
import { activityLabel, ageGroupLabel, sourceLabel, stageLabel, STAGE_TONE } from "@/features/crm/labels";
import { ChangeStageModal } from "@/features/crm/change-stage-modal";
import { ConvertLeadModal } from "@/features/crm/convert-lead-modal";
import { AssignLeadModal } from "@/features/crm/assign-lead-modal";
import { EditLeadDetailsModal } from "@/features/crm/edit-lead-details-modal";
import { LeadActivityForm } from "@/features/crm/lead-activity-form";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";

type LeadActivityWithCreator = LeadActivity & { createdBy?: { id: string; fullName: string } | null };
type LeadDetail = Lead & {
  activities?: LeadActivityWithCreator[];
  assignedTo?: { id: string; fullName: string } | null;
};

export default function LeadDetailPage({ params }: { params: Promise<{ slug: string; leadId: string }> }) {
  const { slug, leadId } = use(params);
  const t = useTranslations("crm");
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug } = useBranchContext(slug);
  const crmHref = branchSlug ? `/${slug}/${branchSlug}/crm` : `/${slug}/crm`;

  const leadQuery = useQuery({
    queryKey: ["lead", slug, leadId],
    queryFn: () => api.get<LeadDetail>(`/app/leads/${leadId}`),
  });

  if (leadQuery.isLoading) return <LoadingState />;
  if (leadQuery.isError) return <ErrorState message={(leadQuery.error as Error).message} />;
  const lead = leadQuery.data;
  if (!lead) return null;

  const isFinal = lead.stage === "WON" || lead.stage === "LOST";
  const isConverted = Boolean(lead.convertedChildId);
  const activities = lead.activities ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={crmHref} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← {t("pageTitle")}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{lead.childFullName}</h1>
          <Badge tone={STAGE_TONE[lead.stage]}>{stageLabel(t, lead.stage)}</Badge>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {lead.parentName} • {lead.parentPhone}
          {lead.ageGroup ? ` • ${ageGroupLabel(t, lead.ageGroup)}` : ""} • {sourceLabel(t, lead.source)}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t("createdLabel")}: {formatDate(lead.createdAt)} • {t("table.owner")}: {lead.assignedTo?.fullName ?? "—"}
        </p>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {lead.lostReason && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {t("lostReasonLabel")}: {lead.lostReason}
        </div>
      )}

      {isConverted && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-success)]">{t("convertedNotice")}</p>
          <Link href={`/${slug}/children/${lead.convertedChildId}`}>
            <Button size="sm" variant="outline">
              {t("viewChildProfile")} →
            </Button>
          </Link>
        </div>
      )}

      {canWrite && !isConverted && (
        <Card>
          <CardHeader>
            <CardTitle>{t("actionsTitle")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStageModalOpen(true)}>
              {t("changeStageTitle")}
            </Button>
            <Button variant="outline" onClick={() => setAssignModalOpen(true)}>
              {t("assignTitle")}
            </Button>
            {!isFinal && (
              <Button onClick={() => setConvertModalOpen(true)}>{t("convertTitle")}</Button>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>{t("detailsTitle")}</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setDetailsModalOpen(true)}>
              {t("editAction")}
            </Button>
          )}
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("followUpDateLabel")}</p>
            <p
              className={`mt-1 text-[14px] font-medium ${
                lead.followUpDate && !isFinal && new Date(lead.followUpDate) < new Date()
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-text)]"
              }`}
            >
              {lead.followUpDate ? formatDate(lead.followUpDate) : t("notSet")}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("trialDateLabel")}</p>
            <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">
              {lead.trialDate ? formatDate(lead.trialDate) : t("notSet")}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("contractDateLabel")}</p>
            <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">
              {lead.contractDate ? formatDate(lead.contractDate) : t("notSet")}
            </p>
          </div>
          {lead.contractNote && (
            <div className="col-span-2 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3 sm:col-span-3">
              <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("contractNoteLabel")}</p>
              <p className="mt-1 text-[14px] text-[var(--color-text)]">{lead.contractNote}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("activityHistoryTitle")}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("noActivityYet")}</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-lg border border-[var(--color-border)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--color-text)]">{activityLabel(t, activity.type)}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(activity.createdAt)}</span>
                  </div>
                  {activity.note && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{activity.note}</p>}
                  {activity.createdBy && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{activity.createdBy.fullName}</p>
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
