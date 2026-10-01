"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/lib/format";
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

/** Agent shu vaqt ichida murojaat qilgan bo'lsa — onlayn (har daqiqada qurilmalar ro'yxatini so'raydi) */
const ONLINE_WINDOW_MS = 3 * 60_000;

/**
 * "Obyekt agenti": bog'chadagi kompyuterdagi hik-agent filialga bir martalik kod
 * bilan bir marta ulanadi. Shundan keyin shu sahifada qo'shilgan har bir qurilma
 * agentga o'zi tushadi — tokenni .env ga yozish shart emas.
 */
export function AgentPairingCard({ branchId, canWrite }: { branchId: string | null; canWrite: boolean }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [revoking, setRevoking] = useState<FaceIdAgent | null>(null);
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
      setRevoking(null);
      queryClient.invalidateQueries({ queryKey: ["face-id-agents"] });
    },
  });

  const agents = agentsQuery.data ?? [];

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Obyekt agenti")}</h2>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {tr("Bog'chadagi kompyuterdagi agent bir marta ulanadi — keyin bu yerda qo'shilgan har bir qurilma unga o'zi tushadi, tokenni hech qayerga yozish shart emas.")}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="space-y-2">
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {tr("Bog'chadagi kompyuterda shu sahifani ochib, o'rnatuvchini yuklab oling va ikki marta bosing — u o'zi o'rnatiladi, ulanadi va kompyuter yonganda o'zi ishga tushadi.")}
            </p>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p, i) => (
                <Button
                  key={p.value}
                  variant={i === 0 ? "primary" : "outline"}
                  onClick={() => installerMutation.mutate(p.value)}
                  loading={installerMutation.isPending && installerMutation.variables === p.value}
                >
                  {tr("Agentni o'rnatish —")}{" "}{tr(p.label)}
                </Button>
              ))}
            </div>
            {downloaded && (
              <div role="status" className="rounded-[var(--radius-md)] bg-[var(--color-success-bg)] px-3 py-2.5 text-[13px] text-[var(--color-success)]">
                {tr("Yuklab olinmoqda.")}{" "}{tr(HELP[downloaded])} {tr("Fayl 15 daqiqa ichida ishga tushirilishi kerak.")}
              </div>
            )}
            <button
              type="button"
              onClick={() => codeMutation.mutate()}
              className="cursor-pointer text-[12.5px] text-[var(--color-text-muted)] underline underline-offset-2"
            >
              {tr("Ishlab chiquvchilar uchun: kod bilan ulash (npm run pair)")}
            </button>
          </div>
        )}
        {(codeMutation.error ?? installerMutation.error) instanceof ApiError && (
          <p className="text-[13px] text-[var(--color-danger)]">{tr(((codeMutation.error ?? installerMutation.error) as ApiError).message)}</p>
        )}

        {agentsQuery.isLoading ? null : agents.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">{tr("Hali ulangan agent yo'q.")}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-hair)]">
            {agents.map((agent) => {
              const online = !!agent.lastSeenAt && Date.now() - new Date(agent.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
              return (
                <li key={agent.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="font-medium text-[var(--color-text)]">{tr(agent.name)}</span>
                    <span className="ml-2 inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
                      <span className={`h-2 w-2 rounded-full ${online ? "bg-[var(--color-success)]" : "bg-[var(--color-text-faint,#9ca3af)]"}`} aria-hidden="true" />
                      {online ? "Onlayn" : agent.lastSeenAt ? `Oxirgi aloqa: ${formatDateTime(agent.lastSeenAt)}` : tr("Hali ulanmagan")}
                    </span>
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setRevoking(agent)}
                      className="shrink-0 cursor-pointer text-[13px] font-medium text-[var(--color-danger)]"
                    >
                      {tr("Uzish")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      <Modal open={!!pairing} onClose={() => setPairing(null)} title={tr("Agentni ulash")}>
        <div className="space-y-4 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          <p>{tr("Bog'chadagi kompyuterda, hik-agent papkasida quyidagini ishga tushiring va kodni kiriting:")}</p>
          <pre className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)]">
            npm run pair
          </pre>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-hair)] py-4 text-center">
            <div className="select-all font-mono text-[30px] font-bold tracking-[0.18em] text-[var(--color-text)]">{tr(pairing?.code)}</div>
            <div className="mt-1 text-[12.5px]">
              {tr("Bir marta ishlaydi,")}{" "}{pairing ? formatDateTime(pairing.expiresAt) : ""} {tr("gacha amal qiladi")}
            </div>
          </div>
          <p>{tr("Ulangach agentni ishga tushiring (npm start yoki pm2) — shu filialdagi qurilmalar o'zi ulanadi.")}</p>
          <div className="flex justify-end">
            <Button onClick={() => setPairing(null)}>{tr("Tayyor")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={tr("Agentni uzish")}
        description={
          <>
            <strong>{tr(revoking?.name)}</strong> {tr("agenti uziladi va qurilmalarga xizmat qilmay qo'yadi. Qayta ulash uchun yangi kod kerak bo'ladi.")}
          </>
        }
        confirmLabel={tr("Uzish")}
        tone="danger"
        loading={revokeMutation.isPending}
        error={revokeMutation.error instanceof ApiError ? revokeMutation.error.message : null}
        onConfirm={() => revoking && revokeMutation.mutate(revoking.id)}
      />
    </Card>
  );
}
