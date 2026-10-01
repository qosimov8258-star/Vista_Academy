"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

/** Ommaviy xabar: butun filial yoki bitta guruh ota-onalariga (jurnalga yoziladi). */
export function BroadcastModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const groups = useQuery({ queryKey: ["groups", slug], queryFn: () => api.get<Group[]>("/app/groups"), enabled: open });

  const send = useMutation({
    mutationFn: () => api.post<{ recipients: number; skipped: number }>("/app/desk/broadcast", { groupId: groupId || undefined, message: message.trim() }),
    onSuccess: (res) => {
      setError(null);
      setResult(tr("{0} ta ota-onaga yozildi{1}", res.recipients, res.skipped > 0 ? tr(" ({0} tasida telefon yoki ruxsat yo'q)", res.skipped) : ""));
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["notifications", slug] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const close = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={tr("Ommaviy xabar")}>
      <div className="space-y-4">
        {error && <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{tr(error)}</div>}
        {result && <div className="rounded-lg bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]">{tr(result)}</div>}
        <Select label={tr("Kimga")} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">{tr("Butun filial (hamma ota-ona)")}</option>
          {groups.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {tr(g.name)} {tr("guruhi")}
            </option>
          ))}
        </Select>
        <Textarea label={tr("Xabar")} rows={4} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={tr("Masalan: Ertaga bog'cha dam olish kuni.")} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            {tr("Yopish")}
          </Button>
          <Button loading={send.isPending} disabled={message.trim().length < 3} onClick={() => { setResult(null); setError(null); send.mutate(); }}>
            {tr("Yuborish")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
