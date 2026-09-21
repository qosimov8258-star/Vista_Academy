"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { CALL_KIND_LABEL, todayTashkent, type CallItem, type CallKind, type CallsResult } from "./shared";

const KIND_TONE: Record<CallKind, "danger" | "warning" | "info"> = { DEBT: "danger", ABSENT: "warning", LEAD: "info" };

/** Bugun qo'ng'iroq qilish ro'yxati. `limit` berilsa faqat tepadagi ochiq qo'ng'iroqlar ko'rsatiladi (bosh sahifa uchun). */
export function CallsList({ slug, limit, filter }: { slug: string; limit?: number; filter?: CallKind | "ALL" }) {
  const queryClient = useQueryClient();
  const date = todayTashkent();
  const [target, setTarget] = useState<CallItem | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["desk-calls", slug, date],
    queryFn: () => api.get<CallsResult>(`/app/desk/calls?date=${date}`),
    refetchInterval: 60_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["desk-calls", slug] });
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");

  const done = useMutation({
    mutationFn: (item: CallItem) => api.post("/app/desk/calls/done", { kind: item.kind, subjectId: item.subjectId, date, note: note.trim() || undefined }),
    onSuccess: () => {
      setTarget(null);
      setNote("");
      setError(null);
      refresh();
    },
    onError: fail,
  });
  const undo = useMutation({
    mutationFn: (item: CallItem) => api.post("/app/desk/calls/undo", { kind: item.kind, subjectId: item.subjectId, date }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: fail,
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  let items = (query.data?.items ?? []).filter((i) => !filter || filter === "ALL" || i.kind === filter);
  if (limit) items = items.filter((i) => !i.done).slice(0, limit);
  // Ochiq qo'ng'iroqlar tepada, qilinganlari pastda
  items = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <>
      {error && <div className="mb-3 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>}
      {items.length === 0 ? (
        <Card>
          <EmptyState title={limit ? "Bugun qo'ng'iroq qilish kerak emas" : "Ro'yxat bo'sh"} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {items.map((item) => (
              <li key={`${item.kind}-${item.subjectId}`} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${item.done ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-[var(--color-text)]">
                    {item.title}
                    <Badge tone={KIND_TONE[item.kind]}>{CALL_KIND_LABEL[item.kind]}</Badge>
                    {item.badge && <Badge tone="danger">{item.badge}</Badge>}
                  </p>
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">{item.subtitle}</p>
                  <p className="text-[13px]">
                    {item.contactName ?? "—"}
                    {item.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${item.phone}`} className="font-medium text-[var(--color-primary)] hover:underline">
                          {item.phone}
                        </a>
                      </>
                    )}
                  </p>
                  {item.done && (
                    <p className="text-[12.5px] text-[var(--color-success)]">
                      Qo&apos;ng&apos;iroq qilindi{item.calledByName ? ` · ${item.calledByName}` : ""}
                      {item.doneNote ? ` · ${item.doneNote}` : ""}
                    </p>
                  )}
                </div>
                {item.done ? (
                  <Button size="sm" variant="outline" loading={undo.isPending && undo.variables?.subjectId === item.subjectId} onClick={() => undo.mutate(item)}>
                    Qaytarish
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => { setTarget(item); setNote(""); }}>
                    Qo&apos;ng&apos;iroq qildim
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? `${target.title} — qo'ng'iroq natijasi` : ""}>
        <div className="space-y-4">
          <Input label="Izoh (ixtiyoriy)" placeholder="Masalan: ertaga to'laydi" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>
              Bekor qilish
            </Button>
            <Button loading={done.isPending} onClick={() => target && done.mutate(target)}>
              Saqlash
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
