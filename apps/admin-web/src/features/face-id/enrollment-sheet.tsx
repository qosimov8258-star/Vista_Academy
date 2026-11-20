"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { FaceEnrollment, FaceEnrollmentStatus } from "@/lib/types";
import { Pill } from "@/components/ios/pill";
import { CheckRow } from "@/components/ios/check-row";
import { IosSheet, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { IOS } from "@/components/ios/tokens";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/format";
import { ENROLLMENT_STATUS, TintNote } from "./shared";
import { useTr } from "@/i18n/tr";

const STATUSES: FaceEnrollmentStatus[] = ["PENDING", "REGISTERED", "FAILED", "REMOVED"];

/**
 * Yuz yozuvi varag'i: kim, qaysi qurilma, holati. Holat tanlansa darhol
 * saqlanadi (avvalgi jadvaldagi tanlagich kabi); o'chirish ikkinchi bosqichda.
 */
export function EnrollmentSheet({
  slug,
  enrollment,
  canWrite,
  onClose,
}: {
  slug: string;
  enrollment: FaceEnrollment | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FaceEnrollmentStatus }) =>
      api.patch<FaceEnrollment>(`/app/face-id/enrollments/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/face-id/enrollments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] });
      onClose();
    },
  });

  const enrollmentId = enrollment?.id;
  useEffect(() => {
    if (!enrollmentId) return;
    setConfirmDelete(false);
    statusMutation.reset();
    deleteMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat boshqa yozuv ochilganda
  }, [enrollmentId]);

  if (!enrollment) return <IosSheet open={false} onClose={onClose} title="">{null}</IosSheet>;

  const person = enrollment.employee ?? enrollment.child;
  const name = person?.fullName ?? "—";
  const status = ENROLLMENT_STATUS[enrollment.status];
  // Saqlanayotgan holat darhol ✓ bilan ko'rinadi
  const shownStatus = statusMutation.isPending && statusMutation.variables ? statusMutation.variables.status : enrollment.status;
  const close = () => !deleteMutation.isPending && onClose();

  if (confirmDelete) {
    return (
      <IosSheet
        open
        onClose={close}
        title={tr("Yozuvni o'chirish")}
        footer={
          <div className="flex gap-3">
            <div className="flex-1">
              <SheetSecondaryButton onClick={() => setConfirmDelete(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
            </div>
            <div className="flex-1">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(enrollment.id)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
              >
                {deleteMutation.isPending ? <Spinner className="h-5 w-5 text-white" /> : tr("O'chirish")}
              </button>
            </div>
          </div>
        }
      >
        <TintNote color={IOS.red}>
          <p className="font-semibold">{name}</p>
          <p className="mt-1">{tr("uchun yuz yozuvini o'chirmoqchimisiz?")}</p>
          <p className="mt-1 opacity-80">
            {tr("Qurilma")}: {tr(enrollment.device.name)}
          </p>
        </TintNote>
        {deleteMutation.error instanceof ApiError && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(deleteMutation.error.message)}</p>}
      </IosSheet>
    );
  }

  return (
    <IosSheet
      open
      onClose={close}
      title={tr("Yuz yozuvi")}
      cancelLabel="Yopish"
      footer={
        canWrite ? (
          <SheetSecondaryButton danger onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
            {tr("Yozuvni o'chirish")}
          </SheetSecondaryButton>
        ) : null
      }
    >
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        {enrollment.personType === "EMPLOYEE" && enrollment.employee ? (
          <EmployeePhoto employee={enrollment.employee} size={72} fallback={initials(name)} />
        ) : enrollment.child ? (
          <ChildPhoto child={enrollment.child} size={72} fallback={initials(name)} />
        ) : null}
        <p className="max-w-full truncate text-[20px] font-bold text-[var(--color-text)]">{name}</p>
        <Pill color={status.color}>{tr(status.label)}</Pill>
      </div>

      <SheetSection>
        <SheetRow label={tr("Turi")}>{enrollment.personType === "EMPLOYEE" ? tr("Xodim") : tr("Bola")}</SheetRow>
        <SheetRow label={tr("Qurilma")}>{tr(enrollment.device.name)}</SheetRow>
        <SheetRow label={tr("Qo'shilgan")}>{formatDateTime(enrollment.createdAt)}</SheetRow>
        {enrollment.registeredAt && <SheetRow label={tr("Ro'yxatga olindi")}>{formatDateTime(enrollment.registeredAt)}</SheetRow>}
      </SheetSection>

      {canWrite ? (
        <section>
          <h3 className="flex items-center gap-2 px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">
            {tr("Holati")}
            {statusMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
          </h3>
          <div role="radiogroup" aria-label={tr("Holati")} className="overflow-hidden rounded-[18px] bg-white">
            {STATUSES.map((value) => (
              <CheckRow
                key={value}
                label={tr(ENROLLMENT_STATUS[value].label)}
                checked={shownStatus === value}
                onClick={() => value !== enrollment.status && !statusMutation.isPending && statusMutation.mutate({ id: enrollment.id, status: value })}
                leading={<span aria-hidden="true" className="mx-[11px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ENROLLMENT_STATUS[value].color }} />}
              />
            ))}
          </div>
          {statusMutation.error instanceof ApiError && <p className="px-4 pt-2 text-[13px] text-[#ff3b30]">{tr(statusMutation.error.message)}</p>}
        </section>
      ) : null}

      {enrollment.notes && (
        <SheetSection title={tr("Izoh")}>
          <p className="whitespace-pre-line px-4 py-3 text-[15px] text-[var(--color-text)]">{enrollment.notes}</p>
        </SheetSection>
      )}
    </IosSheet>
  );
}
