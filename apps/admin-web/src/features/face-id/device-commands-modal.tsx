"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { FaceIdCommand, FaceIdCommandStatus, FaceIdCommandType, FaceIdDevice } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";

const TYPE_LABEL: Record<FaceIdCommandType, string> = {
  ADD_OR_UPDATE_USER: "Qo'shish",
  SET_FACE: "Yuzni yuklash",
  DELETE_USER: "O'chirish",
};

const STATUS: Record<FaceIdCommandStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  PENDING: { label: "Navbatda", tone: "neutral" },
  SENT: { label: "Agentda", tone: "warning" },
  DONE: { label: "Bajarildi", tone: "success" },
  FAILED: { label: "Xato", tone: "danger" },
};

/** Qurilmaning so'nggi buyruqlari — nima yetib bordi, nima xato berdi. */
export function DeviceCommandsModal({ slug, device, onClose }: { slug: string; device: FaceIdDevice | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["face-id-commands", slug, device?.id],
    queryFn: () => api.get<FaceIdCommand[]>(`/app/face-id/devices/${device!.id}/commands`),
    enabled: !!device,
    refetchInterval: 5_000,
  });

  return (
    <Modal open={!!device} onClose={onClose} title={`Buyruqlar — ${device?.name ?? ""}`} widthClassName="max-w-2xl">
      {query.isLoading ? (
        <LoadingState rows={4} />
      ) : query.isError ? (
        <ErrorState message={query.error instanceof ApiError ? query.error.message : "Xatolik yuz berdi"} />
      ) : !query.data?.length ? (
        <EmptyState title="Hali buyruq yo'q" description="Xodim qo'shilganda yoki «Sinxronlash» bosilganda shu yerda paydo bo'ladi" />
      ) : (
        <ul className="divide-y divide-[var(--color-separator)]">
          {query.data.map((c) => (
            <li key={c.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[var(--color-text)]">
                  {TYPE_LABEL[c.type]} · <span className="font-medium">{c.employee?.fullName ?? c.child?.fullName ?? `№ ${c.employeeNo}`}</span>
                  <span className="text-[var(--color-text-muted)]"> ({c.employeeNo})</span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                  {formatDateTime(c.createdAt)} · urinish {c.attempts}
                </p>
                {c.lastError && c.status !== "DONE" && <p className="mt-1 break-words text-[12.5px] text-[var(--color-danger)]">{c.lastError}</p>}
              </div>
              <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
