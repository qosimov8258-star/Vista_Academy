"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useFeatureEnabled } from "@/lib/use-auth";
import { useRouteFeatureOn } from "@/lib/feature-routes";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { BoardTiles } from "./board-tiles";
import { CallsList } from "./calls-list";
import { todayTashkent, type BoardResult } from "./shared";
import { useTr } from "@/i18n/tr";

const ACTIONS = [
  { label: "Bola qabul qilish", suffix: "children" },
  { label: "Arizalar (CRM)", suffix: "crm" },
  { label: "Ommaviy xabar", suffix: "notifications" },
  { label: "Guruhlar", suffix: "groups" },
  { label: "Haftalik hisobot", suffix: "weekly-report" },
];

/**
 * Administratorning (MANAGER) bosh sahifasi: bugungi holat, qo'ng'iroq ro'yxati
 * va tez amallar. Filial admini o'z sahifasini ko'radi (BranchAdminHome).
 */
export function AdminHome({ slug }: { slug: string }) {
  const tr = useTr();
  const date = todayTashkent();
  const isOn = useFeatureEnabled();
  const routeOn = useRouteFeatureOn();
  // Qo'ng'iroqlar «Olib ketish va qo'ng'iroqlar» funksiyasiga kiradi — o'chirilgan bo'lsa ro'yxat yo'q
  const callsOn = isOn("pickups");
  // O'chirilgan bo'limlarga tez o'tish ko'rsatilmaydi
  const actions = ACTIONS.filter((a) => routeOn(`/${slug}/${a.suffix}`));
  const board = useQuery({
    queryKey: ["desk-board", slug, date],
    queryFn: () => api.get<BoardResult>(`/app/desk/board?date=${date}`),
    refetchInterval: 60_000,
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

      {callsOn && (
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

      {actions.length > 0 && (
      <section>
        <h2 className="mb-2 text-[15px] font-semibold text-[var(--color-text)]">{tr("Tez amallar")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {actions.map((a) => (
            <Link key={a.suffix} href={`/${slug}/${a.suffix}`}>
              <Card className="px-3 py-4 text-center text-[13.5px] font-medium text-[var(--color-text)] transition-shadow hover:shadow-[var(--shadow-raised)]">
                {tr(a.label)}
              </Card>
            </Link>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}
