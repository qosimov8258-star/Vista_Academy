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
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
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
          ← Arizalar
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{lead.childFullName}</h1>
          <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {lead.parentName} • {lead.parentPhone}
          {lead.ageGroup ? ` • ${AGE_GROUP_LABEL[lead.ageGroup]}` : ""} • {SOURCE_LABEL[lead.source]}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">Yaratildi: {formatDate(lead.createdAt)}</p>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {lead.lostReason && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
          Yo&apos;qotish sababi: {lead.lostReason}
        </div>
      )}

      {isConverted && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-success)]">Bu ariza bola profiliga aylantirilgan</p>
          <Link href={`/${slug}/children/${lead.convertedChildId}`}>
            <Button size="sm" variant="outline">
              Bola profilini ko&apos;rish →
            </Button>
          </Link>
        </div>
      )}

      {canWrite && !isConverted && (
        <Card>
          <CardHeader>
            <CardTitle>Amallar</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStageModalOpen(true)}>
              Bosqichni o&apos;zgartirish
            </Button>
            {!isFinal && (
              <Button onClick={() => setConvertModalOpen(true)}>Bolaga aylantirish</Button>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Faoliyat tarixi</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Hali faoliyat yo&apos;q</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-lg border border-[var(--color-border)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--color-text)]">{ACTIVITY_LABEL[activity.type]}</span>
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
    </div>
  );
}
