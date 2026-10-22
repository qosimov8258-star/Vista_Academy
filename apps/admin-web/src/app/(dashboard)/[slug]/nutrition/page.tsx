"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, TriangleAlert, Utensils } from "lucide-react";
import { api } from "@/lib/api";
import type { ChildAllergy, MenuEntry, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import { IosButton } from "@/components/ios/button";
import { PeriodStepper, WEEKDAYS, dayMonthLabel } from "@/components/ios/day-stepper";
import { Group, ListRow } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { OptionPicker } from "@/features/lessons/option-picker";
import { EditMenuModal } from "@/features/nutrition/edit-menu-modal";
import { WeeklyMenuModal } from "@/features/nutrition/weekly-menu-modal";
import { canWriteKitchen, isChef } from "@/lib/permissions";
import { ChefMenu } from "@/features/chef/chef-menu";
import { TodayRemindersCard } from "@/features/child-notes/today-reminders-card";
import { TodayChildrenCard } from "@/features/nutrition/today-children-card";
import { MenuPhotosCard } from "@/features/nutrition/menu-photos-card";
import { useTr } from "@/i18n/tr";

const DEFAULT_TIMEZONE = "Asia/Tashkent";
const DAY_MS = 24 * 60 * 60 * 1000;
const MEAL_ROWS = [
  { key: "breakfast", label: "Nonushta" },
  { key: "lunch", label: "Tushlik" },
  { key: "snack", label: "Kechki ovqat / gazak" },
] as const;

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
  // Oshpazga telefon uchun qurilgan menyu ko'rinishi; qolgan rollarga — haftalik jadval
  if (isChef(user?.role)) return <ChefMenu slug={slug} />;
  return <AdminNutritionPage slug={slug} />;
}

