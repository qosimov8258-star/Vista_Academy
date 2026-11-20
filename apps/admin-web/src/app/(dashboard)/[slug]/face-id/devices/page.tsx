"use client";

import { use, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, ScanFace } from "lucide-react";
import { BranchSectionTabs } from "@/features/nav/branch-section-tabs";
import { api, ApiError } from "@/lib/api";
import type { FaceIdDevice, FaceIdGatewayInfo } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosButton } from "@/components/ios/button";
import { Group, ListRow, Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { PlusIcon } from "@/components/ios/icons";
import { IOS } from "@/components/ios/tokens";
import { ViewOnlyNote } from "@/components/ios/view-only-note";
import { Toast, type ToastState } from "@/components/ui/toast";
import { IosIcon } from "@/features/director/ios-icon";
import { DeviceFormModal } from "@/features/face-id/device-form-modal";
import { AgentTokenModal } from "@/features/face-id/agent-token-modal";
import { DeviceCommandsModal } from "@/features/face-id/device-commands-modal";
import { DeviceSheet } from "@/features/face-id/device-sheet";
import { GatewaySheet } from "@/features/face-id/gateway-sheet";
import { AgentPairingCard } from "@/features/face-id/agent-pairing-card";
import { DEVICE_ONLINE_MS, DEVICE_STATUS, isOnline } from "@/features/face-id/shared";
import { useTr } from "@/i18n/tr";

/** Ro'yxat qatoridagi bitta holat: qurilma faol bo'lsa — agent aloqasi, aks holda qurilma holati */
function DevicePill({ device }: { device: FaceIdDevice }) {
  const tr = useTr();
  if (device.status !== "ACTIVE") {
    const s = DEVICE_STATUS[device.status];
    return <Pill color={s.color}>{tr(s.label)}</Pill>;
  }
  if (isOnline(device.lastSeenAt, DEVICE_ONLINE_MS)) return <Pill color={IOS.green}>{tr("Onlayn")}</Pill>;
  return <Pill color={IOS.gray}>{device.lastSeenAt ? tr("Oflayn") : tr("Ulanmagan")}</Pill>;
}

export default function FaceIdDevicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const [formModal, setFormModal] = useState<{ open: boolean; device: FaceIdDevice | null }>({ open: false, device: null });
  // Ochiq varaq — id bo'yicha: ro'yxat yangilansa varaqdagi ma'lumot ham yangilanadi
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Agent tokeni faqat bir marta ko'rsatiladi — yaratilganda yoki yangilanganda
  const [shownToken, setShownToken] = useState<{ token: string; deviceName: string } | null>(null);
  const [commandsFor, setCommandsFor] = useState<FaceIdDevice | null>(null);
  // «Internet orqali ulash» varag'i — id bo'yicha: ulangach holat ro'yxatdan yangilanadi
  const [gatewayForId, setGatewayForId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const devicesQuery = useQuery({
    queryKey: ["face-id-devices", slug, forcedBranchId],
    queryFn: () => api.get<FaceIdDevice[]>(`/app/face-id/devices${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
    // "Onlayn" belgisi va navbat soni yangilanib tursin
    refetchInterval: 15_000,
  });

  // Internet (ISUP gateway) orqali ulash shu serverda yoqilganmi — yoqilmagan bo'lsa bo'lim ko'rinmaydi
  const gatewayQuery = useQuery({
    queryKey: ["face-id-gateway-info"],
    queryFn: () => api.get<FaceIdGatewayInfo>("/app/face-id/gateway"),
    staleTime: 5 * 60_000,
  });
  const gatewayEnabled = !!gatewayQuery.data?.enabled;

  const devices = devicesQuery.data ?? [];
  const selected = devices.find((d) => d.id === selectedId) ?? null;
  const gatewayFor = devices.find((d) => d.id === gatewayForId) ?? null;
  const online = devices.filter((d) => d.status === "ACTIVE" && isOnline(d.lastSeenAt, DEVICE_ONLINE_MS)).length;

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        <BranchSectionTabs slug={slug} section="faceId" current="devices" />
        <PageHeaderCard
          icon={ScanFace}
          tint="purple"
          title={tr("Face ID")}
          count={devicesQuery.data ? tr("{0} ta", devices.length) : undefined}
          subtitle={tr("Yuz tanish qurilmalari (Hikvision DS-K1T342MX va b.)")}
          actions={
            canWrite && (
              <IosButton label={tr("Yangi qurilma")} icon={PlusIcon} variant="primary" compact onClick={() => setFormModal({ open: true, device: null })} />
            )
          }
        />

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        {/* Internet orqali ulash yoqilgan serverda u asosiy yo'l — agent kartasi ro'yxatdan keyin turadi */}
        {gatewayEnabled ? (
          <Group
            title={tr("Internet orqali ulash")}
            footer={canWrite ? tr("Ulash uchun pastdagi qurilmani bosing → «Internet orqali ulash». Qurilma hali yo'q bo'lsa — «Yangi qurilma».") : undefined}
          >
            <Row
              leading={<IosIcon icon={Globe} tint="teal" size={30} />}
              title={<span className="whitespace-normal">{tr("Terminal serverga o'zi ulanadi")}</span>}
              subtitle={<span className="whitespace-normal">{tr("Bog'chada doim yoniq kompyuter va agent kerak emas — terminalga internet yetarli.")}</span>}
              chevron={false}
            />
          </Group>
        ) : (
          <AgentPairingCard branchId={forcedBranchId ?? null} canWrite={canWrite} />
        )}

        <Group
          title={devices.length > 0 ? tr("Qurilmalar · {0} onlayn", online) : tr("Qurilmalar")}
          refreshing={devicesQuery.isFetching && !devicesQuery.isLoading}
          bare={devicesQuery.isLoading || devicesQuery.isError || devices.length === 0}
          footer={
            devices.length === 0
              ? undefined
              : canWrite
                ? tr("Qurilmani bosing — sinxronlash, buyruqlar, token va tahrirlash shu yerda.")
                : tr("Qurilmani bosing — ma'lumotlari va buyruqlari shu yerda.")
          }
        >
          {devicesQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : devicesQuery.isError ? (
            <ErrorState
              message={devicesQuery.error instanceof ApiError ? devicesQuery.error.message : undefined}
              onRetry={() => devicesQuery.refetch()}
              retrying={devicesQuery.isFetching}
            />
          ) : devices.length === 0 ? (
            <EmptyState
              icon={ScanFace}
              title="Hali qurilma yo'q"
              hint={canWrite ? "«Yangi qurilma» tugmasi orqali birinchi terminalni qo'shing" : undefined}
            />
          ) : (
            devices.map((device) => (
              <ListRow
                key={device.id}
                avatar={<IosIcon icon={ScanFace} tint={device.status === "ACTIVE" ? "purple" : "gray"} size={44} />}
                title={device.name}
                subtitle={[
                  device.gatewayConnected ? tr("Internet orqali") : device.ipAddress ? `${device.ipAddress}:${device.port}` : device.model,
                  device.location,
                  device.queuedCommands > 0 ? tr("{0} navbatda", device.queuedCommands) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                meta={<DevicePill device={device} />}
                onClick={() => setSelectedId(device.id)}
              />
            ))
          )}
        </Group>

        {gatewayEnabled && <AgentPairingCard branchId={forcedBranchId ?? null} canWrite={canWrite} />}
      </div>

      <DeviceSheet
        slug={slug}
        device={selected}
        canWrite={canWrite}
        gatewayEnabled={gatewayEnabled}
        onClose={() => setSelectedId(null)}
        onEdit={(device) => {
          setSelectedId(null);
          setFormModal({ open: true, device });
        }}
        onShowCommands={(device) => setCommandsFor(device)}
        onShowGateway={(device) => setGatewayForId(device.id)}
        onTokenCreated={(token, deviceName) => setShownToken({ token, deviceName })}
        onNotice={(message, type = "success") => setToast({ type, message })}
      />

      {canWrite && (
        <DeviceFormModal
          open={formModal.open}
          onClose={() => setFormModal({ open: false, device: null })}
          slug={slug}
          device={formModal.device}
          gatewayEnabled={gatewayEnabled}
          // Internet orqali ulash yoqilgan serverda yangi qurilma shu yo'l bilan ulanadi —
          // agent tokeni kerak bo'lsa, qurilma varag'idagi «Yangi token» bilan olinadi
          onCreated={(device, token) => (gatewayEnabled ? setGatewayForId(device.id) : setShownToken({ token, deviceName: device.name }))}
        />
      )}

      {canWrite && (
        <GatewaySheet
          slug={slug}
          device={gatewayFor}
          onClose={() => setGatewayForId(null)}
          onNotice={(message, type = "success") => setToast({ type, message })}
        />
      )}

      <AgentTokenModal token={shownToken?.token ?? null} deviceName={shownToken?.deviceName ?? ""} onClose={() => setShownToken(null)} />
      <DeviceCommandsModal slug={slug} device={commandsFor} onClose={() => setCommandsFor(null)} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
