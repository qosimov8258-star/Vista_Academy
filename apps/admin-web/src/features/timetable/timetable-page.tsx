"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, ChevronLeft, Copy, NotebookPen, Plus, Printer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { IosButton } from "@/components/ios/button";
import { Group, ListRow, Row } from "@/components/ios/group";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FormSection, TextArea } from "@/components/ios/form";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { CheckIcon } from "@/components/ios/icons";
import { useTr } from "@/i18n/tr";
import { RowSheet } from "./row-sheet";
import {
  DAY_LONG,
  DAY_SHORT,
  SAMPLE_SLOTS,
  emptyCells,
  sortRows,
  timeLabel,
  todayIndex,
  visibleDays,
  type GroupTimetable,
  type TimetableRow,
} from "./shared";

const NOTE_MAX = 500;

/**
 * Haftalik jadval — har bir guruhning kun tartibi (Vista PDF ko'rinishida):
 * qator — vaqt, ustun — hafta kuni. Jadval kundalik kun tartibiga yoziladi,
 * shuning uchun ota-ona kabinetida (Jadval va Kundalik) darhol ko'rinadi.
 *
 * Filial admini va administrator to'ldiradi; tarbiyachi o'z guruhini,
 * Super Admin hamma filialni faqat ko'radi.
 */
