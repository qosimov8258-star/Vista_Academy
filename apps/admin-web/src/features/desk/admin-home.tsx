"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { BoardTiles } from "./board-tiles";
import { CallsList } from "./calls-list";
import { todayTashkent, type BoardResult, type WeeklyResult } from "./shared";
import { useTr } from "@/i18n/tr";

const ACTIONS = [
  { label: "Bola qabul qilish", suffix: "children" },
  { label: "Arizalar (CRM)", suffix: "crm" },
  { label: "Ommaviy xabar", suffix: "notifications" },
  { label: "Guruhlar", suffix: "groups" },
  { label: "Haftalik hisobot", suffix: "weekly-report" },
];

/** Administratorning bosh sahifasi: bugungi holat, qo'ng'iroq ro'yxati va tez amallar. */
export function AdminHome({ slug, showCalls = true }: { slug: string; showCalls?: boolean }) {
  const tr = useTr();
  const date = todayTashkent();
  const board = useQuery({
    queryKey: ["desk-board", slug, date],
    queryFn: () => api.get<BoardResult>(`/app/desk/board?date=${date}`),
    refetchInterval: 60_000,
  });
  // Filial admini uchun: bugun guruhlar kesimida (guruh, tarbiyachi, davomat) va yangi arizalar
  const weekly = useQuery({
    queryKey: ["desk-weekly", slug, date],
    queryFn: () => api.get<WeeklyResult>(`/app/desk/weekly?from=${date}`),
    enabled: !showCalls,
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Bugungi holat")}</h2>
          <Link href={`/${slug}/board`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
            {tr("Batafsil")}
          </Link>
        </div>
        {board.isLoading ? <LoadingState rows={1} /> : board.data ? <BoardTiles board={board.data} /> : null}
      </section>

      {showCalls && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Bugun qo'ng'iroq qilish")}</h2>
            <Link href={`/${slug}/calls`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
              {tr("Hammasi")}
            </Link>
          </div>
          <CallsList slug={slug} limit={6} />
        </section>
      )}

      {showCalls ? (
        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-[var(--color-text)]">{tr("Tez amallar")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {ACTIONS.map((a) => (
              <Link key={a.suffix} href={`/${slug}/${a.suffix}`}>
                <Card className="px-3 py-4 text-center text-[13.5px] font-medium text-[var(--color-text)] transition-shadow hover:shadow-[var(--shadow-raised)]">
                  {tr(a.label)}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Bugun guruhlar bo'yicha")}</h2>
              <Link href={`/${slug}/groups`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
                {tr("Guruhlar")}
              </Link>
            </div>
            {weekly.isLoading ? (
              <LoadingState rows={2} />
            ) : weekly.data && weekly.data.groups.length > 0 ? (
              <Card className="divide-y divide-[var(--color-separator)] overflow-hidden">
                {weekly.data.groups.map((g) => {
                  const today = g.daily.find((d) => d.date === date) ?? g.daily[0];
                  return (
                    <Link key={g.id} href={`/${slug}/groups/${g.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface-hover)]">
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-medium text-[var(--color-text)]">{tr(g.name)}</p>
                        <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                          {tr("{0} ta bola", g.childrenCount)} ·{" "}
                          {g.teachers.length > 0 ? g.teachers.join(", ") : tr("Tarbiyachi biriktirilmagan")}
                        </p>
                      </div>
                      <span className="flex shrink-0 gap-2.5 text-[12.5px] tabular-nums text-[var(--color-text-muted)]">
                        <span>{tr("Keldi")} <b className="text-[var(--color-text)]">{today?.present ?? 0}</b></span>
                        <span>{tr("Kelmadi")} <b className="text-[var(--color-text)]">{today?.absent ?? 0}</b></span>
                      </span>
                    </Link>
                  );
                })}
              </Card>
            ) : (
              <p className="text-[13px] text-[var(--color-text-muted)]">{tr("Guruh yo'q")}</p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-[var(--color-text)]">{tr("Yangi arizalar")}</h2>
            <Link href={`/${slug}/crm`}>
              <Card className="flex items-center justify-between px-4 py-3.5 transition-shadow hover:shadow-[var(--shadow-raised)]">
                <div>
                  <p className="text-[22px] font-semibold tabular-nums text-[var(--color-text)]">{weekly.data?.newLeads ?? "—"}</p>
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr("shu hafta landing sahifadan kelgan")}</p>
                </div>
                <span className="text-[13px] font-medium text-[var(--color-primary)]">{tr("Arizalar (CRM)")}</span>
              </Card>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
