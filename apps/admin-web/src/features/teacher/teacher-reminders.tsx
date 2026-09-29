"use client";

import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { canWriteTeaching } from "@/lib/permissions";
import { CheckIcon } from "@/components/ui/icons";
import type { ChildReminder } from "@/features/child-notes/child-note-modal";
import { Group } from "./teacher-ui";

/**
 * Bugungi eslatmalar (dori vaqti va h.k.) — tarbiyachi kabinetining iOS
 * ro'yxati ko'rinishida. `TodayRemindersCard` bilan bir xil so'rov va
 * kalitlar: bir joyda belgilansa, ikkinchisida ham yangilanadi.
 * Eslatma bo'lmasa hech narsa chizilmaydi.
 */
export function TeacherReminders({ slug, branchId, date }: { slug: string; branchId: string; date: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canMark = canWriteTeaching(user?.role);

  const query = useQuery({
    queryKey: ["today-reminders", slug, branchId, date],
    queryFn: () => api.get<ChildReminder[]>(`/app/reminders?date=${date}&branchId=${branchId}`),
    refetchInterval: 60_000,
  });
  const doneMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.post(`/app/reminders/${id}/done`, { done }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-reminders", slug] });
      queryClient.invalidateQueries({ queryKey: ["child-reminders", slug] });
    },
  });

  const reminders = [...(query.data ?? [])].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  if (!reminders.length) return null;
  const pending = reminders.filter((r) => !r.doneAt).length;

  return (
    <Group title="Bugungi eslatmalar" action={pending > 0 ? <span className="text-[13px] font-semibold text-[var(--color-warning)]">{pending} ta kutilmoqda</span> : undefined}>
      {reminders.map((r, i) => {
        const done = !!r.doneAt;
        const busy = doneMutation.isPending && doneMutation.variables?.id === r.id;
        return (
          <div key={r.id} className="relative flex items-start gap-3.5 px-4 py-3">
            {i > 0 && <span className="absolute left-[58px] right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
            {/* iOS Eslatmalar ilovasidagidek dumaloq belgi — bosilsa "berildi" */}
            <button
              type="button"
              disabled={!canMark || busy}
              onClick={() => doneMutation.mutate({ id: r.id, done: !done })}
              aria-label={done ? `${r.childName}: bekor qilish` : `${r.childName}: berildi deb belgilash`}
              aria-pressed={done}
              className={clsx(
                "mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200 active:scale-90 disabled:cursor-default",
                canMark && "cursor-pointer",
                done ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[#c4c4c7] text-transparent",
                busy && "opacity-50",
              )}
            >
              <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className={clsx("text-[16px] font-medium", done ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]")}>
                  {r.childName}
                </span>
                {r.time && <span className="ml-auto shrink-0 text-[14px] font-semibold tabular-nums text-[var(--color-primary)]">{r.time}</span>}
              </p>
              <p className={clsx("mt-0.5 text-[14.5px] leading-snug", done ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]")}>{r.text}</p>
              <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                {done
                  ? `Berildi ${new Date(r.doneAt!).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}${r.doneByName ? ` · ${r.doneByName}` : ""}`
                  : `Yozdi: ${r.authorName}`}
              </p>
            </div>
          </div>
        );
      })}
    </Group>
  );
}
