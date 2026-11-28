"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MonitorSmartphone, Unplug } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Group, Row } from "@/components/ios/group";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { formatDateTime } from "@/lib/format";
import { AGENT_ONLINE_MS, StatusDot, TintNote, connectionText } from "./shared";
import { useTr } from "@/i18n/tr";

interface FaceIdAgent {
  id: string;
  name: string;
  branchId: string;
  lastSeenAt: string | null;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type InstallerPlatform = "windows" | "macos-arm64" | "macos-x64";

const PLATFORMS: { value: InstallerPlatform; label: string }[] = [
  { value: "windows", label: "Windows" },
  { value: "macos-arm64", label: "macOS (Apple M1–M4)" },
  { value: "macos-x64", label: "macOS (Intel)" },
];

/** Shu brauzer qaysi tizimda — mos tugma birinchi turadi. */
function guessPlatform(): InstallerPlatform {
  if (typeof navigator === "undefined") return "windows";
  return /Mac/i.test(navigator.userAgent) ? "macos-arm64" : "windows";
}

const HELP: Record<InstallerPlatform, string> = {
  windows:
    "Yuklangan faylni ikki marta bosing. Windows \"kompyuteringiz himoyalandi\" desa — \"Batafsil\" → \"Baribir ishga tushirish\", keyin administrator so'roviga \"Ha\".",
  "macos-arm64":
    "Yuklangan .pkg ustida o'ng tugma → \"Ochish\" (birinchi marta macOS shunday so'raydi), so'ng o'rnatuvchi ko'rsatmalari bo'yicha davom eting.",
  "macos-x64":
    "Yuklangan .pkg ustida o'ng tugma → \"Ochish\" (birinchi marta macOS shunday so'raydi), so'ng o'rnatuvchi ko'rsatmalari bo'yicha davom eting.",
};

/**
 * "Obyekt agenti": bog'chadagi kompyuterdagi hik-agent filialga bir martalik kod
 * bilan bir marta ulanadi. Shundan keyin shu sahifada qo'shilgan har bir qurilma
 * agentga o'zi tushadi — tokenni .env ga yozish shart emas.
 */
export function AgentPairingCard({ branchId, canWrite }: { branchId: string | null; canWrite: boolean }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [selected, setSelected] = useState<FaceIdAgent | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [downloaded, setDownloaded] = useState<InstallerPlatform | null>(null);
  // Server render'da navigator yo'q — tizim mount'dan keyin aniqlanadi (hydration farqi bo'lmasin)
  const [preferred, setPreferred] = useState<InstallerPlatform>("windows");
  useEffect(() => setPreferred(guessPlatform()), []);
  const platforms = [...PLATFORMS].sort((a, b) => (a.value === preferred ? -1 : b.value === preferred ? 1 : 0));

  const agentsQuery = useQuery({
    queryKey: ["face-id-agents", branchId],
    queryFn: () => api.get<FaceIdAgent[]>(`/app/face-id/agents${branchId ? `?branchId=${branchId}` : ""}`),
    refetchInterval: 15_000,
  });

  const codeMutation = useMutation({
    mutationFn: () => api.post<{ code: string; expiresAt: string }>("/app/face-id/agents/pairing-code"),
    onSuccess: (data) => setPairing(data),
  });

  const installerMutation = useMutation({
    mutationFn: (platform: InstallerPlatform) =>
      api.post<{ path: string; code: string; expiresAt: string }>("/app/face-id/agents/installer-link", { platform }),
    onSuccess: (data, platform) => {
      // Fayl to'g'ridan-to'g'ri yuklanadi (katta — brauzer xotirasiga olinmaydi); nomida ulash kodi
      window.location.href = new URL(`${API_URL.replace(/\/+$/, "")}${data.path}`, window.location.origin).href;
      setDownloaded(platform);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/face-id/agents/${id}`),
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["face-id-agents"] });
    },
  });

  const openAgent = (agent: FaceIdAgent) => {
    revokeMutation.reset();
    setConfirmRevoke(false);
    setSelected(agent);
  };
  const closeAgent = () => {
    if (!revokeMutation.isPending) setSelected(null);
  };

  const agents = agentsQuery.data ?? [];
  const actionError = (codeMutation.error ?? installerMutation.error) as unknown;
  const selectedState = selected ? connectionText(selected.lastSeenAt, AGENT_ONLINE_MS) : null;

  return (
    <div className="space-y-5">
      <Group
        title={tr("Obyekt agenti")}
        footer={
          canWrite ? (
            <button
              type="button"
              onClick={() => codeMutation.mutate()}
              disabled={codeMutation.isPending}
              className="inline-flex min-h-[32px] items-center gap-1.5 text-[var(--color-primary)] transition-opacity active:opacity-50"
            >
              {codeMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
              {tr("Ishlab chiquvchilar uchun: kod bilan ulash (npm run pair)")}
            </button>
          ) : undefined
        }
      >
        <div className="group/row relative flex items-start gap-3 px-4 py-3.5">
          <IosIcon icon={MonitorSmartphone} tint="purple" size={30} />
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-[#8e8e93]">
            {tr("Bog'chadagi kompyuterdagi agent bir marta ulanadi — keyin bu yerda qo'shilgan har bir qurilma unga o'zi tushadi, tokenni hech qayerga yozish shart emas.")}
            {canWrite && (
              <>
                {" "}
                {tr("Bog'chadagi kompyuterda shu sahifani ochib, o'rnatuvchini yuklab oling va ikki marta bosing — u o'zi o'rnatiladi, ulanadi va kompyuter yonganda o'zi ishga tushadi.")}
              </>
            )}
          </p>
        </div>
        {canWrite &&
          platforms.map((p, i) => {
            const loading = installerMutation.isPending && installerMutation.variables === p.value;
            return (
              <Row
                key={p.value}
                leading={<IosIcon icon={Download} tint={i === 0 ? "blue" : "gray"} size={30} />}
                title={<span className={i === 0 ? "font-semibold text-[var(--color-primary)]" : undefined}>{tr(p.label)}</span>}
                subtitle={tr("Agentni o'rnatuvchi")}
                value={loading ? <Spinner className="h-[18px] w-[18px]" /> : undefined}
                chevron={false}
                onClick={() => !installerMutation.isPending && installerMutation.mutate(p.value)}
              />
            );
          })}
      </Group>

      {downloaded && (
        <TintNote color={IOS.green}>
          {tr("Yuklab olinmoqda.")} {tr(HELP[downloaded])} {tr("Fayl 15 daqiqa ichida ishga tushirilishi kerak.")}
        </TintNote>
      )}
      {actionError instanceof ApiError && <TintNote color={IOS.red}>{tr(actionError.message)}</TintNote>}

      <Group title={tr("Ulangan agentlar")} refreshing={agentsQuery.isFetching && !agentsQuery.isLoading}>
        {agentsQuery.isLoading ? (
          <div className="flex min-h-[52px] items-center justify-center">
            <Spinner className="h-5 w-5 text-[#8e8e93]" />
          </div>
        ) : agents.length === 0 ? (
          <p className="px-4 py-3.5 text-[14px] text-[#8e8e93]">{tr("Hali ulangan agent yo'q.")}</p>
        ) : (
          agents.map((agent) => {
            const state = connectionText(agent.lastSeenAt, AGENT_ONLINE_MS);
            return (
              <Row
                key={agent.id}
                leading={<IosIcon icon={MonitorSmartphone} tint={state.online ? "green" : "gray"} size={30} />}
                title={agent.name}
                subtitle={
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot online={state.online} />
                    {state.online ? tr("Onlayn") : agent.lastSeenAt ? tr("Oxirgi aloqa: {0}", state.text) : tr(state.text)}
                  </span>
                }
                onClick={canWrite ? () => openAgent(agent) : undefined}
              />
            );
          })
        )}
      </Group>

      {/* Agent varag'i: ma'lumot va «Uzish» (ikkinchi bosqichda tasdiqlanadi) */}
      <IosSheet
        open={!!selected}
        onClose={closeAgent}
        title={confirmRevoke ? tr("Agentni uzish") : selected?.name ?? ""}
        cancelLabel={confirmRevoke ? "Bekor qilish" : "Yopish"}
        footer={
          confirmRevoke ? (
            <div className="flex gap-3">
              <div className="flex-1">
                <SheetSecondaryButton onClick={() => setConfirmRevoke(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => selected && revokeMutation.mutate(selected.id)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
                >
                  {revokeMutation.isPending ? <Spinner className="h-5 w-5 text-white" /> : tr("Uzish")}
                </button>
              </div>
            </div>
          ) : (
            <SheetSecondaryButton danger onClick={() => setConfirmRevoke(true)}>
              <Unplug className="h-[18px] w-[18px]" strokeWidth={2} />
              {tr("Agentni uzish")}
            </SheetSecondaryButton>
          )
        }
      >
        {confirmRevoke ? (
          <>
            <TintNote color={IOS.red}>
              <p className="font-semibold">{selected?.name}</p>
              <p className="mt-1">{tr("agenti uziladi va qurilmalarga xizmat qilmay qo'yadi. Qayta ulash uchun yangi kod kerak bo'ladi.")}</p>
            </TintNote>
            {revokeMutation.error instanceof ApiError && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(revokeMutation.error.message)}</p>}
          </>
        ) : (
          selected &&
          selectedState && (
            <SheetSection>
              <SheetRow label={!selectedState.online && selected.lastSeenAt ? tr("Oxirgi aloqa") : tr("Holati")}>
                <span className="inline-flex items-center justify-end gap-1.5">
                  <StatusDot online={selectedState.online} />
                  {tr(selectedState.text)}
                </span>
              </SheetRow>
              <SheetRow label={tr("Ulangan")}>{formatDateTime(selected.createdAt)}</SheetRow>
            </SheetSection>
          )
        )}
      </IosSheet>

      {/* Ishlab chiquvchilar uchun: bir martalik ulash kodi */}
      <IosSheet
        open={!!pairing}
        onClose={() => setPairing(null)}
        title={tr("Agentni ulash")}
        cancelLabel="Yopish"
        footer={<SheetPrimaryButton onClick={() => setPairing(null)}>{tr("Tayyor")}</SheetPrimaryButton>}
      >
        <SheetSection
          title={tr("1. Buyruq")}
          footer={tr("Bog'chadagi kompyuterda, hik-agent papkasida quyidagini ishga tushiring va kodni kiriting:")}
        >
          <pre className="px-4 py-3.5 font-mono text-[14px] text-[var(--color-text)]">npm run pair</pre>
        </SheetSection>
        <section>
          <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">{tr("2. Kod")}</h3>
          <div className="ios-snow">
            <div className={`${GROUP_BLOCK} px-4 py-5 text-center`}>
              <div className="select-all font-mono text-[30px] font-bold tracking-[0.18em] text-[var(--color-text)]">{pairing?.code}</div>
              <div className="mt-1 text-[13px] text-[#8e8e93]">
                {tr("Bir marta ishlaydi,")} {pairing ? formatDateTime(pairing.expiresAt) : ""} {tr("gacha amal qiladi")}
              </div>
            </div>
          </div>
          <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">
            {tr("Ulangach agentni ishga tushiring (npm start yoki pm2) — shu filialdagi qurilmalar o'zi ulanadi.")}
          </p>
        </section>
      </IosSheet>
    </div>
  );
}
