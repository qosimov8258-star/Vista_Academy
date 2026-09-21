"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { BoardTiles } from "./board-tiles";
import { CallsList } from "./calls-list";
import { todayTashkent, type BoardResult } from "./shared";

const ACTIONS = [
  { label: "Bola qabul qilish", suffix: "children" },
  { label: "Arizalar (CRM)", suffix: "crm" },
  { label: "Olib ketish", suffix: "pickups" },
  { label: "Ommaviy xabar", suffix: "notifications" },
  { label: "Guruhlar", suffix: "groups" },
  { label: "Haftalik hisobot", suffix: "weekly-report" },
];

/** Administratorning bosh sahifasi: bugungi holat, qo'ng'iroq ro'yxati va tez amallar. */
export function AdminHome({ slug }: { slug: string }) {
  const date = todayTashkent();
  const board = useQuery({
    queryKey: ["desk-board", slug, date],
    queryFn: () => api.get<BoardResult>(`/app/desk/board?date=${date}`),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--color-text)]">Bugungi holat</h2>
          <Link href={`/${slug}/board`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
            Batafsil
          </Link>
        </div>
        {board.isLoading ? <LoadingState rows={1} /> : board.data ? <BoardTiles board={board.data} /> : null}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--color-text)]">Bugun qo&apos;ng&apos;iroq qilish</h2>
          <Link href={`/${slug}/calls`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
            Hammasi
          </Link>
        </div>
        <CallsList slug={slug} limit={6} />
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-semibold text-[var(--color-text)]">Tez amallar</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ACTIONS.map((a) => (
            <Link key={a.suffix} href={`/${slug}/${a.suffix}`}>
              <Card className="px-3 py-4 text-center text-[13.5px] font-medium text-[var(--color-text)] transition-shadow hover:shadow-[var(--shadow-raised)]">
                {a.label}
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
