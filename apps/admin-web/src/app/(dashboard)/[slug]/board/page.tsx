"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { BoardTiles } from "@/features/desk/board-tiles";
import { todayTashkent, type BoardResult } from "@/features/desk/shared";

const STAFF_LABEL = { ABSENT: "Kelmadi", SICK: "Kasal", ON_LEAVE: "Ta'til" } as const;

export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [date, setDate] = useState("");
  useEffect(() => setDate((d) => d || todayTashkent()), []);
  const query = useQuery({
    queryKey: ["desk-board", slug, date],
    queryFn: () => api.get<BoardResult>(`/app/desk/board?date=${date}`),
    enabled: !!date,
    refetchInterval: 60_000,
  });
  const board = query.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Bugungi holat</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Bog&apos;cha hozir qanday: kim keldi, kim ketdi</p>
        </div>
        <div className="w-[180px]">
          <Input label="Sana" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {!date || query.isLoading ? (
        <LoadingState rows={4} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : board ? (
        <>
          <BoardTiles board={board} />
          <Card>
            <CardHeader>
              <CardTitle>Guruhlar bo&apos;yicha</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                {board.groups.map((g) => (
                  <li key={g.groupId ?? "none"} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums text-[var(--color-text-muted)]">
                      <span>Keldi <b className="text-[var(--color-success)]">{g.present}</b>/{g.total}</span>
                      <span>Kelmadi <b className="text-[var(--color-danger)]">{g.absent}</b></span>
                      <span>Kasal <b className="text-[var(--color-warning)]">{g.sick}</b></span>
                      {g.notMarked > 0 && <span>Belgilanmagan <b>{g.notMarked}</b></span>}
                      <span>Olib ketildi <b className="text-[var(--color-text)]">{g.pickedUp}</b></span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Kelmagan xodimlar</CardTitle>
            </CardHeader>
            <CardBody>
              {board.staffAway.length === 0 ? (
                <p className="text-[14px] text-[var(--color-text-muted)]">Hamma xodim ishda</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {board.staffAway.map((s) => (
                    <li key={s.fullName} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="font-medium">{s.fullName}</span>
                        <span className="ml-2 text-[12.5px] text-[var(--color-text-muted)]">{s.position}</span>
                      </span>
                      <Badge tone={s.status === "ABSENT" ? "danger" : s.status === "SICK" ? "warning" : "neutral"}>{STAFF_LABEL[s.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
