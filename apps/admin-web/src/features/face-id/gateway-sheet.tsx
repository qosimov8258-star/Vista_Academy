"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Globe } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { FaceIdDevice, FaceIdGatewayDetails } from "@/lib/types";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { Spinner } from "@/components/ios/spinner";
import { CheckIcon, CopyIcon } from "@/components/ios/icons";
import { GROUP_BLOCK, IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { TintNote } from "./shared";
import { useTr } from "@/i18n/tr";

type Mode = "view" | "disconnect";

/** Terminalga qo'lda kiritiladigan qiymat: bosilsa nusxalanadi (telefon va kompyuterda bir xil). */
function CopyRow({ label, value }: { label: string; value: string }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard ruxsati yo'q — qiymat ekranda turibdi, qo'lda ko'chiriladi
    }
  };
  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={copy}
        aria-label={tr("{0} — nusxalash", label)}
        className="flex min-h-[52px] w-full items-center gap-3 py-2 pl-4 pr-2 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
      >
        <span className="shrink-0 text-[15px] text-[var(--color-text)]">{label}</span>
        <code className="min-w-0 flex-1 select-all break-all text-right font-mono text-[15px] tabular-nums text-[var(--color-text)]">{value}</code>
        <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", copied ? "text-[#34c759]" : "text-[var(--color-primary)]")}>
          {copied ? <CheckIcon className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <CopyIcon className="h-[18px] w-[18px]" />}
        </span>
      </button>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/** Tushuntirish qatori: raqamli doira + matn */
function StepRow({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2.5">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
        {n}
      </span>
      <span className="min-w-0 flex-1 text-[15px] leading-snug text-[var(--color-text)]">{children}</span>
      <span className={ROW_SEPARATOR} style={{ left: 54 }} aria-hidden="true" />
    </div>
  );
}

/**
 * «Internet orqali ulash»: terminal serverga o'zi (ISUP) ulanadi — bog'chada
 * kompyuter va agent kerak emas. Ulanmagan qurilmada tushuntirish + «Ulash»;
 * ulanganida terminalga kiritiladigan to'rt qiymat va aloqa holati. Uzish
 * ikkinchi bosqichda tasdiqlanadi.
 */
export function GatewaySheet({
  slug,
  device,
  onClose,
  onNotice,
}: {
  slug: string;
  device: FaceIdDevice | null;
  onClose: () => void;
  onNotice: (message: string, type?: "success" | "error") => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("view");
  const deviceId = device?.id;
  const connected = !!device?.gatewayConnected;
  const detailsKey = ["face-id-gateway", slug, deviceId];

  const detailsQuery = useQuery({
    queryKey: detailsKey,
    queryFn: () => api.get<FaceIdGatewayDetails>(`/app/face-id/devices/${deviceId}/gateway`),
    enabled: !!deviceId && connected,
    // Terminal ulangan zahoti «Terminal ulangan» ko'rinsin
    refetchInterval: 10_000,
  });

  const connectMutation = useMutation({
    mutationFn: (d: FaceIdDevice) => api.post<FaceIdGatewayDetails>(`/app/face-id/devices/${d.id}/gateway`, {}),
    onSuccess: (result, d) => {
      // Qiymatlar darhol ko'rinsin — ro'yxat yangilanishini kutmasdan
      queryClient.setQueryData(["face-id-gateway", slug, d.id], result);
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      if (result.queued) {
        onNotice(tr("\"{0}\": {1} ta xodim va {2} ta bola qurilmaga yuborish navbatiga qo'yildi", d.name, result.queued.employees, result.queued.children));
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (d: FaceIdDevice) => api.delete(`/app/face-id/devices/${d.id}/gateway`),
    onSuccess: (_result, d) => {
      queryClient.removeQueries({ queryKey: ["face-id-gateway", slug, d.id] });
      connectMutation.reset();
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      onClose();
      onNotice(tr("\"{0}\" internet ulanishidan uzildi", d.name));
    },
  });

  // Har ochilishda ko'rinish bosqichidan va eski xatolarsiz boshlanadi
  useEffect(() => {
    if (!deviceId) return;
    setMode("view");
    connectMutation.reset();
    disconnectMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat boshqa qurilma ochilganda
  }, [deviceId]);

  const busy = connectMutation.isPending || disconnectMutation.isPending;
  const close = () => !busy && onClose();
  const errorOf = (err: unknown) => (err instanceof ApiError && err.message ? err.message : err ? tr("Xatolik yuz berdi") : null);

  if (!device) return <IosSheet open={false} onClose={onClose} title="">{null}</IosSheet>;

  // Ulash javobi kelgan, lekin ro'yxat hali yangilanmagan bo'lsa ham qiymatlar ko'rsatiladi
  const details = detailsQuery.data ?? (connectMutation.data && connectMutation.variables?.id === device.id ? connectMutation.data : undefined);

  let title = tr("Internet orqali ulash");
  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  if (mode === "disconnect") {
    title = tr("Internetdan uzish");
    const error = errorOf(disconnectMutation.error);
    body = (
      <>
        <TintNote color={IOS.red}>
          <p className="font-semibold">{device.name}</p>
          <p className="mt-1">
            {tr("Terminal serverga internet orqali ulana olmay qoladi. Yuz yozuvlari o'chmaydi; bog'chada agent o'rnatilgan bo'lsa, qurilma u bilan ishlayveradi.")}
          </p>
        </TintNote>
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
      </>
    );
    footer = (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton onClick={() => !busy && setMode("view")}>{tr("Qoldirish")}</SheetSecondaryButton>
        </div>
        <div className="flex-1">
          <button
            type="button"
            disabled={disconnectMutation.isPending}
            onClick={() => disconnectMutation.mutate(device)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
          >
            {disconnectMutation.isPending ? <Spinner className="h-5 w-5 text-white" /> : tr("Uzish")}
          </button>
        </div>
      </div>
    );
  } else if (details) {
    const online = details.online;
    body = (
      <>
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          {online === true ? (
            <Pill color={IOS.green}>{tr("Terminal ulangan")}</Pill>
          ) : online === false ? (
            <Pill color={IOS.orange}>{tr("Terminal kutilmoqda")}</Pill>
          ) : (
            <Pill color={IOS.gray}>{tr("Holati aniqlanmadi")}</Pill>
          )}
          <p className="max-w-[340px] text-[13px] leading-snug text-[#8e8e93]">
            {online === true
              ? tr("Xodim va bolalar terminalga o'zi yuboriladi, o'tishlar o'zi keladi.")
              : tr("Quyidagi qiymatlarni terminalga kiriting — saqlangach bir daqiqa ichida ulanadi.")}
          </p>
        </div>

        <SheetSection title={tr("Terminalga kiritiladigan qiymatlar")} footer={tr("Qiymat bosilsa nusxalanadi. Kalit katta-kichik harfni farqlaydi.")}>
          <CopyRow label={tr("Server manzili")} value={details.host ?? "—"} />
          <CopyRow label={tr("Port")} value={String(details.port)} />
          <CopyRow label="Device ID" value={details.deviceId} />
          <CopyRow label={tr("Kalit")} value={details.key} />
        </SheetSection>

        <SheetSection title={tr("Terminalda qayerga kiritiladi")}>
          <StepRow n={1}>
            {tr("Terminalning veb-sahifasini oching (brauzerda terminal IP manzili) va")} <span className="font-medium">System and Maintenance → System Configuration → Network → Device Access → ISUP</span>{" "}
            {tr("bo'limiga o'ting.")}
          </StepRow>
          <StepRow n={2}>
            <span className="font-medium">Enable</span> {tr("ni yoqing,")} <span className="font-medium">Version — ISUP 5.0</span>.
          </StepRow>
          <StepRow n={3}>
            {tr("Yuqoridagi to'rt qiymatni kiriting: Server Address, Port, Device ID, Encryption Key — va")} <span className="font-medium">Save</span>.
          </StepRow>
        </SheetSection>

        {online !== true && (
          <TintNote color={IOS.orange}>
            {tr("Port aynan {0} bo'lsin — terminalda odatda 7660 yozilgan bo'ladi, u bilan ulanmaydi.", details.port)}
          </TintNote>
        )}

        {/* Xavfli amal asosiy tugma o'rnida emas — iOS'dagi «Forget This Network» kabi alohida qizil qator */}
        <div className={GROUP_BLOCK}>
          <button
            type="button"
            onClick={() => setMode("disconnect")}
            className="flex min-h-[48px] w-full items-center justify-center px-4 text-[16px] text-[#ff3b30] transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
          >
            {tr("Internetdan uzish")}
          </button>
        </div>
      </>
    );
  } else if (connected) {
    // Ulangan, qiymatlar yuklanmoqda (yoki yuklab bo'lmadi)
    body = detailsQuery.isError ? (
      <ErrorState
        message={detailsQuery.error instanceof ApiError ? detailsQuery.error.message : undefined}
        onRetry={() => detailsQuery.refetch()}
        retrying={detailsQuery.isFetching}
      />
    ) : (
      <SkeletonRows rows={4} avatar={false} />
    );
  } else {
    const error = errorOf(connectMutation.error);
    body = (
      <>
        <div className="flex flex-col items-center gap-3 pt-1 text-center">
          <IosIcon icon={Globe} tint="teal" size={48} />
          <p className="max-w-[360px] text-[14px] leading-snug text-[#8e8e93]">
            {tr("Terminal serverga internet orqali o'zi ulanadi. Bog'chada doim yoniq kompyuter va agent kerak emas — terminalga internet yetarli.")}
          </p>
        </div>

        <SheetSection title={tr("Qanday ishlaydi")}>
          <StepRow n={1}>{tr("«Ulash» bosilgach terminalga kiritiladigan to'rt qiymat chiqadi.")}</StepRow>
          <StepRow n={2}>{tr("Ularni terminalning veb-sahifasidagi ISUP bo'limiga kiritasiz.")}</StepRow>
          <StepRow n={3}>{tr("Terminal ulangach xodim va bolalar unga o'zi yuklanadi, o'tishlar o'zi keladi.")}</StepRow>
        </SheetSection>

        {error && <TintNote color={IOS.red}>{tr(error)}</TintNote>}
      </>
    );
    footer = (
      <SheetPrimaryButton onClick={() => connectMutation.mutate(device)} loading={connectMutation.isPending}>
        {tr("Ulash")}
      </SheetPrimaryButton>
    );
  }

  return (
    <IosSheet open onClose={close} title={title} cancelLabel={mode === "view" ? "Yopish" : "Bekor qilish"} footer={footer}>
      {/* Tasdiqlash bosqichida nom qizil izohning o'zida turadi */}
      {mode === "view" && <p className="!mt-0 truncate text-center text-[13px] text-[#8e8e93]">{device.name}</p>}
      {body}
    </IosSheet>
  );
}
