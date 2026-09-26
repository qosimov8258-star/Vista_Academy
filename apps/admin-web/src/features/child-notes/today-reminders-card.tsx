"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { canWriteTeaching } from "@/lib/permissions";
import { isHeadChefPosition } from "@/lib/employee-position";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import type { ChildReminder } from "./child-note-modal";

/** Bugungi eslatmalar (dori vaqti va h.k.) — filial bo'yicha, tarbiyachida faqat o'z guruhi. */
export function TodayRemindersCard({ slug, branchId, today }: { slug: string; branchId: string; today: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Belgini tarbiyachi (yoki admin) qo'yadi; oshpaz faqat ko'radi.
  const canMark = canWriteTeaching(user?.role) && !(user?.position && isHeadChefPosition(user.position));
  const doneMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.post(`/app/reminders/${id}/done`, { done }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-reminders", slug] });
      queryClient.invalidateQueries({ queryKey: ["child-reminders", slug] });
    },
  });
  const query = useQuery({
    queryKey: ["today-reminders", slug, branchId, today],
    queryFn: () => api.get<ChildReminder[]>(`/app/reminders?date=${today}&branchId=${branchId}`),
    refetchInterval: 60_000,
  });

  if (query.isLoading) return <LoadingState rows={2} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  if (!query.data?.length) return null;

  return (
    <Card className="border-[var(--color-warning)]/40">
      <CardHeader>
        <CardTitle>Bugungi eslatmalar</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-[var(--color-border)] text-[14px]">
          {query.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
              <b className="w-12 shrink-0 tabular-nums">{r.time ?? "—"}</b>
              <span className={r.doneAt ? "font-medium text-[var(--color-text-muted)] line-through" : "font-medium"}>{r.childName}</span>
              {r.groupName && <span className="text-[12.5px] text-[var(--color-text-muted)]">{r.groupName}</span>}
              <span className="basis-full text-[var(--color-text)] sm:basis-auto">{r.text}</span>
              <span className="basis-full pl-[60px] text-[12.5px] text-[var(--color-text-muted)]">Yozdi: {r.authorName}</span>
              <span className="flex basis-full flex-wrap items-center gap-2 pl-[60px] sm:ml-auto sm:basis-auto sm:pl-0">
                {r.doneAt && (
                  <Badge tone="success">
                    Berildi {new Date(r.doneAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                    {r.doneByName ? ` · ${r.doneByName}` : ""}
                  </Badge>
                )}
                {canMark && (
                  <Button
                    size="sm"
                    variant={r.doneAt ? "outline" : "primary"}
                    loading={doneMutation.isPending && doneMutation.variables?.id === r.id}
                    onClick={() => doneMutation.mutate({ id: r.id, done: !r.doneAt })}
                  >
                    {r.doneAt ? "Qaytarish" : "Berildi"}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
