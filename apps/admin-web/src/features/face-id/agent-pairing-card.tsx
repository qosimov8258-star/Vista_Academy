"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/lib/format";

interface FaceIdAgent {
  id: string;
  name: string;
  branchId: string;
  lastSeenAt: string | null;
  createdAt: string;
}

/** Agent shu vaqt ichida murojaat qilgan bo'lsa — onlayn (har daqiqada qurilmalar ro'yxatini so'raydi) */
const ONLINE_WINDOW_MS = 3 * 60_000;

/**
 * "Obyekt agenti": bog'chadagi kompyuterdagi hik-agent filialga bir martalik kod
 * bilan bir marta ulanadi. Shundan keyin shu sahifada qo'shilgan har bir qurilma
 * agentga o'zi tushadi — tokenni .env ga yozish shart emas.
 */
export function AgentPairingCard({ branchId, canWrite }: { branchId: string | null; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [revoking, setRevoking] = useState<FaceIdAgent | null>(null);

  const agentsQuery = useQuery({
    queryKey: ["face-id-agents", branchId],
    queryFn: () => api.get<FaceIdAgent[]>(`/app/face-id/agents${branchId ? `?branchId=${branchId}` : ""}`),
    refetchInterval: 15_000,
  });

  const codeMutation = useMutation({
    mutationFn: () => api.post<{ code: string; expiresAt: string }>("/app/face-id/agents/pairing-code"),
    onSuccess: (data) => setPairing(data),
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
            <h2 className="text-[15px] font-semibold text-[var(--color-text)]">Obyekt agenti</h2>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Bog&apos;chadagi kompyuterdagi agent bir marta ulanadi — keyin bu yerda qo&apos;shilgan har bir qurilma unga o&apos;zi
              tushadi, tokenni hech qayerga yozish shart emas.
            </p>
          </div>
          {canWrite && (
            <Button variant="outline" onClick={() => codeMutation.mutate()} loading={codeMutation.isPending}>
              Agentni ulash
            </Button>
          )}
        </div>
        {codeMutation.error instanceof ApiError && (
          <p className="text-[13px] text-[var(--color-danger)]">{codeMutation.error.message}</p>
        )}

        {agentsQuery.isLoading ? null : agents.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Hali ulangan agent yo&apos;q.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-hair)]">
            {agents.map((agent) => {
              const online = !!agent.lastSeenAt && Date.now() - new Date(agent.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
              return (
                <li key={agent.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="font-medium text-[var(--color-text)]">{agent.name}</span>
                    <span className="ml-2 inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
                      <span className={`h-2 w-2 rounded-full ${online ? "bg-[var(--color-success)]" : "bg-[var(--color-text-faint,#9ca3af)]"}`} aria-hidden="true" />
                      {online ? "Onlayn" : agent.lastSeenAt ? `Oxirgi aloqa: ${formatDateTime(agent.lastSeenAt)}` : "Hali ulanmagan"}
                    </span>
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setRevoking(agent)}
                      className="shrink-0 cursor-pointer text-[13px] font-medium text-[var(--color-danger)]"
                    >
                      Uzish
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      <Modal open={!!pairing} onClose={() => setPairing(null)} title="Agentni ulash">
        <div className="space-y-4 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          <p>Bog&apos;chadagi kompyuterda, hik-agent papkasida quyidagini ishga tushiring va kodni kiriting:</p>
          <pre className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)]">
            npm run pair
          </pre>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-hair)] py-4 text-center">
            <div className="select-all font-mono text-[30px] font-bold tracking-[0.18em] text-[var(--color-text)]">{pairing?.code}</div>
            <div className="mt-1 text-[12.5px]">
              Bir marta ishlaydi, {pairing ? formatDateTime(pairing.expiresAt) : ""} gacha amal qiladi
            </div>
          </div>
          <p>Ulangach agentni ishga tushiring (npm start yoki pm2) — shu filialdagi qurilmalar o&apos;zi ulanadi.</p>
          <div className="flex justify-end">
            <Button onClick={() => setPairing(null)}>Tayyor</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Agentni uzish"
        description={
          <>
            <strong>{revoking?.name}</strong> agenti uziladi va qurilmalarga xizmat qilmay qo&apos;yadi. Qayta ulash uchun yangi kod
            kerak bo&apos;ladi.
          </>
        }
        confirmLabel="Uzish"
        tone="danger"
        loading={revokeMutation.isPending}
        error={revokeMutation.error instanceof ApiError ? revokeMutation.error.message : null}
        onConfirm={() => revoking && revokeMutation.mutate(revoking.id)}
      />
    </Card>
  );
}