function AdminNutritionPage({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  // Menyu — oshpazning ishi; filial admini va administrator ham yozadi.
  const canWrite = canWriteKitchen(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date text below.
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [editDate, setEditDate] = useState<string | null>(null);
  const [weeklyMenuOpen, setWeeklyMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const t = todayDateString();
    setToday(t);
    setWeekStart((current) => current ?? mondayOf(t));
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
  const thisWeek = today ? mondayOf(today) : null;

  const menuQuery = useQuery({
    queryKey: ["menu", slug, branchId, weekStart],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${weekStart}&to=${weekEnd}`),
    enabled: !!branchId && !!weekStart,
  });

  const entryByDate = useMemo(() => new Map((menuQuery.data ?? []).map((e) => [e.date.slice(0, 10), e])), [menuQuery.data]);

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
      for (const meal of MEAL_ROWS) {
        const text = entry[meal.key];
        if (!text) continue;
        const lower = text.toLowerCase();
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
      setExportError(tr("Eksport qilib bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setExporting(false);
    }
  };

  const year = today ? Number(today.slice(0, 4)) : undefined;

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-2">
        <PageHeaderCard
          icon={Utensils}
          tint="orange"
          title={tr("Ovqatlanish")}
          subtitle={tr("Bugungi porsiya, eslatmalar va haftalik menyu")}
          actions={
            <>
              <IosButton label={tr("Eksport (CSV)")} icon={Download} compact loading={exporting} disabled={!weekStart || !branchId} onClick={handleExport} />
              {canWrite && (
                <IosButton
                  label={tr("Haftalik menyu")}
                  icon={CalendarDays}
                  variant="primary"
                  compact
                  disabled={!weekStart || menuQuery.isLoading}
                  onClick={() => setWeeklyMenuOpen(true)}
                />
              )}
            </>
          }
        />

        {exportError && <p className="rounded-[18px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[13.5px] text-[#d70015]">{tr(exportError)}</p>}

        {!forcedBranchId && branches.length > 1 && (
          <OptionPicker
            variant="pill"
            title={tr("Filial")}
            value={branchId}
            onChange={setBranchId}
            placeholder={tr("Filial")}
            options={branches.map((branch) => ({ id: branch.id, label: tr(branch.name) }))}
          />
        )}

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        {/* Bugun — oshxona uchun eng kerakli raqamlar tepada */}
        {branchId && today && <TodayChildrenCard slug={slug} branchId={branchId} today={today} />}
        {branchId && today && <TodayRemindersCard slug={slug} branchId={branchId} today={today} />}
        {branchId && today && <MenuPhotosCard slug={slug} branchId={branchId} date={today} canWrite={false} />}

        {weekStart && weekEnd && (
          <PeriodStepper
            onPrev={() => setWeekStart((w) => (w ? addDays(w, -7) : w))}
            onNext={() => setWeekStart((w) => (w ? addDays(w, 7) : w))}
            prevLabel={tr("Oldingi hafta")}
            nextLabel={tr("Keyingi hafta")}
            reset={thisWeek && weekStart !== thisWeek ? { label: tr("Shu hafta"), onClick: () => setWeekStart(thisWeek) } : undefined}
          >
            {dayMonthLabel(weekStart, tr, year)} — {dayMonthLabel(weekEnd, tr, year)}
          </PeriodStepper>
        )}

        {allergyWarnings.length > 0 && (
          <div className="rounded-[18px] bg-[#ff3b30]/[0.08] px-4 py-3.5">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[#d70015]">
              <TriangleAlert className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
              {tr("Diqqat — bu haftaning menyusida allergen bor")}
            </p>
            <ul className="mt-2 space-y-1 text-[14px] leading-snug text-[var(--color-text)]">
              {allergyWarnings.map((w, i) => (
                <li key={i}>
                  <span className="tabular-nums text-[#8e8e93]">{dayMonthLabel(w.date, tr)}</span>, {tr(w.mealLabel)}: «{tr(w.token)}» —{" "}
                  <span className="font-medium">{tr(w.childName)}</span>
                  {tr("da shu allergiya bor")}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Group
          title={tr("Haftalik menyu")}
          refreshing={menuQuery.isFetching && !menuQuery.isLoading}
          footer={canWrite ? tr("Kunni bosib, shu kun menyusini o'zgartiring.") : undefined}
          bare
        >
          {!weekStart || (!branchId && orgQuery.isLoading) ? (
            <SkeletonRows rows={7} />
          ) : !branchId ? (
            <EmptyState icon={Utensils} title="Filial mavjud emas" />
          ) : menuQuery.isLoading ? (
            <SkeletonRows rows={7} />
          ) : menuQuery.isError ? (
            <ErrorState message={(menuQuery.error as Error).message} onRetry={() => menuQuery.refetch()} retrying={menuQuery.isFetching} />
          ) : (
            <div className={GROUP_BLOCK}>
              {days.map((day) => (
                <MenuDayRow
                  key={day}
                  day={day}
                  isToday={day === today}
                  entry={entryByDate.get(day) ?? null}
                  onEdit={canWrite ? () => setEditDate(day) : undefined}
                />
              ))}
            </div>
          )}
        </Group>

        <Group title={tr("Allergiyasi bor bolalar")} bare>
          {allergiesQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : allergiesQuery.isError ? (
            <ErrorState message={(allergiesQuery.error as Error).message} onRetry={() => allergiesQuery.refetch()} retrying={allergiesQuery.isFetching} />
          ) : !allergiesQuery.data?.length ? (
            <div className={GROUP_BLOCK}>
              <EmptyState icon={Utensils} title="Allergiyasi bor bola yo'q" />
            </div>
          ) : (
            <div className={GROUP_BLOCK}>
              {allergiesQuery.data.map((item) => (
                <ListRow
                  key={item.child.id}
                  avatar={<IosAvatar name={item.child.fullName} size={44} />}
                  title={tr(item.child.fullName)}
                  subtitle={<span className="text-[#d70015]">{tr(item.allergies)}</span>}
                  meta={item.child.group ? <Pill color={IOS.gray}>{tr(item.child.group.name)}</Pill> : undefined}
                />
              ))}
            </div>
          )}
        </Group>
      </div>

      {canWrite && editDate && (
        <EditMenuModal open={!!editDate} onClose={() => setEditDate(null)} slug={slug} date={editDate} entry={entryByDate.get(editDate) ?? null} />
      )}

      {canWrite && weeklyMenuOpen && (
        <WeeklyMenuModal open={weeklyMenuOpen} onClose={() => setWeeklyMenuOpen(false)} slug={slug} days={days} entryByDate={entryByDate} />
      )}
    </div>
  );
}

/** Kun qatori: chapda kalendar varag'i (bugun — rangli), o'ngda uch ovqat */
function MenuDayRow({ day, isToday, entry, onEdit }: { day: string; isToday: boolean; entry: MenuEntry | null; onEdit?: () => void }) {
  const tr = useTr();
  const date = new Date(`${day}T00:00:00Z`);
  const empty = !entry?.breakfast && !entry?.lunch && !entry?.snack;
  const content = (
    <>
      <span
        className="flex h-[52px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[12px]"
        style={{ backgroundColor: isToday ? IOS.orange : "rgba(118,118,128,0.12)", color: isToday ? "#fff" : undefined }}
      >
        <span className="text-[11px] font-semibold uppercase leading-none" style={{ color: isToday ? "#fff" : IOS.red }}>
          {tr(WEEKDAYS[date.getUTCDay()]).slice(0, 3)}
        </span>
        <span className="mt-1 text-[20px] font-bold leading-none tabular-nums">{date.getUTCDate()}</span>
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        {empty ? (
          <span className="block py-3 text-[15px] text-[#8e8e93]">{tr("Menyu kiritilmagan")}</span>
        ) : (
          MEAL_ROWS.map((m) => (
            <span key={m.key} className="flex gap-2 text-[14.5px] leading-snug">
              <span className="w-[82px] shrink-0 text-[13px] leading-[1.45] text-[#8e8e93]">{tr(m.label === "Kechki ovqat / gazak" ? "Gazak" : m.label)}</span>
              <span className="min-w-0 flex-1 break-words text-[var(--color-text)]">{entry?.[m.key] || "—"}</span>
            </span>
          ))
        )}
      </span>
      {isToday && (
        // Telefonda joy tor — bugungi kun rangli varaqdan ham ko'rinadi
        <span className="shrink-0 self-start max-sm:hidden">
          <Pill color={IOS.orange}>{tr("Bugun")}</Pill>
        </span>
      )}
    </>
  );
  return (
    <div className="group/row relative">
      {onEdit ? (
        <button type="button" onClick={onEdit} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${ROW_PRESS}`}>
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{content}</div>
      )}
      <span className={ROW_SEPARATOR} style={{ left: 74 }} aria-hidden="true" />
    </div>
  );
}
