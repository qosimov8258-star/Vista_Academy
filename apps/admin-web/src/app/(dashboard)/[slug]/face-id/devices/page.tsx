"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { FaceIdDevice } from "@/lib/types";
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
import { PencilIcon, TrashIcon, FaceIdIcon } from "@/components/ui/icons";
import { FaceIdTabs } from "@/features/face-id/face-id-tabs";
import { DeviceFormModal } from "@/features/face-id/device-form-modal";

const STATUS_TONE: Record<FaceIdDevice["status"], { label: string; tone: "success" | "neutral" | "warning" }> = {
  ACTIVE: { label: "Faol", tone: "success" },
  INACTIVE: { label: "Nofaol", tone: "neutral" },
  MAINTENANCE: { label: "Texnik xizmatda", tone: "warning" },
};

export default function FaceIdDevicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug, branchId: forcedBranchId } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const queryClient = useQueryClient();

  const [formModal, setFormModal] = useState<{ open: boolean; device: FaceIdDevice | null }>({
    open: false,
    device: null,
  });
  const [deleting, setDeleting] = useState<FaceIdDevice | null>(null);

  const devicesQuery = useQuery({
    queryKey: ["face-id-devices", slug, forcedBranchId],
    queryFn: () => api.get<FaceIdDevice[]>(`/app/face-id/devices${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/face-id/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] });
      setDeleting(null);
    },
  });

  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Face ID</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Kirish-chiqishni nazorat qiluvchi yuz tanish qurilmalari (masalan Hikvision Turniket Terminal Kontrol DS-K1T342MX)
          </p>
        </div>
        {canWrite && (
          <Button variant="outline" onClick={() => setFormModal({ open: true, device: null })}>
            + Yangi qurilma
          </Button>
        )}
      </div>

      <FaceIdTabs base={base} />

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {devicesQuery.isLoading ? (
        <LoadingState />
      ) : devicesQuery.isError ? (
        <ErrorState message={devicesQuery.error instanceof ApiError ? devicesQuery.error.message : "Xatolik yuz berdi"} />
      ) : devices.length === 0 ? (
        <EmptyState
          icon={<FaceIdIcon className="h-[26px] w-[26px]" />}
          title="Hali qurilma yo'q"
          description={canWrite ? "Yuqoridagi \"+ Yangi qurilma\" tugmasi orqali birinchi terminalni qo'shing" : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>Nomi</Th>
                <Th>Rusumi</Th>
                <Th>IP manzili</Th>
                <Th>Joylashuvi</Th>
                <Th>Holati</Th>
                {canWrite && <Th>&nbsp;</Th>}
              </tr>
            </THead>
            <TBody>
              {devices.map((device) => (
                <Tr key={device.id}>
                  <Td className="font-medium">{device.name}</Td>
                  <Td>{device.model}</Td>
                  <Td>{device.ipAddress ?? "—"}</Td>
                  <Td>{device.location ?? "—"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[device.status].tone}>{STATUS_TONE[device.status].label}</Badge>
                  </Td>
                  {canWrite && (
                    <Td nowrap>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setFormModal({ open: true, device })}
                          aria-label="Tahrirlash"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(device)}
                          aria-label="O'chirish"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </Card>
      )}

      {canWrite && (
        <DeviceFormModal
          open={formModal.open}
          onClose={() => setFormModal({ open: false, device: null })}
          slug={slug}
          device={formModal.device}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Qurilmani o'chirish"
        description={
          <>
            <strong>{deleting?.name}</strong> qurilmasini o&apos;chirmoqchimisiz? Unga bog&apos;langan barcha yuz
            yozuvlari ham o&apos;chib ketadi.
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
