"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScanFace } from "lucide-react";
import { BranchSectionTabs } from "@/features/nav/branch-section-tabs";
import { api, ApiError } from "@/lib/api";
import type { FaceEnrollment, FaceIdDevice, FacePersonType } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosButton } from "@/components/ios/button";
import { Group, ListRow } from "@/components/ios/group";
import { Segmented } from "@/components/ios/form";
import { Pill } from "@/components/ios/pill";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { PlusIcon } from "@/components/ios/icons";
import { IOS } from "@/components/ios/tokens";
import { ViewOnlyNote } from "@/components/ios/view-only-note";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { CreateEnrollmentModal } from "@/features/face-id/create-enrollment-modal";
import { EnrollmentSheet } from "@/features/face-id/enrollment-sheet";
import { ENROLLMENT_STATUS, TintNote, tintText } from "@/features/face-id/shared";
import { useTr } from "@/i18n/tr";

type Tab = "ALL" | FacePersonType;

export default function FaceIdRegistrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  // Ochiq varaq — id bo'yicha: holat o'zgarsa varaq ham yangilanadi
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const devicesQuery = useQuery({
    queryKey: ["face-id-devices", slug, forcedBranchId],
    queryFn: () => api.get<FaceIdDevice[]>(`/app/face-id/devices${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["face-id-enrollments", slug, forcedBranchId],
    queryFn: () => api.get<FaceEnrollment[]>(`/app/face-id/enrollments${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const devices = devicesQuery.data ?? [];
  const enrollments = enrollmentsQuery.data ?? [];
  const selected = enrollments.find((e) => e.id === selectedId) ?? null;

  const counts = useMemo(
    () => ({
      ALL: enrollments.length,
      EMPLOYEE: enrollments.filter((e) => e.personType === "EMPLOYEE").length,
      CHILD: enrollments.filter((e) => e.personType === "CHILD").length,
    }),
    [enrollments],
  );
  const visible = useMemo(() => (activeTab === "ALL" ? enrollments : enrollments.filter((e) => e.personType === activeTab)), [enrollments, activeTab]);

  const isLoading = devicesQuery.isLoading || enrollmentsQuery.isLoading;
  const error = devicesQuery.error ?? enrollmentsQuery.error;
  const noDevices = !devicesQuery.isLoading && devices.length === 0;

  const tabLabel = (label: string, count: number) => (
    <>
      {tr(label)} <span className="font-normal tabular-nums text-[#8e8e93]">{count}</span>
    </>
  );

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        <BranchSectionTabs slug={slug} section="faceId" current="registrations" />
        <PageHeaderCard
          icon={ScanFace}
          tint="purple"
          title={tr("Face ID")}
          count={enrollmentsQuery.data ? tr("{0} ta", enrollments.length) : undefined}
          subtitle={tr("Kimning yuzi qaysi qurilmada ro'yxatga olingan")}
          actions={
            canWrite && (
              <IosButton
                label={tr("Yuz qo'shish")}
                icon={PlusIcon}
                variant="primary"
                compact
                disabled={devices.length === 0}
                onClick={() => setCreateOpen(true)}
              />
            )
          }
        />

        {!canWrite && <ViewOnlyNote role={user?.role} />}
        {canWrite && noDevices && (
          <TintNote color={IOS.blue}>{tr("Avval \"Qurilmalar\" bo'limida terminalni qo'shing, keyin shu yerda yuz ro'yxatini yuritishingiz mumkin.")}</TintNote>
        )}

        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <ErrorState
            message={error instanceof ApiError ? error.message : undefined}
            onRetry={() => {
              devicesQuery.refetch();
              enrollmentsQuery.refetch();
            }}
            retrying={devicesQuery.isFetching || enrollmentsQuery.isFetching}
          />
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon={ScanFace}
            title="Hali yuz ro'yxatga olinmagan"
            hint={canWrite && devices.length > 0 ? "«Yuz qo'shish» tugmasi orqali birinchi yozuvni qo'shing" : undefined}
          />
        ) : (
          <>
            <Segmented<Tab>
              value={activeTab}
              onChange={setActiveTab}
              label={tr("Kim")}
              options={[
                { value: "ALL", label: tabLabel("Barchasi", counts.ALL) },
                { value: "EMPLOYEE", label: tabLabel("Xodimlar", counts.EMPLOYEE) },
                { value: "CHILD", label: tabLabel("Bolalar", counts.CHILD) },
              ]}
            />
            <Group bare={visible.length === 0} refreshing={enrollmentsQuery.isFetching}>
              {visible.length === 0 ? (
                <EmptyState icon={ScanFace} title="Bu bo'limda yozuv yo'q" />
              ) : (
                visible.map((enrollment) => {
                  const person = enrollment.employee ?? enrollment.child;
                  const name = person?.fullName ?? "—";
                  const status = ENROLLMENT_STATUS[enrollment.status];
                  return (
                    <ListRow
                      key={enrollment.id}
                      avatar={
                        enrollment.personType === "EMPLOYEE" && enrollment.employee ? (
                          <EmployeePhoto employee={enrollment.employee} size={44} fallback={initials(name)} />
                        ) : enrollment.child ? (
                          <ChildPhoto child={enrollment.child} size={44} fallback={initials(name)} />
                        ) : (
                          <span className="h-11 w-11 shrink-0 rounded-full bg-[#767680]/[0.12]" aria-hidden="true" />
                        )
                      }
                      title={name}
                      subtitle={
                        // Telefonda kapsula ismni siqib qo'ymasin — holat izoh qatorida rangli matn bo'ladi
                        <>
                          <span className="font-medium sm:hidden" style={{ color: tintText(status.color) }}>
                            {tr(status.label)} ·{" "}
                          </span>
                          <span className="max-sm:hidden">{enrollment.personType === "EMPLOYEE" ? tr("Xodim") : tr("Bola")} · </span>
                          {tr(enrollment.device.name)}
                        </>
                      }
                      meta={
                        <span className="max-sm:hidden">
                          <Pill color={status.color}>{tr(status.label)}</Pill>
                        </span>
                      }
                      onClick={() => setSelectedId(enrollment.id)}
                    />
                  );
                })
              )}
            </Group>
          </>
        )}
      </div>

      <EnrollmentSheet slug={slug} enrollment={selected} canWrite={canWrite} onClose={() => setSelectedId(null)} />

      {canWrite && (
        <CreateEnrollmentModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          slug={slug}
          forcedBranchId={forcedBranchId}
          devices={devices}
        />
      )}
    </div>
  );
}
