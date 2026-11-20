"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { FaceIdCommand, FaceIdDevice } from "@/lib/types";
import { IosSheet } from "@/components/ios/sheet";
import { Pill } from "@/components/ios/pill";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { ChecklistIcon } from "@/components/ios/icons";
import { GROUP_BLOCK, ROW_SEPARATOR } from "@/components/ios/tokens";
import { formatDateTime } from "@/lib/format";
import { COMMAND_STATUS, COMMAND_TYPE } from "./shared";
import { useTr } from "@/i18n/tr";

/** Qurilmaning so'nggi buyruqlari — nima yetib bordi, nima xato berdi (iOS varag'i). */
export function DeviceCommandsModal({ slug, device, onClose }: { slug: string; device: FaceIdDevice | null; onClose: () => void }) {
  const tr = useTr();
  const query = useQuery({
    queryKey: ["face-id-commands", slug, device?.id],
    queryFn: () => api.get<FaceIdCommand[]>(`/app/face-id/devices/${device!.id}/commands`),
    enabled: !!device,
    refetchInterval: 5_000,
  });

  return (
    <IosSheet open={!!device} onClose={onClose} title={tr("Buyruqlar")} cancelLabel="Yopish">
      <p className="!mt-0 truncate text-center text-[13px] text-[#8e8e93]">{tr(device?.name)}</p>
      {query.isLoading ? (
        <SkeletonRows rows={4} avatar={false} />
      ) : query.isError ? (
        <ErrorState message={query.error instanceof ApiError ? query.error.message : undefined} onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : !query.data?.length ? (
        <EmptyState icon={ChecklistIcon} title="Hali buyruq yo'q" hint="Xodim qo'shilganda yoki «Sinxronlash» bosilganda shu yerda paydo bo'ladi" />
      ) : (
        <div className={GROUP_BLOCK}>
          {query.data.map((c) => (
            <div key={c.id} className="group/row relative flex min-h-[60px] items-start gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-[var(--color-text)]">
                  {tr(COMMAND_TYPE[c.type])} · <span className="font-medium">{c.employee?.fullName ?? c.child?.fullName ?? `№ ${c.employeeNo}`}</span>
                </span>
                <span className="block truncate text-[13px] tabular-nums text-[#8e8e93]">
                  № {c.employeeNo} · {formatDateTime(c.createdAt)} · {tr("urinish")} {c.attempts}
                </span>
                {c.lastError && c.status !== "DONE" && <span className="mt-0.5 block break-words text-[12.5px] leading-snug text-[#ff3b30]">{c.lastError}</span>}
              </span>
              <Pill color={COMMAND_STATUS[c.status].color}>{tr(COMMAND_STATUS[c.status].label)}</Pill>
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
    </IosSheet>
  );
}
