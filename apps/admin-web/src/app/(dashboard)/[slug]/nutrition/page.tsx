"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MenuEntry, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate } from "@/lib/format";
import { useBranchContext } from "@/lib/use-branch-context";
import { EditMenuModal } from "@/features/nutrition/edit-menu-modal";
import { canWriteOperational } from "@/lib/permissions";

const DEFAULT_TIMEZONE = "Asia/Tashkent";
const DAY_MS = 24 * 60 * 60 * 1000;

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function mondayOf(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getTime() + diff * DAY_MS).toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number): string {
  return new Date(new Date(`${dateString}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export default function NutritionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date text below.
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);

  useEffect(() => {
    setWeekStart((current) => current ?? mondayOf(todayDateString()));
  }, []);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });
  const branches = orgQuery.data?.branches ?? [];

  useEffect(() => {
    if (forcedBranchId) {
      setBranchId(forcedBranchId);
      return;
    }
    if (!branchId && branches.length > 0) {
      setBranchId(branches[0].id);
    }
  }, [forcedBranchId, branchId, branches]);

  const weekEnd = weekStart ? addDays(weekStart, 6) : null;
  const days = useMemo(() => (weekStart ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : []), [weekStart]);

  const menuQuery = useQuery({
    queryKey: ["menu", slug, branchId, weekStart],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${weekStart}&to=${weekEnd}`),
    enabled: !!branchId && !!weekStart,
  });

  const entryByDate = new Map((menuQuery.data ?? []).map((e) => [e.date.slice(0, 10), e]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Ovqatlanish</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Haftalik menyu</p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          {!forcedBranchId && branches.length > 1 && (
            <Select label="Filial" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="sm:max-w-xs">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!weekStart}
            onClick={() => setWeekStart((w) => (w ? addDays(w, -7) : w))}
          >
            ← Oldingi hafta
          </Button>
          <span className="text-sm text-[var(--color-text-muted)]">
            {weekStart && weekEnd ? `${formatDate(weekStart)} — ${formatDate(weekEnd)}` : "…"}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!weekStart}
            onClick={() => setWeekStart((w) => (w ? addDays(w, 7) : w))}
          >
            Keyingi hafta →
          </Button>
        </div>
      </Card>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {!weekStart || !branchId ? (
        weekStart ? <EmptyState title="Filial mavjud emas" /> : <LoadingState />
      ) : menuQuery.isLoading ? (
        <LoadingState />
      ) : menuQuery.isError ? (
        <ErrorState message={(menuQuery.error as Error).message} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Sana</th>
                  <th className="px-5 py-3 font-medium">Nonushta</th>
                  <th className="px-5 py-3 font-medium">Tushlik</th>
                  <th className="px-5 py-3 font-medium">Kechki ovqat / gazak</th>
                  {canWrite && <th className="px-5 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {days.map((day) => {
                  const entry = entryByDate.get(day) ?? null;
                  return (
                    <tr key={day} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{formatDate(day)}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{entry?.breakfast || "—"}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{entry?.lunch || "—"}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{entry?.snack || "—"}</td>
                      {canWrite && (
                        <td className="px-5 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => setEditDate(day)}>
                            Tahrirlash
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canWrite && editDate && (
        <EditMenuModal
          open={!!editDate}
          onClose={() => setEditDate(null)}
          slug={slug}
          date={editDate}
          entry={entryByDate.get(editDate) ?? null}
        />
      )}
    </div>
  );
}
