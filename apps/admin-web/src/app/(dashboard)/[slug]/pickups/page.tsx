"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { RELATION_LABEL, todayTashkent, type PickupChild } from "@/features/desk/shared";

export default function PickupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [otherFor, setOtherFor] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDate((d) => d || todayTashkent()), []);

  const query = useQuery({
    queryKey: ["desk-pickups", slug, date],
    queryFn: () => api.get<{ date: string; children: PickupChild[]; remaining: number }>(`/app/desk/pickups?date=${date}`),
    enabled: !!date,
    refetchInterval: 60_000,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["desk-pickups", slug] });
    queryClient.invalidateQueries({ queryKey: ["desk-board", slug] });
  };
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");

  const mark = useMutation({
    mutationFn: (v: { childId: string; guardianId?: string; pickedByName?: string }) => api.post("/app/desk/pickups", { ...v, date }),
    onSuccess: () => {
      setError(null);
      setOtherFor(null);
      setOtherName("");
      refresh();
    },
    onError: fail,
  });
  const undo = useMutation({
    mutationFn: (childId: string) => api.delete(`/app/desk/pickups?childId=${childId}&date=${date}`),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: fail,
  });

  const children = query.data?.children ?? [];
  // Hali olib ketilmaganlar tepada
  const sorted = [...children].sort((a, b) => Number(!!a.pickup) - Number(!!b.pickup) || a.childName.localeCompare(b.childName));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Olib ketish</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            Bolani kim olib ketganini belgilang{query.data ? ` · hali bog'chada: ${query.data.remaining}` : ""}
          </p>
        </div>
        <div className="w-[180px]">
          <Input label="Sana" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error && <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>}

      {!date || query.isLoading ? (
        <LoadingState rows={5} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : sorted.length === 0 ? (
        <Card>
          <EmptyState title="Bugun kelgan bola yo'q (avval davomat belgilanishi kerak)" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {sorted.map((c) => (
              <li key={c.childId} className="space-y-2 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-medium text-[var(--color-text)]">{c.childName}</p>
                    {c.groupName && <p className="text-[12.5px] text-[var(--color-text-muted)]">{c.groupName}</p>}
                  </div>
                  {c.pickup ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="success">
                        Olib ketdi: {c.pickup.pickedByName}
                        {c.pickup.relation ? ` (${RELATION_LABEL[c.pickup.relation] ?? c.pickup.relation})` : ""} ·{" "}
                        {new Date(c.pickup.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" })}
                      </Badge>
                      <Button size="sm" variant="outline" loading={undo.isPending && undo.variables === c.childId} onClick={() => undo.mutate(c.childId)}>
                        Qaytarish
                      </Button>
                    </div>
                  ) : (
                    <Badge tone="warning">Bog&apos;chada</Badge>
                  )}
                </div>
                {!c.pickup && (
                  <div className="flex flex-wrap items-center gap-2">
                    {c.guardians.filter((g) => g.canPickup).map((g) => (
                      <Button
                        key={g.id}
                        size="sm"
                        variant="outline"
                        loading={mark.isPending && mark.variables?.guardianId === g.id && mark.variables?.childId === c.childId}
                        onClick={() => mark.mutate({ childId: c.childId, guardianId: g.id })}
                      >
                        {RELATION_LABEL[g.relation] ?? g.relation}: {g.fullName}
                      </Button>
                    ))}
                    {c.guardians.filter((g) => g.canPickup).length === 0 && (
                      <span className="text-[12.5px] text-[var(--color-danger)]">Olib ketishga ruxsat etilgan ota-ona yo&apos;q</span>
                    )}
                    {otherFor === c.childId ? (
                      <>
                        <Input placeholder="Kim olib ketdi (ism)" value={otherName} onChange={(e) => setOtherName(e.target.value)} className="w-[200px]" />
                        <Button size="sm" disabled={otherName.trim().length < 2} loading={mark.isPending && mark.variables?.pickedByName === otherName.trim()} onClick={() => mark.mutate({ childId: c.childId, pickedByName: otherName.trim() })}>
                          Saqlash
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setOtherFor(null)}>
                          Bekor
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { setOtherFor(c.childId); setOtherName(""); }}>
                        Boshqa odam
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
