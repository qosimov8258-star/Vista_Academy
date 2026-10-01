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
import { AgentTokenModal } from "@/features/face-id/agent-token-modal";
import { DeviceCommandsModal } from "@/features/face-id/device-commands-modal";
import { AgentPairingCard } from "@/features/face-id/agent-pairing-card";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE: Record<FaceIdDevice["status"], { label: string; tone: "success" | "neutral" | "warning" }> = {
  ACTIVE: { label: "Faol", tone: "success" },
  INACTIVE: { label: "Nofaol", tone: "neutral" },
  MAINTENANCE: { label: "Texnik xizmatda", tone: "warning" },
};

/** Agent shu vaqt ichida murojaat qilgan bo'lsa — onlayn (u har 5 soniyada so'raydi) */
const ONLINE_WINDOW_MS = 2 * 60_000;

function AgentStatus({ device }: { device: FaceIdDevice }) {
  if (!device.lastSeenAt) {
    return <span className="text-[13px] text-[var(--color-text-muted)]">Hali ulanmagan</span>;
  }
  const online = Date.now() - new Date(device.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]" title={`Oxirgi aloqa: ${formatDateTime(device.lastSeenAt)}`}>
      <span className={`h-2 w-2 rounded-full ${online ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]/50"}`} aria-hidden="true" />
      {online ? "Onlayn" : formatDateTime(device.lastSeenAt)}
    </span>
  );
}

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
  // Agent tokeni faqat bir marta ko'rsatiladi — yaratilganda yoki yangilanganda
  const [shownToken, setShownToken] = useState<{ token: string; deviceName: string } | null>(null);
  const [rotating, setRotating] = useState<FaceIdDevice | null>(null);
  const [commandsFor, setCommandsFor] = useState<FaceIdDevice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const devicesQuery = useQuery({
    queryKey: ["face-id-devices", slug, forcedBranchId],
    queryFn: () => api.get<FaceIdDevice[]>(`/app/face-id/devices${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
    // "Onlayn" belgisi va navbat soni yangilanib tursin
    refetchInterval: 15_000,
  });

  const rotateMutation = useMutation({
    mutationFn: (device: FaceIdDevice) => api.post<{ agentToken: string }>(`/app/face-id/devices/${device.id}/token`, {}),
    onSuccess: (result, device) => {
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      setRotating(null);
      setShownToken({ token: result.agentToken, deviceName: device.name });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (device: FaceIdDevice) => api.post<{ employees: number; children: number }>(`/app/face-id/devices/${device.id}/sync`, {}),
    onSuccess: (result, device) => {
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] });
      setNotice(`"${device.name}": ${result.employees} ta xodim va ${result.children} ta bola qurilmaga yuborish navbatiga qo'yildi`);
    },
    onError: (err) => setNotice(err instanceof ApiError ? err.message : "Sinxronlab bo'lmadi"),
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

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--color-success-bg)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-success)]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 cursor-pointer font-semibold">
            Yopish
          </button>
        </div>
      )}

      <AgentPairingCard branchId={forcedBranchId ?? null} canWrite={canWrite} />

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
                <Th>Agent</Th>
                <Th numeric>Navbatda</Th>
                <Th>Holati</Th>
                {canWrite && <Th>&nbsp;</Th>}
              </tr>
            </THead>
            <TBody>
              {devices.map((device) => (
                <Tr key={device.id}>
                  <Td className="font-medium">
                    {device.name}
                    {device.location && <p className="text-[12.5px] font-normal text-[var(--color-text-muted)]">{device.location}</p>}
                  </Td>
                  <Td>{device.model}</Td>
                  <Td nowrap className="tabular-nums">
                    {device.ipAddress ? `${device.ipAddress}:${device.port}` : "—"}
                    {device.ipAddress && !device.hasPassword && (
                      <p className="text-[12.5px] text-[var(--color-warning)]">Parol kiritilmagan</p>
                    )}
                  </Td>
                  <Td nowrap>
                    <AgentStatus device={device} />
                  </Td>
                  <Td numeric>
                    <button
                      type="button"
                      onClick={() => setCommandsFor(device)}
                      className="cursor-pointer tabular-nums text-[var(--color-primary)] hover:underline"
                      title="Buyruqlarni ko'rish"
                    >
                      {device.queuedCommands}
                    </button>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[device.status].tone}>{STATUS_TONE[device.status].label}</Badge>
                  </Td>
                  {canWrite && (
                    <Td nowrap>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={device.status !== "ACTIVE"}
                          loading={syncMutation.isPending && syncMutation.variables?.id === device.id}
                          onClick={() => syncMutation.mutate(device)}
                          title="Filialdagi barcha faol xodim va bolalarni qurilmaga qayta yuborish"
                        >
                          Sinxronlash
                        </Button>
                        <Button size="sm" variant="tertiary" onClick={() => setRotating(device)} title="Agent uchun yangi token">
                          Yangi token
                        </Button>
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
          onCreated={(device, token) => setShownToken({ token, deviceName: device.name })}
        />
      )}

      <AgentTokenModal token={shownToken?.token ?? null} deviceName={shownToken?.deviceName ?? ""} onClose={() => setShownToken(null)} />
      <DeviceCommandsModal slug={slug} device={commandsFor} onClose={() => setCommandsFor(null)} />

      <ConfirmDialog
        open={!!rotating}
        onClose={() => setRotating(null)}
        title="Yangi agent tokeni"
        description={
          <>
            <strong>{rotating?.name}</strong> uchun yangi token yaratilsa, eskisi darhol ishlamay qoladi — obyektdagi agentning{" "}
            <code>.env</code> faylini yangi token bilan almashtirish kerak bo&apos;ladi.
          </>
        }
        confirmLabel="Yangi token yaratish"
        loading={rotateMutation.isPending}
        error={rotateMutation.error instanceof ApiError ? rotateMutation.error.message : null}
        onConfirm={() => rotating && rotateMutation.mutate(rotating)}
      />

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
