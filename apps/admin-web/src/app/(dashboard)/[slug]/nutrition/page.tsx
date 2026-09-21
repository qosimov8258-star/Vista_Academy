"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChildAllergy, MenuEntry, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import { EditMenuModal } from "@/features/nutrition/edit-menu-modal";
import { WeeklyMenuModal } from "@/features/nutrition/weekly-menu-modal";
import { canWriteOperational } from "@/lib/permissions";
import { isHeadChefPosition } from "@/lib/employee-position";
import { TodayRemindersCard } from "@/features/child-notes/today-reminders-card";
import { TodayChildrenCard } from "@/features/nutrition/today-children-card";

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
  // Bosh oshpaz TEACHER roli bilan kiradi, lekin menyu aynan uning ishi.
  const isHeadChef = !!user?.position && isHeadChefPosition(user.position);
  const canWrite = canWriteOperational(user?.role) || isHeadChef;
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date text below.
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [weeklyMenuOpen, setWeeklyMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const allergiesQuery = useQuery({
    queryKey: ["allergies", slug, branchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies?branchId=${branchId}`),
    enabled: !!branchId,
  });

  // Menyu va allergiya ikkalasi ham erkin matn — vergul bilan ajratilgan
  // allergen so'zlarini shu haftaning har bir ovqatida (kichik-katta harf
  // farqisiz) izlaymiz. Aniq bo'lmagan (masalan "sut" so'zi "sutli" ichida
  // ham topiladi) — bu qasddan: xatoni o'tkazib yubormaslik muhimroq.
  const allergyWarnings = useMemo(() => {
    if (!allergiesQuery.data?.length || !menuQuery.data?.length) return [];
    const allergens = allergiesQuery.data.flatMap((item) =>
      item.allergies
        .split(/[,;]/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .map((token) => ({ token, childName: item.child.fullName })),
    );
    if (allergens.length === 0) return [];
    const warnings: { date: string; mealLabel: string; token: string; childName: string }[] = [];
    for (const day of days) {
      const entry = entryByDate.get(day);
      if (!entry) continue;
      const meals: { label: string; text: string | null }[] = [
        { label: "Nonushta", text: entry.breakfast },
        { label: "Tushlik", text: entry.lunch },
        { label: "Kechki ovqat / gazak", text: entry.snack },
      ];
      for (const meal of meals) {
        if (!meal.text) continue;
        const lower = meal.text.toLowerCase();
        for (const { token, childName } of allergens) {
          if (lower.includes(token.toLowerCase())) {
            warnings.push({ date: day, mealLabel: meal.label, token, childName });
          }
        }
      }
    }
    return warnings;
  }, [allergiesQuery.data, menuQuery.data, days, entryByDate]);

  const handleExport = async () => {
    if (!weekStart || !weekEnd) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(
        `/app/exports/menu?from=${weekStart}&to=${weekEnd}&branchId=${branchId}`,
        `menyu-${weekStart}_${weekEnd}.csv`,
      );
    } catch {
      setExportError("Eksport qilib bo'lmadi — qayta urinib ko'ring");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Ovqatlanish
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Haftalik menyu</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button variant="outline" disabled={!weekStart} onClick={() => setWeeklyMenuOpen(true)}>
              Haftalik menyu
            </Button>
          )}
          <Button variant="outline" loading={exporting} disabled={!weekStart} onClick={handleExport}>
            Eksport (CSV)
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {exportError}
        </div>
      )}

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!weekStart}
            onClick={() => setWeekStart((w) => (w ? addDays(w, -7) : w))}
          >
            ← Oldingi hafta
          </Button>
          <span className="whitespace-nowrap text-[14px] tabular-nums text-[var(--color-text-muted)]">
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
        {!forcedBranchId && branches.length > 1 && (
          <div className="sm:ml-auto sm:max-w-xs">
            <Select label="Filial" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {branchId && <TodayChildrenCard slug={slug} branchId={branchId} today={todayDateString()} />}
      {branchId && <TodayRemindersCard slug={slug} branchId={branchId} today={todayDateString()} />}

      {allergyWarnings.length > 0 && (
        <Card className="border-[var(--color-danger)]/40 shadow-[var(--shadow-raised)]">
          <CardHeader>
            <CardTitle className="text-[var(--color-danger)]">
              Diqqat — bu haftaning menyusida allergen bor
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-[14px] text-[var(--color-text)]">
            {allergyWarnings.map((w, i) => (
              <p key={i}>
                {formatDate(w.date)}, {w.mealLabel}: &quot;{w.token}&quot; —{" "}
                <span className="font-medium">{w.childName}</span>da shu allergiya bor
              </p>
            ))}
          </CardBody>
        </Card>
      )}

      {!weekStart || !branchId ? (
        weekStart ? <EmptyState title="Filial mavjud emas" /> : <LoadingState rows={7} />
      ) : menuQuery.isLoading ? (
        <LoadingState rows={7} />
      ) : menuQuery.isError ? (
        <ErrorState message={(menuQuery.error as Error).message} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>Sana</Th>
                <Th>Nonushta</Th>
                <Th>Tushlik</Th>
                <Th>Kechki ovqat / gazak</Th>
                {canWrite && <Th />}
              </tr>
            </THead>
            <TBody>
              {days.map((day) => {
                const entry = entryByDate.get(day) ?? null;
                return (
                  <Tr key={day}>
                    <Td className="whitespace-nowrap font-medium tabular-nums">{formatDate(day)}</Td>
                    <Td className="text-[var(--color-text-muted)]">{entry?.breakfast || "—"}</Td>
                    <Td className="text-[var(--color-text-muted)]">{entry?.lunch || "—"}</Td>
                    <Td className="text-[var(--color-text-muted)]">{entry?.snack || "—"}</Td>
                    {canWrite && (
                      <Td className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditDate(day)}>
                          Tahrirlash
                        </Button>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </TBody>
          </DataTable>
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

      {canWrite && weeklyMenuOpen && (
        <WeeklyMenuModal
          open={weeklyMenuOpen}
          onClose={() => setWeeklyMenuOpen(false)}
          slug={slug}
          days={days}
          entryByDate={entryByDate}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Allergiyasi bor bolalar</CardTitle>
        </CardHeader>
        <CardBody className="text-[14px] text-[var(--color-text)]">
          {allergiesQuery.isLoading ? (
            <LoadingState rows={2} />
          ) : allergiesQuery.isError ? (
            <ErrorState message={(allergiesQuery.error as Error).message} />
          ) : !allergiesQuery.data?.length ? (
            <EmptyState title="Allergiyasi bor bola yo'q" />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {allergiesQuery.data.map((item) => (
                <li key={item.child.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <span className="font-medium">{item.child.fullName}</span>
                  <span className="text-[var(--color-danger)]">{item.allergies}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
