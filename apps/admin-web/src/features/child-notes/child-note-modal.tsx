"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ChildReminder {
  id: string;
  childId: string;
  childName: string;
  groupName: string | null;
  date: string;
  time: string | null;
  text: string;
  authorName: string;
  doneAt: string | null;
  doneByName: string | null;
}

interface DailyReportRow {
  date: string;
  activityNotes: string | null;
}

interface HealthProfile {
  allergies: string | null;
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi";
}

/**
 * Tarbiyachining bola haqidagi uchta yozuvi: ota-onaga kun xabari, bugungi
 * eslatma (masalan dori vaqti) va allergiya. Eslatma va allergiya boshqa
 * panellarda ham ko'rinadi.
 */
export function ChildNoteModal({
  open,
  onClose,
  slug,
  branchId,
  childId,
  childName,
  date,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string;
  childId: string;
  childName: string;
  date: string;
}) {
  const queryClient = useQueryClient();
  const [dayNote, setDayNote] = useState("");
  const [allergies, setAllergies] = useState("");
  const [time, setTime] = useState("");
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["child-daily-reports", slug, childId],
    queryFn: () => api.get<DailyReportRow[]>(`/app/children/${childId}/daily-reports`),
    enabled: open,
  });
  const healthQuery = useQuery({
    queryKey: ["child-health", slug, childId],
    queryFn: () => api.get<HealthProfile | null>(`/app/children/${childId}/health`),
    enabled: open,
  });
  const remindersQuery = useQuery({
    queryKey: ["child-reminders", slug, branchId, date, childId],
    queryFn: () => api.get<ChildReminder[]>(`/app/reminders?date=${date}&branchId=${branchId}&childId=${childId}`),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    setError(null);
    setTime("");
    setText("");
  }, [open, childId]);
  useEffect(() => {
    const today = reportsQuery.data?.find((r) => r.date.slice(0, 10) === date);
    setDayNote(today?.activityNotes ?? "");
  }, [reportsQuery.data, date, childId]);
  useEffect(() => {
    setAllergies(healthQuery.data?.allergies ?? "");
  }, [healthQuery.data, childId]);

  const invalidateReminders = () => {
    queryClient.invalidateQueries({ queryKey: ["child-reminders", slug] });
    queryClient.invalidateQueries({ queryKey: ["today-reminders", slug] });
  };

  const doneReminder = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.post(`/app/reminders/${id}/done`, { done }),
    onSuccess: invalidateReminders,
    onError: (err) => setError(errorText(err)),
  });

  const dayNoteMutation = useMutation({
    mutationFn: () => api.post("/app/daily-reports", { childId, date, activityNotes: dayNote.trim() }),
    onSuccess: () => {
      setMessage("Ota-onaga xabar saqlandi");
      queryClient.invalidateQueries({ queryKey: ["child-daily-reports", slug, childId] });
    },
    onError: (err) => setError(errorText(err)),
  });

  const addReminder = useMutation({
    mutationFn: () => api.post("/app/reminders", { childId, date, time: time || undefined, text: text.trim() }),
    onSuccess: () => {
      setTime("");
      setText("");
      setMessage("Eslatma qo'shildi");
      invalidateReminders();
    },
    onError: (err) => setError(errorText(err)),
  });

  const removeReminder = useMutation({
    mutationFn: (id: string) => api.delete(`/app/reminders/${id}`),
    onSuccess: invalidateReminders,
    onError: (err) => setError(errorText(err)),
  });

  const allergyMutation = useMutation({
    mutationFn: () => api.put(`/app/children/${childId}/allergies`, { allergies: allergies.trim() }),
    onSuccess: () => {
      setMessage("Allergiya saqlandi");
      queryClient.invalidateQueries({ queryKey: ["child-health", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["allergies", slug] });
    },
    onError: (err) => setError(errorText(err)),
  });

  const sectionTitle = "text-[13px] font-semibold text-[var(--color-text)]";

  return (
    <Modal open={open} onClose={onClose} title={childName} widthClassName="max-w-xl">
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
        )}
        {message && !error && (
          <div className="rounded-lg bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]">{message}</div>
        )}

        <section className="space-y-2">
          <p className={sectionTitle}>Ota-onaga xabar (bugun qanday o&apos;tdi)</p>
          <Textarea
            rows={3}
            value={dayNote}
            onChange={(e) => setDayNote(e.target.value)}
            placeholder="Masalan: yaxshi ovqatlandi, 2 soat uxladi, rasm chizdi"
          />
          <div className="flex justify-end">
            <Button size="sm" loading={dayNoteMutation.isPending} disabled={!dayNote.trim()} onClick={() => { setError(null); dayNoteMutation.mutate(); }}>
              Saqlash
            </Button>
          </div>
        </section>

        <section className="space-y-2 border-t border-[var(--color-separator)] pt-4">
          <p className={sectionTitle}>Bugungi eslatma — ota-ona aytgan dori yoki alohida e&apos;tibor (yozgan xodim ismi ko&apos;rinadi)</p>
          {remindersQuery.data && remindersQuery.data.length > 0 && (
            <ul className="divide-y divide-[var(--color-separator)] rounded-lg border border-[var(--color-border)] text-[14px]">
              {remindersQuery.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <span className={r.doneAt ? "text-[var(--color-text-muted)] line-through" : undefined}>
                      {r.time && <b className="mr-2 tabular-nums">{r.time}</b>}
                      {r.text}
                    </span>
                    <span className="block text-[12.5px] text-[var(--color-text-muted)]">
                      Yozdi: {r.authorName}
                      {r.doneAt && ` · Berdi: ${r.doneByName ?? "—"}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant={r.doneAt ? "outline" : "primary"}
                    loading={doneReminder.isPending && doneReminder.variables?.id === r.id}
                    onClick={() => { setError(null); doneReminder.mutate({ id: r.id, done: !r.doneAt }); }}
                  >
                    {r.doneAt ? "Qaytarish" : "Berildi"}
                  </Button>
                  <Button size="sm" variant="danger" loading={removeReminder.isPending && removeReminder.variables === r.id} onClick={() => { setError(null); removeReminder.mutate(r.id); }}>
                    O&apos;chirish
                  </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Vaqt" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[120px]" />
            <Input label="Eslatma" value={text} onChange={(e) => setText(e.target.value)} placeholder="Dori ichishi kerak" className="min-w-[200px] flex-1" />
            <Button size="sm" loading={addReminder.isPending} disabled={text.trim().length < 2} onClick={() => { setError(null); addReminder.mutate(); }}>
              Qo&apos;shish
            </Button>
          </div>
        </section>

        <section className="space-y-2 border-t border-[var(--color-separator)] pt-4">
          <p className={sectionTitle}>Allergiya</p>
          <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="sut, yong'oq (bo'sh — allergiya yo'q)" />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" loading={allergyMutation.isPending} onClick={() => { setError(null); allergyMutation.mutate(); }}>
              Allergiyani saqlash
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