export function TimetablePage({ slug }: { slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const queryKey = ["timetables", slug, forcedBranchId ?? "all"];

  const listQuery = useQuery({
    queryKey,
    queryFn: () => api.get<GroupTimetable[]>(`/app/diary/timetables${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const multiBranch = new Set(groups.map((g) => g.branchId)).size > 1;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Kompyuterda birinchi guruh darhol ochiladi; telefonda ro'yxat ko'rinadi
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (isWide && !selectedId && groups.length > 0) setSelectedId(groups[0].groupId);
  }, [isWide, selectedId, groups]);
  const selected = groups.find((g) => g.groupId === selectedId) ?? null;

  const filledCount = groups.filter((g) => g.rows.length > 0).length;

  return (
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-2">
        <PageHeaderCard
          icon={CalendarRange}
          tint="teal"
          title={tr("Haftalik jadval")}
          count={listQuery.data ? tr("{0} ta guruh", groups.length) : undefined}
          subtitle={
            listQuery.data
              ? tr("{0} tasi to'ldirilgan · ota-onalar kabinetida ham ko'rinadi", filledCount)
              : tr("Ota-onalar kabinetida ham ko'rinadi")
          }
        />

        {listQuery.isLoading ? (
          <SkeletonRows rows={6} />
        ) : listQuery.isError && !listQuery.data ? (
          <ErrorState message={(listQuery.error as Error).message} onRetry={() => listQuery.refetch()} retrying={listQuery.isFetching} />
        ) : groups.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Faol guruh yo'q" hint="Guruh ochilgach, uning haftalik jadvalini shu yerda to'ldirasiz." />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
            {/* Guruhlar — telefonda guruh tanlanganda yashiriladi */}
            <div className={clsx(selected && "max-lg:hidden")}>
              <Group title={tr("Guruhlar")} refreshing={listQuery.isFetching && !listQuery.isLoading}>
                {groups.map((g) => (
                  <ListRow
                    key={g.groupId}
                    onClick={() => setSelectedId(g.groupId)}
                    avatar={<IosAvatar name={tr(g.groupName)} letters={1} />}
                    title={
                      <span className={clsx(g.groupId === selectedId && "lg:font-semibold lg:text-[var(--color-primary)]")}>{tr(g.groupName)}</span>
                    }
                    subtitle={[multiBranch ? g.branchName : null, g.rows.length > 0 ? tr("{0} ta qator", g.rows.length) : null]
                      .filter(Boolean)
                      .join(" · ")}
                    meta={g.rows.length === 0 ? <Pill color={IOS.orange}>{tr("Bo'sh")}</Pill> : undefined}
                    chevron
                  />
                ))}
              </Group>
            </div>

            {selected && (
              <GroupTimetableView
                key={selected.groupId}
                timetable={selected}
                groups={groups}
                canWrite={canWrite}
                showBranch={multiBranch}
                onBack={() => setSelectedId(null)}
                onSaved={(saved) => {
                  queryClient.setQueryData<GroupTimetable[]>(queryKey, (prev) =>
                    prev?.map((g) => (g.groupId === saved.groupId ? { ...g, rows: saved.rows, note: saved.note } : g)),
                  );
                  queryClient.invalidateQueries({ queryKey: ["timetables", slug] });
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type SaveInput = { rows: TimetableRow[]; note: string };

function GroupTimetableView({
  timetable,
  groups,
  canWrite,
  showBranch,
  onBack,
  onSaved,
}: {
  timetable: GroupTimetable;
  groups: GroupTimetable[];
  canWrite: boolean;
  showBranch: boolean;
  onBack: () => void;
  onSaved: (saved: GroupTimetable) => void;
}) {
  const tr = useTr();
  const rows = timetable.rows;
  const days = visibleDays(rows);
  const [today, setToday] = useState<number | null>(null);
  const [day, setDay] = useState(0);
  useEffect(() => {
    const t = todayIndex();
    setToday(t);
    setDay(t === 6 && !days.includes(6) ? 0 : t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rowSheet, setRowSheet] = useState<{ open: boolean; index: number | null; focusDay: number | null }>({ open: false, index: null, focusDay: null });
  const [noteOpen, setNoteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const save = useMutation({
    mutationFn: (input: SaveInput) =>
      api.put<Omit<GroupTimetable, "branchId" | "branchName">>(`/app/diary/groups/${timetable.groupId}/timetable`, {
        rows: sortRows(input.rows),
        note: input.note,
      }),
    onSuccess: (saved) => {
      onSaved({ ...timetable, ...saved });
      setRowSheet((s) => ({ ...s, open: false }));
      setNoteOpen(false);
      setCopyOpen(false);
    },
  });
  const saveError = save.error ? (save.error instanceof ApiError ? save.error.message : "Saqlab bo'lmadi") : null;
  const { reset } = save;

  const editingRow = rowSheet.index !== null ? rows[rowSheet.index] : null;
  const takenTimes = rows.filter((_, i) => i !== rowSheet.index).map((r) => `${r.startTime}|${r.endTime}`);
  const openRow = (index: number | null, focusDay: number | null = null) => {
    if (!canWrite) return;
    reset();
    setRowSheet({ open: true, index, focusDay });
  };

  const startWithSample = () =>
    save.mutate({ rows: SAMPLE_SLOTS.map(([startTime, endTime]) => ({ startTime, endTime, cells: emptyCells() })), note: timetable.note });

  return (
    <div className="min-w-0 space-y-5">
      {/* Sarlavha: telefonda "‹ Guruhlar" bilan */}
      <PageCard className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={tr("Guruhlar")}
          className="-ml-1 flex h-11 w-9 items-center justify-center rounded-full text-[var(--color-primary)] transition-opacity active:opacity-50 lg:hidden"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-bold leading-tight text-[var(--color-text)]">{tr(timetable.groupName)}</h2>
          <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">
            {[showBranch ? timetable.branchName : null, rows.length > 0 ? tr("{0} ta qator", rows.length) : tr("Jadval hali to'ldirilmagan")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rows.length > 0 && <IosButton label={tr("Chop etish")} icon={Printer} compact onClick={() => window.print()} />}
          {canWrite && <IosButton label={tr("Nusxa olish")} icon={Copy} compact onClick={() => (reset(), setCopyOpen(true))} />}
          {canWrite && rows.length > 0 && <IosButton label={tr("Qator qo'shish")} icon={Plus} variant="primary" compact onClick={() => openRow(null)} />}
        </div>
      </PageCard>

      {rows.length === 0 ? (
        <div className={clsx(GROUP_BLOCK, "flex flex-col items-center px-6 py-9 text-center")}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#8e8e93]">
            <CalendarRange className="h-7 w-7" strokeWidth={1.9} />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-[var(--color-text)]">{tr("Jadval hali to'ldirilmagan")}</p>
          <p className="mt-1 max-w-[320px] text-[13px] text-[#8e8e93]">
            {canWrite
              ? tr("09:00–17:00 vaqt qatorlari bilan boshlang yoki boshqa guruh jadvalidan nusxa oling.")
              : tr("Filial admini jadvalni to'ldirgach shu yerda ko'rinadi.")}
          </p>
          {canWrite && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <IosButton label={tr("Vaqt qatorlari bilan boshlash")} variant="primary" loading={save.isPending} onClick={startWithSample} />
              <IosButton label={tr("Bo'sh qator qo'shish")} icon={Plus} onClick={() => openRow(null)} />
            </div>
          )}
          {saveError && !rowSheet.open && !copyOpen && <p className="mt-3 text-[13px] text-[#ff3b30]">{tr(saveError)}</p>}
        </div>
      ) : (
        <>
          {/* Kompyuter va planshet: PDF'dagidek to'liq jadval */}
          <div className={clsx(GROUP_BLOCK, "max-md:hidden")} data-print-area>
            {/* Faqat chop etishda: PDF'dagidek sarlavha */}
            <div className="hidden px-3 pb-3 pt-1 text-center print:block">
              <p className="text-[20px] font-bold">{tr("Haftalik jadval")}</p>
              <p className="text-[14px]">{tr("Guruh «{0}»", timetable.groupName)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-[1] w-[112px] bg-[#f7f7fa] px-3 py-3 text-left text-[12.5px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                      {tr("Vaqt")}
                    </th>
                    {days.map((d) => (
                      <th
                        key={d}
                        className={clsx(
                          "px-2 py-3 text-center text-[13px] font-semibold",
                          d === today ? "bg-[var(--color-primary)]/[0.1] text-[var(--color-primary)]" : "bg-[#f7f7fa] text-[var(--color-text)]",
                        )}
                      >
                        {tr(DAY_SHORT[d])}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.startTime}-${row.endTime}`} className="border-t border-black/[0.08]">
                      <td className="sticky left-0 z-[1] whitespace-nowrap bg-[#fbfbfd] px-3 py-2.5 text-[13px] tabular-nums text-[#6d6d72]">
                        {canWrite ? (
                          <button type="button" onClick={() => openRow(index)} className="text-left tabular-nums hover:text-[var(--color-primary)]">
                            {timeLabel(row)}
                          </button>
                        ) : (
                          timeLabel(row)
                        )}
                      </td>
                      {days.map((d) => (
                        <td
                          key={d}
                          className={clsx(
                            "border-l border-black/[0.06] p-0 text-center align-middle",
                            d === today && "bg-[var(--color-primary)]/[0.04]",
                          )}
                        >
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() => openRow(index, d)}
                              className="block min-h-[44px] w-full px-2 py-2.5 leading-snug text-[var(--color-text)] transition-colors hover:bg-[#767680]/[0.06]"
                            >
                              {row.cells[d] || <span className="text-[#c7c7cc]">—</span>}
                            </button>
                          ) : (
                            <span className="block px-2 py-2.5 leading-snug text-[var(--color-text)]">{row.cells[d] || <span className="text-[#c7c7cc]">—</span>}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {timetable.note && <p className="hidden whitespace-pre-line px-3 pt-3 text-[12px] print:block">{timetable.note}</p>}
          </div>

          {/* Telefon: kun tanlanadi, shu kunning qatorlari */}
          <div className="space-y-3 md:hidden print:hidden">
            <div role="radiogroup" aria-label={tr("Hafta kuni")} className="grid gap-1 rounded-full bg-[#767680]/[0.12] p-[3px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={day === d}
                  aria-label={tr(DAY_LONG[d])}
                  onClick={() => setDay(d)}
                  className={clsx(
                    "relative h-9 rounded-full text-[13.5px] font-semibold transition-colors",
                    day === d ? "bg-white text-[var(--color-text)] shadow-[0_3px_8px_rgba(0,0,0,0.12)]" : "text-[#8e8e93]",
                  )}
                >
                  {tr(DAY_SHORT[d])}
                  {d === today && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <Group title={tr(DAY_LONG[day]) + (day === today ? ` · ${tr("bugun")}` : "")}>
              {rows.map((row, index) => (
                <div key={`${row.startTime}-${row.endTime}`} className="group/row relative">
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => openRow(index, day)}
                    className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors enabled:hover:bg-[#767680]/[0.05] enabled:active:bg-[#767680]/[0.1]"
                  >
                    <span className="w-[92px] shrink-0 text-[13px] tabular-nums text-[#8e8e93]">{timeLabel(row)}</span>
                    <span className={clsx("min-w-0 flex-1 text-[15px] leading-snug", row.cells[day] ? "text-[var(--color-text)]" : "text-[#c7c7cc]")}>
                      {row.cells[day] || "—"}
                    </span>
                  </button>
                  <span className={ROW_SEPARATOR} aria-hidden="true" />
                </div>
              ))}
            </Group>
          </div>
        </>
      )}

      {/* Izoh — PDF ostidagi yozuv kabi */}
      {(rows.length > 0 || timetable.note) && (
        <Group title={tr("Izoh")}>
          {canWrite ? (
            <Row
              title={
                timetable.note ? (
                  <span className="whitespace-pre-line text-[14.5px] leading-snug">{timetable.note}</span>
                ) : (
                  <span className="text-[#8e8e93]">{tr("Masalan: shanbada mashg'ulotlar 15:00 da tugaydi")}</span>
                )
              }
              onClick={() => (reset(), setNoteOpen(true))}
              leading={<NotebookPen className="h-[18px] w-[18px] shrink-0 text-[#8e8e93]" />}
            />
          ) : (
            <p className="whitespace-pre-line px-4 py-3 text-[14.5px] leading-snug text-[var(--color-text)]">{timetable.note || tr("Izoh yo'q")}</p>
          )}
        </Group>
      )}

      {canWrite && (
        <>
          <RowSheet
            open={rowSheet.open}
            onClose={() => setRowSheet((s) => ({ ...s, open: false }))}
            row={editingRow}
            focusDay={rowSheet.focusDay}
            takenTimes={takenTimes}
            saving={save.isPending}
            error={saveError}
            onSave={(next) => {
              const nextRows = rowSheet.index === null ? [...rows, next] : rows.map((r, i) => (i === rowSheet.index ? next : r));
              save.mutate({ rows: nextRows, note: timetable.note });
            }}
            onDelete={() => save.mutate({ rows: rows.filter((_, i) => i !== rowSheet.index), note: timetable.note })}
          />
          <NoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} note={timetable.note} saving={save.isPending} error={saveError} onSave={(note) => save.mutate({ rows, note })} />
          <CopySheet
            open={copyOpen}
            onClose={() => setCopyOpen(false)}
            target={timetable}
            sources={groups.filter((g) => g.groupId !== timetable.groupId && g.rows.length > 0)}
            saving={save.isPending}
            error={saveError}
            onCopy={(source) => save.mutate({ rows: source.rows, note: source.note })}
          />
        </>
      )}
    </div>
  );
}

function NoteSheet({
  open,
  onClose,
  note,
  saving,
  error,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  note: string;
  saving: boolean;
  error: string | null;
  onSave: (note: string) => void;
}) {
  const tr = useTr();
  const [value, setValue] = useState(note);
  useEffect(() => {
    if (open) setValue(note);
  }, [open, note]);
  return (
    <IosSheet
      open={open}
      onClose={() => !saving && onClose()}
      title={tr("Izoh")}
      footer={
        <SheetPrimaryButton onClick={() => onSave(value.trim())} loading={saving} dim={value.trim() === note}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <FormSection footer={tr("Jadval ostida ko'rinadi — ota-onalar ham o'qiydi.")}>
        <div className="px-4 py-3">
          <TextArea
            rows={5}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, NOTE_MAX))}
            placeholder={tr("Masalan: ingliz tili har kuni 30 daqiqa. Shanbada mashg'ulotlar 15:00 da tugaydi.")}
            className="text-[15px]"
          />
        </div>
      </FormSection>
      {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
    </IosSheet>
  );
}

/** Boshqa guruh jadvalini shu guruhga ko'chirish — ikkinchi bosqichda tasdiqlanadi */
function CopySheet({
  open,
  onClose,
  target,
  sources,
  saving,
  error,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  target: GroupTimetable;
  sources: GroupTimetable[];
  saving: boolean;
  error: string | null;
  onCopy: (source: GroupTimetable) => void;
}) {
  const tr = useTr();
  const [picked, setPicked] = useState<GroupTimetable | null>(null);
  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);
  return (
    <IosSheet
      open={open}
      onClose={() => !saving && onClose()}
      title={tr("Nusxa olish")}
      footer={
        picked ? (
          <SheetPrimaryButton onClick={() => onCopy(picked)} loading={saving}>
            {tr("Ko'chirish")}
          </SheetPrimaryButton>
        ) : undefined
      }
    >
      {sources.length === 0 ? (
        <EmptyState icon={Copy} title="To'ldirilgan jadval yo'q" hint="Avval bitta guruh jadvalini to'ldiring — keyin uni boshqa guruhlarga ko'chirasiz." />
      ) : (
        <FormSection
          title={tr("Qaysi guruhdan")}
          footer={
            picked && target.rows.length > 0 ? (
              <span className="text-[#ff3b30]">{tr("«{0}» ning hozirgi jadvali almashtiriladi.", target.groupName)}</span>
            ) : (
              tr("Jadval va izoh «{0}» ga ko'chiriladi, keyin uni tahrirlashingiz mumkin.", target.groupName)
            )
          }
        >
          {sources.map((g) => (
            <div key={g.groupId} className="group/row relative">
              <button
                type="button"
                role="radio"
                aria-checked={picked?.groupId === g.groupId}
                onClick={() => setPicked(g)}
                className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-[var(--color-text)]">{tr(g.groupName)}</span>
                  <span className="block truncate text-[12.5px] text-[#8e8e93]">{tr("{0} ta qator", g.rows.length)}</span>
                </span>
                {picked?.groupId === g.groupId && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
              </button>
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
          ))}
        </FormSection>
      )}
      {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
    </IosSheet>
  );
}
