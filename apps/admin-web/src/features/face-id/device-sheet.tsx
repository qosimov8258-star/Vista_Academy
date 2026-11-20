"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ListChecks, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { FaceIdDevice } from "@/lib/types";
import { Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { GROUP_BLOCK, IOS, SECTION_TITLE } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { DEVICE_ONLINE_MS, DEVICE_STATUS, StatusDot, TintNote, connectionText } from "./shared";
import { useTr } from "@/i18n/tr";

type Mode = "view" | "rotate" | "delete";

/**
 * Qurilma varag'i: ma'lumotlari va barcha amallar (sinxronlash, buyruqlar,
 * yangi token, tahrirlash, o'chirish). Qatorda amal tugmasi yo'q — qator
 * bosilsa shu varaq ochiladi. Token va o'chirish ikkinchi bosqichda tasdiqlanadi.
 */
export function DeviceSheet({
  slug,
  device,
  canWrite,
  onClose,
  onEdit,
  onShowCommands,
  onTokenCreated,
  onNotice,
}: {
  slug: string;
  device: FaceIdDevice | null;
  canWrite: boolean;
  onClose: () => void;
  onEdit: (device: FaceIdDevice) => void;
  onShowCommands: (device: FaceIdDevice) => void;
  onTokenCreated: (token: string, deviceName: string) => void;
  onNotice: (message: string, type?: "success" | "error") => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("view");

  const rotateMutation = useMutation({
    mutationFn: (d: FaceIdDevice) => api.post<{ agentToken: string }>(`/app/face-id/devices/${d.id}/token`, {}),
    onSuccess: (result, d) => {
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      onClose();
      onTokenCreated(result.agentToken, d.name);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (d: FaceIdDevice) => api.post<{ employees: number; children: number }>(`/app/face-id/devices/${d.id}/sync`, {}),
    onSuccess: (result, d) => {
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] });
      onClose();
      onNotice(tr("\"{0}\": {1} ta xodim va {2} ta bola qurilmaga yuborish navbatiga qo'yildi", d.name, result.employees, result.children));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/face-id/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] });
      onClose();
    },
  });

  // Har ochilishda ko'rinish bosqichidan va eski xatolarsiz boshlanadi
  const deviceId = device?.id;
  useEffect(() => {
    if (!deviceId) return;
    setMode("view");
    rotateMutation.reset();
    syncMutation.reset();
    deleteMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat boshqa qurilma ochilganda
  }, [deviceId]);

  const busy = rotateMutation.isPending || syncMutation.isPending || deleteMutation.isPending;
  const close = () => !busy && onClose();
  const errorOf = (err: unknown) => (err instanceof ApiError && err.message ? err.message : err ? tr("Xatolik yuz berdi") : null);

  if (!device) return <IosSheet open={false} onClose={onClose} title="">{null}</IosSheet>;

  const status = DEVICE_STATUS[device.status];
  const conn = connectionText(device.lastSeenAt, DEVICE_ONLINE_MS);

  let title: string = device.name;
  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  if (mode === "rotate") {
    title = tr("Yangi agent tokeni");
    const error = errorOf(rotateMutation.error);
    body = (
      <>
        <TintNote color={IOS.orange}>
          <p className="font-semibold">{device.name}</p>
          <p className="mt-1">
            {tr("uchun yangi token yaratilsa, eskisi darhol ishlamay qoladi — obyektdagi agentning")} .env{" "}
            {tr("faylini yangi token bilan almashtirish kerak bo'ladi.")}
          </p>
        </TintNote>
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
      </>
    );
    footer = (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton onClick={() => setMode("view")}>{tr("Qoldirish")}</SheetSecondaryButton>
        </div>
        <div className="flex-1">
          <SheetPrimaryButton onClick={() => rotateMutation.mutate(device)} loading={rotateMutation.isPending}>
            {tr("Yangi token")}
          </SheetPrimaryButton>
        </div>
      </div>
    );
  } else if (mode === "delete") {
    title = tr("Qurilmani o'chirish");
    const error = errorOf(deleteMutation.error);
    body = (
      <>
        <TintNote color={IOS.red}>
          <p className="font-semibold">{device.name}</p>
          <p className="mt-1">{tr("Qurilma o'chirilsa, unga bog'langan barcha yuz yozuvlari ham o'chib ketadi.")}</p>
        </TintNote>
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
      </>
    );
    footer = (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton onClick={() => setMode("view")}>{tr("Qoldirish")}</SheetSecondaryButton>
        </div>
        <div className="flex-1">
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(device.id)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
          >
            {deleteMutation.isPending ? <Spinner className="h-5 w-5 text-white" /> : tr("O'chirish")}
          </button>
        </div>
      </div>
    );
  } else {
    const syncError = errorOf(syncMutation.error);
    body = (
      <>
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <Pill color={status.color}>{tr(status.label)}</Pill>
          <p className="inline-flex items-center gap-1.5 text-[13px] text-[#8e8e93]">
            <StatusDot online={conn.online} />
            {conn.online ? tr("Agent onlayn") : device.lastSeenAt ? tr("Oxirgi aloqa: {0}", conn.text) : tr(conn.text)}
          </p>
        </div>

        <SheetSection title={tr("Qurilma")}>
          <SheetRow label={tr("Rusumi")}>{device.model}</SheetRow>
          <SheetRow label={tr("Seriya raqami")}>{device.serialNumber || "—"}</SheetRow>
          <SheetRow label={tr("Joylashuvi")}>{device.location || "—"}</SheetRow>
        </SheetSection>

        <SheetSection title={tr("Tarmoq va kirish")}>
          <SheetRow label={tr("IP manzili")}>
            <span className="tabular-nums">{device.ipAddress ? `${device.ipAddress}:${device.port}` : "—"}</span>
          </SheetRow>
          <SheetRow label={tr("Login")}>{device.username || "—"}</SheetRow>
          <SheetRow label={tr("Parol")}>
            {device.hasPassword ? (
              tr("Kiritilgan")
            ) : (
              <span style={{ color: device.ipAddress ? "#c93400" : undefined }}>{tr("Parol kiritilmagan")}</span>
            )}
          </SheetRow>
        </SheetSection>

        <section>
          <h3 className={SECTION_TITLE}>{tr("Amallar")}</h3>
          <div className={GROUP_BLOCK}>
            {canWrite && (
              <Row
                leading={<IosIcon icon={RefreshCw} tint={device.status === "ACTIVE" ? "green" : "gray"} size={30} />}
                title={tr("Sinxronlash")}
                subtitle={
                  device.status === "ACTIVE" ? tr("Filialdagi barcha faol xodim va bolalarni qayta yuborish") : tr("Faqat faol qurilmada ishlaydi")
                }
                value={syncMutation.isPending ? <Spinner className="h-[18px] w-[18px]" /> : undefined}
                chevron={false}
                onClick={device.status === "ACTIVE" ? () => !busy && syncMutation.mutate(device) : undefined}
              />
            )}
            <Row
              leading={<IosIcon icon={ListChecks} tint="blue" size={30} />}
              title={tr("Buyruqlar")}
              subtitle={tr("Qurilmaga nima yetib bordi, nima xato berdi")}
              value={device.queuedCommands > 0 ? tr("{0} navbatda", device.queuedCommands) : undefined}
              onClick={() => onShowCommands(device)}
            />
            {canWrite && (
              <Row
                leading={<IosIcon icon={KeyRound} tint="orange" size={30} />}
                title={tr("Yangi token")}
                subtitle={tr("Agent uchun yangi token")}
                onClick={() => setMode("rotate")}
              />
            )}
          </div>
          {syncError && <p className="px-4 pt-2 text-[13px] text-[#ff3b30]">{tr(syncError)}</p>}
        </section>

        {device.notes && (
          <SheetSection title={tr("Izoh")}>
            <p className="whitespace-pre-line px-4 py-3 text-[15px] text-[var(--color-text)]">{device.notes}</p>
          </SheetSection>
        )}
      </>
    );
    footer = canWrite ? (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton danger onClick={() => setMode("delete")}>
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
            {tr("O'chirish")}
          </SheetSecondaryButton>
        </div>
        <div className="flex-1">
          <SheetPrimaryButton onClick={() => onEdit(device)}>
            <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
            {tr("Tahrirlash")}
          </SheetPrimaryButton>
        </div>
      </div>
    ) : null;
  }

  return (
    <IosSheet open onClose={close} title={title} cancelLabel={mode === "view" ? "Yopish" : "Bekor qilish"} footer={footer}>
      {body}
    </IosSheet>
  );
}
