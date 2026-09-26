"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChildAllergy, DashboardSummary, MenuEntry } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { todayTashkent } from "@/features/desk/shared";

interface GroupRow {
  groupId: string | null;
  name: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  sick: number;
  notMarked: number;
}

interface TodaySummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  sick: number;
  notMarked: number;
  mealCount: number;
  groups: GroupRow[];
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "warning" }) {
  const color =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "danger"
        ? "text-[var(--color-danger)]"
        : tone === "warning"
          ? "text-[var(--color-warning)]"
          : "text-[var(--color-text)]";
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[12.5px] leading-tight text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-[24px] font-semibold leading-none tabular-nums ${color}`}>{value}</p>
    </Card>
  );
}

/**
 * Oshpaz uchun bosh sahifa: butun bog'chadagi bolalar soni, bugun nechtasi
 * kelgani va nechta bolaga ovqat tayyorlash kerakligi. Tarbiyachilar davomat
 * belgilagan sari raqamlar o'zi yangilanadi (har 15 soniyada so'raladi).
 * Bugungi menyu va allergiyasi bor bolalar ham shu yerda ko'rinadi.
 */
export function ChefHome({ slug }: { slug: string }) {
  const { user } = useAuth();
  const branchId = user?.branchId ?? "";
  const today = todayTashkent();

  const todayQuery = useQuery({
    queryKey: ["menu-today-summary", slug, branchId, today],
    queryFn: () => api.get<TodaySummary>(`/app/menu/today-summary?branchId=${branchId}&date=${today}`),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", slug],
    queryFn: () => api.get<DashboardSummary>("/app/dashboard/summary"),
    refetchInterval: 60_000,
  });

  const menuQuery = useQuery({
    queryKey: ["menu", slug, branchId, today, "chef-home"],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${today}&to=${today}`),
    enabled: !!branchId,
    refetchInterval: 60_000,
  });
  const allergiesQuery = useQuery({
    queryKey: ["allergies", slug, branchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies?branchId=${branchId}`),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });
  const menu = menuQuery.data?.find((e) => e.date.slice(0, 10) === today) ?? null;
  const allergies = allergiesQuery.data ?? [];

  if (todayQuery.isLoading) return <LoadingState rows={3} />;
  if (todayQuery.isError) return <ErrorState message={(todayQuery.error as Error).message} />;
  const d = todayQuery.data;
  if (!d) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="py-5">
          <p className="text-[36px] font-semibold leading-none tabular-nums text-[var(--color-text)]">{d.mealCount}</p>
          <p className="mt-1.5 text-[14px] text-[var(--color-text-muted)]">ta bolaga ovqat tayyorlanadi (kelgan + kechikkan)</p>
          {d.notMarked > 0 && (
            <p className="mt-3 rounded-lg bg-[var(--color-warning-bg)] px-3 py-2 text-[13px] text-[var(--color-warning)]">
              {d.notMarked} ta bolaning davomati hali belgilanmagan — raqam o&apos;zgarishi mumkin.
            </p>
          )}
        </CardBody>
      </Card>

      {allergies.length > 0 && (
        <Card className="border-[var(--color-warning)]/40">
          <CardHeader>
            <CardTitle>Allergiyasi bor bolalar ({allergies.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[var(--color-separator)] text-[14px]">
              {allergies.map((a) => (
                <li key={a.child.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium text-[var(--color-text)]">{a.child.fullName}</span>
                    <span className="block text-[12.5px] text-[var(--color-text-muted)]">
                      {a.child.group?.name ?? "Guruhsiz"}
                    </span>
                  </span>
                  <span className="font-medium text-[var(--color-danger)]">{a.allergies}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bugungi menyu</CardTitle>
        </CardHeader>
        <CardBody>
          {menuQuery.isLoading ? (
            <LoadingState rows={1} />
          ) : menu && (menu.breakfast || menu.lunch || menu.snack) ? (
            <dl className="space-y-2.5 text-[14px]">
              {[
                ["Nonushta", menu.breakfast],
                ["Tushlik", menu.lunch],
                ["Kechki ovqat / gazak", menu.snack],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <dt className="w-[150px] shrink-0 text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="min-w-0 flex-1 font-medium text-[var(--color-text)]">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[14px] text-[var(--color-text-muted)]">Bugun uchun menyu kiritilmagan.</p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Jami bolalar" value={d.total} />
        <Tile label="Kelgan" value={d.present} tone="success" />
        <Tile label="Kechikkan" value={d.late} tone="warning" />
        <Tile label="Kelmagan" value={d.absent} tone="danger" />
        <Tile label="Kasal" value={d.sick} />
        <Tile label="Belgilanmagan" value={d.notMarked} />
        <Tile label="Guruhlar soni" value={d.groups.length} />
        <Tile label="Xodimlar soni" value={summaryQuery.data?.employeesCount ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guruhlar bo&apos;yicha</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-[var(--color-separator)] text-[14px]">
            {d.groups.map((g) => (
              <li key={g.groupId ?? "none"} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span className="font-medium text-[var(--color-text)]">{g.name}</span>
                <span className="tabular-nums text-[var(--color-text-muted)]">
                  Kelgan <b className="text-[var(--color-text)]">{g.present + g.late}</b> / {g.total}
                  {g.absent > 0 && <> · Kelmagan <b className="text-[var(--color-danger)]">{g.absent}</b></>}
                  {g.notMarked === g.total && g.total > 0 ? " · davomat qilinmagan" : ""}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
