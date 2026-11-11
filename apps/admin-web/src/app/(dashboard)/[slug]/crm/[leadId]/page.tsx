"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Baby, CalendarClock, ChevronLeft, Plus, UserRoundCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { Lead, LeadActivity } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { useBranchContext } from "@/lib/use-branch-context";
import { isCallOperatorUser } from "@/lib/employee-position";
import { canWriteOperational } from "@/lib/permissions";
import { IosButton } from "@/components/ios/button";
import { Group, Row } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { ViewOnlyNote } from "@/components/ios/view-only-note";
import { IOS } from "@/components/ios/tokens";
import { PhoneIcon } from "@/components/ios/icons";
import { IosIcon } from "@/features/director/ios-icon";
import { ACTIVITY_LABEL, AGE_GROUP_LABEL, SOURCE_LABEL, STAGE_COLOR, STAGE_LABEL } from "@/features/crm/labels";
import { ChangeStageModal } from "@/features/crm/change-stage-modal";
import { ConvertLeadModal } from "@/features/crm/convert-lead-modal";
import { AssignLeadModal } from "@/features/crm/assign-lead-modal";
import { EditLeadDetailsModal } from "@/features/crm/edit-lead-details-modal";
import { LeadActivitySheet } from "@/features/crm/lead-activity-form";
import { useTr } from "@/i18n/tr";

type LeadActivityWithCreator = LeadActivity & { createdBy?: { id: string; fullName: string } | null };
type LeadDetail = Lead & {
  activities?: LeadActivityWithCreator[];
  assignedTo?: { id: string; fullName: string } | null;
};

/**
 * Ariza — iOS grouped uslubida. Funksiyalar (avvalgilarning hammasi):
 * ma'lumot va mas'ul, yo'qotish sababi, bolaga aylantirilganini ko'rsatish
 * (bola profiliga havola), amallar (bosqich, mas'ul, bolaga aylantirish),
 * tafsilotlar va ularni tahrirlash, faoliyat tarixi va faoliyat qo'shish.
 */
