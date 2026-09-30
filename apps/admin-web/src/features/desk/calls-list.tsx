"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PhoneIcon } from "@/components/ui/icons";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { CALL_KIND_LABEL, RELATION_LABEL, todayTashkent, type CallItem, type CallKind, type CallsResult } from "./shared";

/** Kartaning chap chizig'i: qo'ng'iroq turini bir qarashda ajratish uchun */
const KIND_BAR: Record<CallKind, string> = {
  DEBT: "border-l-[var(--color-danger)]",
  ABSENT: "border-l-[var(--color-warning)]",
  LEAD: "border-l-[var(--accent-soft-icon)]",
};

const KIND_TONE: Record<CallKind, "danger" | "warning" | "info"> = { DEBT: "danger", ABSENT: "warning", LEAD: "info" };

/** Ota-ona telefonni olmasa — "qo'ng'iroq qildim" o'rniga shu yozuv saqlanadi. */
const NO_ANSWER_NOTE = "Aloqa qila olmadim — telefonni olmadi";
const isNoAnswer = (note: string | null) => !!note && note.startsWith("Aloqa qila olmadim");

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
    mutationFn: ({ item, noAnswer }: { item: CallItem; noAnswer?: boolean }) =>
      api.post("/app/desk/calls/done", {
        kind: item.kind,
        subjectId: item.subjectId,
        date,
        note: noAnswer ? NO_ANSWER_NOTE : note.trim() || undefined,
      }),
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
        <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.subjectId}`}
                className={`flex flex-col gap-3 rounded-[20px] border border-l-4 border-[var(--color-border-hair)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:px-5 ${KIND_BAR[item.kind]} ${item.done ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">
                    {item.title}
                    <Badge tone={KIND_TONE[item.kind]}>{CALL_KIND_LABEL[item.kind]}</Badge>
                    {item.badge && <Badge tone="danger">{item.badge}</Badge>}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{item.subtitle}</p>
                  <div className="mt-2.5 flex flex-col items-start gap-2">
                    {(item.contacts && item.contacts.length > 0
                      ? item.contacts
                      : item.phone
                        ? [{ name: item.contactName, relation: null, phone: item.phone }]
                        : []
                    ).map((c, i) => (
                      <div key={`${c.phone}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--color-text)]">
                        <span>
                          {c.relation ? `${RELATION_LABEL[c.relation] ?? c.relation}` : ""}
                          {c.relation && c.name ? " · " : ""}
                          {c.name ?? ""}
                        </span>
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-[15px] font-semibold tabular-nums text-[var(--accent-soft-ink)] transition-colors hover:bg-[var(--accent-soft-icon)]/15 active:scale-[0.98]"
                          >
                            <PhoneIcon className="h-4 w-4 text-[var(--accent-soft-icon)]" />
                            {c.phone}
                          </a>
                        )}
                      </div>
                    ))}
                    {!item.phone && !(item.contacts && item.contacts.length > 0) && (
                      <span className="text-[13px] text-[var(--color-warning)]">Ota-ona raqami kiritilmagan</span>
                    )}
                  </div>
                  {item.done && (
                    <p className={`text-[12.5px] ${isNoAnswer(item.doneNote) ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}`}>
                      {isNoAnswer(item.doneNote) ? "Aloqa bo'lmadi" : "Qo'ng'iroq qilindi"}
                      {item.calledByName ? ` · ${item.calledByName}` : ""}
                      {item.doneNote && !isNoAnswer(item.doneNote) ? ` · ${item.doneNote}` : ""}
                    </p>
                  )}
                </div>
                {item.done ? (
                  <Button size="sm" variant="outline" loading={undo.isPending && undo.variables?.subjectId === item.subjectId} onClick={() => undo.mutate(item)}>
                    Qaytarish
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button size="sm" onClick={() => { setTarget(item); setNote(""); }}>
                      Qo&apos;ng&apos;iroq qildim
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={done.isPending && done.variables?.noAnswer && done.variables.item.subjectId === item.subjectId}
                      onClick={() => done.mutate({ item, noAnswer: true })}
                    >
                      Aloqa qila olmadim
                    </Button>
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? `${target.title} — qo'ng'iroq natijasi` : ""}>
        <div className="space-y-4">
          <Input label="Izoh (ixtiyoriy)" placeholder="Masalan: ertaga to'laydi" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>
              Bekor qilish
            </Button>
            <Button loading={done.isPending} onClick={() => target && done.mutate({ item: target })}>
              Saqlash
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
