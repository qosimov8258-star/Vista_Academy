"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { FaceEnrollment, FaceEnrollmentStatus, FaceIdDevice, FacePersonType } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectMenu } from "@/components/ui/select-menu";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { TrashIcon, FaceIdIcon } from "@/components/ui/icons";
import { FaceIdTabs } from "@/features/face-id/face-id-tabs";
import { CreateEnrollmentModal } from "@/features/face-id/create-enrollment-modal";

const ALL_TAB = "__all__";

const STATUS_TONE: Record<FaceEnrollmentStatus, { label: string; tone: "success" | "neutral" | "warning" | "danger" }> = {
  PENDING: { label: "Kutilmoqda", tone: "warning" },
  REGISTERED: { label: "Ro'yxatga olindi", tone: "success" },
  FAILED: { label: "Muvaffaqiyatsiz", tone: "danger" },
  REMOVED: { label: "Olib tashlangan", tone: "neutral" },
};

const STATUS_OPTIONS = (Object.keys(STATUS_TONE) as FaceEnrollmentStatus[]).map((value) => ({
  value,
  label: STATUS_TONE[value].label,
}));

export default function FaceIdRegistrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug, branchId: forcedBranchId } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<typeof ALL_TAB | FacePersonType>(ALL_TAB);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<FaceEnrollment | null>(null);

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

  const visibleEnrollments = useMemo(() => {
    if (activeTab === ALL_TAB) return enrollments;
    return enrollments.filter((e) => e.personType === activeTab);
  }, [enrollments, activeTab]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FaceEnrollmentStatus }) =>
      api.patch<FaceEnrollment>(`/app/face-id/enrollments/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/face-id/enrollments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] });
      setDeleting(null);
    },
  });

  const isLoading = devicesQuery.isLoading || enrollmentsQuery.isLoading;
  const isError = devicesQuery.isError || enrollmentsQuery.isError;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Face ID</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Xodim va bolalarning qaysi qurilmada yuzi ro&apos;yxatga olinganini kuzatish
          </p>
        </div>
        {canWrite && (
          <Button
            variant="outline"
            disabled={devices.length === 0}
            title={devices.length === 0 ? "Avval qurilma qo'shing" : undefined}
            onClick={() => setCreateOpen(true)}
          >
            + Yuz qo&apos;shish
          </Button>
        )}
      </div>

      <FaceIdTabs base={base} />

      {!canWrite && <ViewOnlyNote role={user?.role} />}
      {canWrite && devices.length === 0 && !devicesQuery.isLoading && (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-primary)]/[0.06] px-4 py-3.5 text-[14px] text-[var(--color-text-muted)]">
          Avval &quot;Qurilmalar&quot; bo&apos;limida terminalni qo&apos;shing, keyin shu yerda yuz ro&apos;yxatini yuritishingiz mumkin.
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState
          message={
            devicesQuery.error instanceof ApiError
              ? devicesQuery.error.message
              : enrollmentsQuery.error instanceof ApiError
                ? enrollmentsQuery.error.message
                : "Xatolik yuz berdi"
          }
        />
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={<FaceIdIcon className="h-[26px] w-[26px]" />}
          title="Hali yuz ro'yxatga olinmagan"
          description={canWrite && devices.length > 0 ? "Yuqoridagi \"+ Yuz qo'shish\" tugmasi orqali birinchi yozuvni qo'shing" : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto px-3 border-b border-[var(--color-separator)]">
            {(
              [
                [ALL_TAB, "Barchasi"],
                ["EMPLOYEE", "Xodimlar"],
                ["CHILD", "Bolalar"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                  activeTab === value
                    ? "border-[var(--color-primary)] text-[var(--color-text)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {label}
                <Badge tone={activeTab === value ? "primary" : "neutral"}>
                  {value === ALL_TAB ? enrollments.length : enrollments.filter((e) => e.personType === value).length}
                </Badge>
              </button>
            ))}
          </div>

          <DataTable>
            <THead>
              <tr>
                <Th>Kim</Th>
                <Th>Turi</Th>
                <Th>Qurilma</Th>
                <Th>Holati</Th>
                {canWrite && <Th>&nbsp;</Th>}
              </tr>
            </THead>
            <TBody>
              {visibleEnrollments.map((enrollment) => {
                const person = enrollment.employee ?? enrollment.child;
                return (
                  <Tr key={enrollment.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        {person ? (
                          enrollment.personType === "EMPLOYEE" ? (
                            <EmployeePhoto employee={enrollment.employee!} size={32} fallback={initials(person.fullName)} />
                          ) : (
                            <ChildPhoto child={enrollment.child!} size={32} fallback={initials(person.fullName)} />
                          )
                        ) : null}
                        <span className="font-medium">{person?.fullName ?? "—"}</span>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{enrollment.personType === "EMPLOYEE" ? "Xodim" : "Bola"}</Badge>
                    </Td>
                    <Td>{enrollment.device.name}</Td>
                    <Td>
                      {canWrite ? (
                        <div className="w-44">
                          <SelectMenu
                            options={STATUS_OPTIONS}
                            value={enrollment.status}
                            onChange={(value) =>
                              statusMutation.mutate({ id: enrollment.id, status: value as FaceEnrollmentStatus })
                            }
                          />
                        </div>
                      ) : (
                        <Badge tone={STATUS_TONE[enrollment.status].tone}>{STATUS_TONE[enrollment.status].label}</Badge>
                      )}
                    </Td>
                    {canWrite && (
                      <Td nowrap>
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setDeleting(enrollment)}
                            aria-label="O'chirish"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </TBody>
          </DataTable>
        </Card>
      )}

      {canWrite && (
        <CreateEnrollmentModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          slug={slug}
          forcedBranchId={forcedBranchId}
          devices={devices}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Yozuvni o'chirish"
        description={
          <>
            <strong>{(deleting?.employee ?? deleting?.child)?.fullName}</strong> uchun yuz yozuvini o&apos;chirmoqchimisiz?
          </>
        }
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.error instanceof ApiError ? deleteMutation.error.message : null}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