export default function LeadDetailPage({ params }: { params: Promise<{ slug: string; leadId: string }> }) {
  const tr = useTr();
  const { slug, leadId } = use(params);
  const [sheet, setSheet] = useState<"stage" | "convert" | "assign" | "details" | "activity" | null>(null);
  const { user } = useAuth();
  const callOperator = isCallOperatorUser(user);
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug, base } = useBranchContext(slug);
  const crmHref = branchSlug ? `/${slug}/${branchSlug}/crm` : `/${slug}/crm`;

  const leadQuery = useQuery({
    queryKey: ["lead", slug, leadId],
    queryFn: () => api.get<LeadDetail>(`/app/leads/${leadId}`),
  });

  const back = (
    <Link href={crmHref} className="inline-flex h-11 items-center gap-0.5 pr-2 text-[17px] text-[var(--color-primary)] transition-opacity active:opacity-50">
      <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
      {tr("Arizalar")}
    </Link>
  );

  if (leadQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3">
        {back}
        <SkeletonRows rows={6} />
      </div>
    );
  }
  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3">
        {back}
        <ErrorState message={tr((leadQuery.error as Error | null)?.message ?? "Ariza topilmadi")} onRetry={() => leadQuery.refetch()} retrying={leadQuery.isFetching} />
      </div>
    );
  }
  const lead = leadQuery.data;
  const isFinal = lead.stage === "WON" || lead.stage === "LOST";
  const isConverted = Boolean(lead.convertedChildId);
  const activities = lead.activities ?? [];
  const followUpOverdue = Boolean(lead.followUpDate && !isFinal && new Date(lead.followUpDate) < new Date());
  const notSet = <span className="text-[#c7c7cc]">{tr("Belgilanmagan")}</span>;

  return (
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <div className="-mb-2">{back}</div>

        <PageHeaderCard
          icon={PhoneIcon}
          tint="green"
          title={tr(lead.childFullName || lead.parentName)}
          subtitle={
            <>
              <Pill color={STAGE_COLOR[lead.stage]}>{tr(STAGE_LABEL[lead.stage])}</Pill>
              <span className="truncate">{tr(SOURCE_LABEL[lead.source])}</span>
            </>
          }
        />

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        {lead.lostReason && (
          <p className="rounded-[18px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] leading-snug text-[#ff3b30]">
            <span className="font-semibold">{tr("Yo'qotish sababi:")}</span> {tr(lead.lostReason)}
          </p>
        )}

        {isConverted && (
          <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-[#34c759]/[0.12] px-4 py-3">
            <p className="min-w-0 flex-1 text-[14px] font-semibold text-[#248a3d]">{tr("Bu ariza bola profiliga aylantirilgan")}</p>
            {!callOperator && <IosButton label={tr("Bola profilini ko'rish")} icon={Baby} href={`${base}/children/${lead.convertedChildId}`} />}
          </div>
        )}

        <Group title={tr("Ma'lumot")}>
          <Row title={tr("Ota-ona")} value={<span className="text-[var(--color-text)]">{tr(lead.parentName)}</span>} />
          <Row
            title={tr("Telefon")}
            value={
              <a href={`tel:${lead.parentPhone}`} className="tabular-nums text-[var(--color-primary)]">
                {lead.parentPhone}
              </a>
            }
          />
          {lead.childFullName && <Row title={tr("Bola")} value={tr(lead.childFullName)} />}
          <Row title={tr("Yosh guruhi")} value={lead.ageGroup ? tr(AGE_GROUP_LABEL[lead.ageGroup]) : "—"} />
          <Row title={tr("Manba")} value={tr(SOURCE_LABEL[lead.source])} />
          <Row title={tr("Yaratildi")} value={formatDate(lead.createdAt)} />
          <Row title={tr("Mas'ul")} value={lead.assignedTo?.fullName ? tr(lead.assignedTo.fullName) : "—"} />
        </Group>

        {canWrite && !isConverted && (
          <Group title={tr("Amallar")}>
            <Row
              leading={<IosIcon icon={ArrowRightLeft} tint="indigo" size={30} />}
              title={tr("Bosqichni o'zgartirish")}
              value={tr(STAGE_LABEL[lead.stage])}
              onClick={() => setSheet("stage")}
            />
            <Row
              leading={<IosIcon icon={UserRoundCheck} tint="blue" size={30} />}
              title={tr("Mas'ulni belgilash")}
              value={lead.assignedTo?.fullName ? tr(lead.assignedTo.fullName) : undefined}
              onClick={() => setSheet("assign")}
            />
            {/* Bola yaratish call operatorning ishi emas — uni administrator qiladi */}
            {!isFinal && !callOperator && (
              <Row leading={<IosIcon icon={Baby} tint="green" size={30} />} title={tr("Bolaga aylantirish")} onClick={() => setSheet("convert")} />
            )}
          </Group>
        )}

        <Group
          title={tr("Tafsilotlar")}
          action={
            canWrite ? (
              <button type="button" onClick={() => setSheet("details")} className="text-[var(--color-primary)] transition-opacity active:opacity-50">
                {tr("Tahrirlash")}
              </button>
            ) : undefined
          }
        >
          <Row
            leading={<IosIcon icon={CalendarClock} tint={followUpOverdue ? "red" : "orange"} size={30} />}
            title={tr("Keyingi bog'lanish")}
            value={lead.followUpDate ? <span style={{ color: followUpOverdue ? IOS.red : undefined }}>{formatDate(lead.followUpDate)}</span> : notSet}
          />
          <Row title={tr("Sinov kuni")} value={lead.trialDate ? formatDate(lead.trialDate) : notSet} />
          <Row title={tr("Shartnoma sanasi")} value={lead.contractDate ? formatDate(lead.contractDate) : notSet} />
          {lead.contractNote && (
            <div className="group/row relative px-4 py-3">
              <p className="text-[12.5px] text-[#8e8e93]">{tr("Shartnoma izohi")}</p>
              <p className="mt-0.5 whitespace-pre-line text-[15px] leading-snug text-[var(--color-text)]">{tr(lead.contractNote)}</p>
              <span className="pointer-events-none absolute left-4 right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />
            </div>
          )}
        </Group>

        <Group title={tr("Faoliyat tarixi")}>
          {activities.length === 0 && <Row title={<span className="text-[#8e8e93]">{tr("Hali faoliyat yo'q")}</span>} />}
          {activities.map((activity) => (
            <div key={activity.id} className="group/row relative px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium text-[var(--color-text)]">{tr(ACTIVITY_LABEL[activity.type])}</span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-[#8e8e93]">{formatDateTime(activity.createdAt)}</span>
              </div>
              {activity.note && <p className="mt-0.5 whitespace-pre-line text-[14px] leading-snug text-[var(--color-text)]">{tr(activity.note)}</p>}
              {activity.createdBy && <p className="mt-0.5 text-[12.5px] text-[#8e8e93]">{tr(activity.createdBy.fullName)}</p>}
              <span className="pointer-events-none absolute left-4 right-0 top-0 h-px bg-black/[0.08] group-first/row:hidden" aria-hidden="true" />
            </div>
          ))}
          {canWrite && (
            <Row
              leading={<IosIcon icon={Plus} tint="accent" size={30} />}
              title={<span className="text-[var(--color-primary)]">{tr("Faoliyat qo'shish")}</span>}
              onClick={() => setSheet("activity")}
              chevron={false}
            />
          )}
        </Group>
      </div>

      {canWrite && (
        <>
          <ChangeStageModal open={sheet === "stage"} onClose={() => setSheet(null)} slug={slug} leadId={leadId} currentStage={lead.stage} />
          <ConvertLeadModal open={sheet === "convert"} onClose={() => setSheet(null)} slug={slug} leadId={leadId} />
          <AssignLeadModal open={sheet === "assign"} onClose={() => setSheet(null)} slug={slug} leadId={leadId} currentAssignedToUserId={lead.assignedTo?.id} />
          <EditLeadDetailsModal open={sheet === "details"} onClose={() => setSheet(null)} slug={slug} leadId={leadId} lead={lead} />
          <LeadActivitySheet open={sheet === "activity"} onClose={() => setSheet(null)} slug={slug} leadId={leadId} />
        </>
      )}
    </div>
  );
}
