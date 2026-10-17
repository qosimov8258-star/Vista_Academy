"use client";

import { use, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, DoorOpen } from "lucide-react";
import { api } from "@/lib/api";
import type { Employee, Group, LessonSchedule, Room, Weekday } from "@/lib/types";
import { useAuth, useFeatureEnabled } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { IosButton } from "@/components/ios/button";
import { Segmented } from "@/components/ios/form";
import { Group as IosGroup } from "@/components/ios/group";
import { CalendarIcon, PlusIcon } from "@/components/ios/icons";
import { PageHeaderCard } from "@/components/ios/page-card";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { LessonSheet } from "@/features/lessons/lesson-sheet";
import { OptionPicker } from "@/features/lessons/option-picker";
import { RoomsPanel } from "@/features/lessons/rooms-panel";
import { CLASH_LABEL, WEEKDAY_LABEL, WEEKDAY_ORDER, WEEKDAY_SHORT, scheduleClashes, todayWeekday, type Clash } from "@/features/lessons/schedule-shared";
import { useTr } from "@/i18n/tr";

type Tab = "schedule" | "rooms";

export default function LessonSchedulePage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const isOn = useFeatureEnabled();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const branchQuery = forcedBranchId ? `?branchId=${forcedBranchId}` : "";

  const [tab, setTab] = useState<Tab>("schedule");
  const [groupFilter, setGroupFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  // Telefonda — bitta kun; bugungi kun mijoz soatiga bog'liq, shuning uchun effektda
  const [day, setDay] = useState<Weekday>("MONDAY");
  useEffect(() => setDay(todayWeekday()), []);
  const [sheet, setSheet] = useState<{ open: boolean; schedule: LessonSchedule | null }>({ open: false, schedule: null });

  const lessonsQuery = useQuery({
    queryKey: ["lesson-schedules", slug, forcedBranchId, "all"],
    queryFn: () => api.get<LessonSchedule[]>(`/app/lesson-schedules${branchQuery}`),
  });
  const roomsQuery = useQuery({
    queryKey: ["rooms", slug, forcedBranchId],
    queryFn: () => api.get<Room[]>(`/app/rooms${branchQuery}`),
  });
  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${branchQuery}`),
  });
  // Xodimlar bo'limi o'chiq bo'lsa ro'yxat so'ralmaydi — o'qituvchilar jadvaldagi darslardan olinadi
  const employeesQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${branchQuery}`),
    enabled: isOn("employees"),
  });

  const lessons = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const groups = (groupsQuery.data ?? []).filter((group) => group.status === "ACTIVE");
  const employees = useMemo(() => {
    if (employeesQuery.data) return employeesQuery.data;
    const seen = new Map<string, Employee>();
    for (const lesson of lessons) {
      if (!seen.has(lesson.employeeId)) seen.set(lesson.employeeId, { id: lesson.employeeId, fullName: lesson.employee.fullName, position: "" } as Employee);
    }
    return [...seen.values()];
  }, [employeesQuery.data, lessons]);

  const clashes = useMemo(() => scheduleClashes(lessons), [lessons]);
  const visible = lessons.filter(
    (lesson) =>
      (!groupFilter || lesson.groupId === groupFilter) &&
      (!roomFilter || (roomFilter === "__none__" ? !lesson.roomId : lesson.roomId === roomFilter)) &&
      (!teacherFilter || lesson.employeeId === teacherFilter),
  );
  // Ish kunlari doim, yakshanba — faqat darsi bo'lsa
  const days = WEEKDAY_ORDER.filter((d) => d !== "SUNDAY" || lessons.some((lesson) => lesson.weekday === "SUNDAY"));
  const byDay = (d: Weekday) => visible.filter((lesson) => lesson.weekday === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const roomless = lessons.filter((lesson) => !lesson.roomId).length;
  const filtersActive = !!(groupFilter || roomFilter || teacherFilter);
  const dataLoading = groupsQuery.isLoading || roomsQuery.isLoading || employeesQuery.isLoading;

  const openNew = () => setSheet({ open: true, schedule: null });
  const openLesson = (lesson: LessonSchedule) => canWrite && setSheet({ open: true, schedule: lesson });

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-2">
        <PageHeaderCard
          icon={CalendarIcon}
          tint="indigo"
          title={tr("Dars jadvali")}
          count={lessonsQuery.data ? tr("{0} ta dars", lessons.length) : undefined}
          subtitle={tr("Qaysi guruh, qachon va qaysi xonada dars o'tadi")}
          actions={canWrite && tab === "schedule" ? <IosButton label={tr("Yangi dars")} icon={PlusIcon} variant="primary" compact onClick={openNew} /> : undefined}
        />

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        <div className="max-w-xs">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            label={tr("Bo'lim")}
            options={[
              { value: "schedule", label: tr("Jadval") },
              { value: "rooms", label: tr("Xonalar") },
            ]}
          />
        </div>

        {tab === "rooms" ? (
          <RoomsPanel
            slug={slug}
            rooms={rooms}
            loading={roomsQuery.isLoading}
            error={roomsQuery.error as Error | null}
            onRetry={() => roomsQuery.refetch()}
            retrying={roomsQuery.isFetching}
            canWrite={canWrite}
          />
        ) : (
          <>
            {/* Filtrlar: guruh, xona, o'qituvchi — jadvalni bitta ko'z bilan ko'rish uchun */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <OptionPicker variant="pill" title={tr("Guruh")} value={groupFilter} onChange={setGroupFilter} placeholder={tr("Barcha guruhlar")} emptyOption={tr("Barcha guruhlar")} options={groups.map((g) => ({ id: g.id, label: tr(g.name) }))} loading={groupsQuery.isLoading} />
              <OptionPicker
                variant="pill"
                title={tr("Xona")}
                value={roomFilter}
                onChange={setRoomFilter}
                placeholder={tr("Barcha xonalar")}
                emptyOption={tr("Barcha xonalar")}
                options={[...rooms.map((r) => ({ id: r.id, label: tr(r.name) })), { id: "__none__", label: tr("Xonasiz darslar") }]}
                loading={roomsQuery.isLoading}
              />
              <OptionPicker variant="pill" title={tr("O'qituvchi")} value={teacherFilter} onChange={setTeacherFilter} placeholder={tr("Barcha o'qituvchilar")} emptyOption={tr("Barcha o'qituvchilar")} options={employees.map((e) => ({ id: e.id, label: tr(e.fullName) }))} loading={employeesQuery.isLoading} />
            </div>

            {clashes.size > 0 && (
              <div role="alert" className="flex items-start gap-3 rounded-[18px] bg-[#ff3b30]/[0.1] px-4 py-3 text-[13.5px] leading-snug text-[#ff3b30]">
                <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
                <span>
                  <b>{tr("{0} ta darsda to'qnashuv bor", clashes.size)}</b> — {tr("ular qizil bilan belgilangan. Darsni bosib vaqt yoki xonani o'zgartiring.")}
                </span>
              </div>
            )}

            {lessonsQuery.isLoading ? (
              <SkeletonRows rows={6} avatar={false} />
            ) : lessonsQuery.isError ? (
              <ErrorState message={(lessonsQuery.error as Error).message} onRetry={() => lessonsQuery.refetch()} retrying={lessonsQuery.isFetching} />
            ) : lessons.length === 0 ? (
              <EmptyState icon={CalendarIcon} title="Dars jadvali bo'sh" hint={canWrite ? "«Yangi dars» tugmasi orqali qo'shing" : "Hali dars jadvali belgilanmagan"} />
            ) : (
              <>
                {/* Telefon va planshet: hafta tasmasi + tanlangan kun */}
                <div className="space-y-3 lg:hidden">
                  <div className="flex gap-1.5" role="radiogroup" aria-label={tr("Hafta kuni")}>
                    {days.map((d) => {
                      const count = byDay(d).length;
                      const active = d === day;
                      return (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={tr(WEEKDAY_LABEL[d])}
                          onClick={() => setDay(d)}
                          className={clsx(
                            "flex h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-[14px] transition-[transform,background-color] active:scale-[0.96]",
                            active ? "bg-[var(--color-primary)] text-white" : "bg-white text-[var(--color-text)]",
                          )}
                        >
                          <span className="text-[13px] font-semibold">{tr(WEEKDAY_SHORT[d])}</span>
                          <span className={clsx("text-[12px] tabular-nums", active ? "text-white/80" : "text-[#8e8e93]")}>{count || "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <IosGroup title={tr(WEEKDAY_LABEL[day])} bare>
                    {byDay(day).length === 0 ? (
                      <EmptyState icon={CalendarIcon} title={filtersActive ? "Filtr bo'yicha dars yo'q" : "Bu kuni dars yo'q"} />
                    ) : (
                      <div className={GROUP_BLOCK}>
                        {byDay(day).map((lesson) => (
                          <LessonRow key={lesson.id} lesson={lesson} clashes={clashes.get(lesson.id)} onClick={canWrite ? () => openLesson(lesson) : undefined} />
                        ))}
                      </div>
                    )}
                  </IosGroup>
                </div>

                {/* Katta ekran: hafta — ustunlarda kunlar */}
                <div className="hidden gap-3 lg:grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                  {days.map((d) => (
                    <section key={d} className="min-w-0">
                      <h2 className="px-1 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">
                        {tr(WEEKDAY_LABEL[d])} <span className="normal-case tracking-normal">· {byDay(d).length}</span>
                      </h2>
                      <div className="space-y-2">
                        {byDay(d).map((lesson) => (
                          <LessonCard key={lesson.id} lesson={lesson} clashes={clashes.get(lesson.id)} onClick={canWrite ? () => openLesson(lesson) : undefined} />
                        ))}
                        {byDay(d).length === 0 && <div className="rounded-[14px] border border-dashed border-black/10 px-3 py-6 text-center text-[12.5px] text-[#8e8e93]">{tr("Dars yo'q")}</div>}
                      </div>
                    </section>
                  ))}
                </div>

                {roomless > 0 && rooms.length > 0 && (
                  <p className="px-1 text-[12.5px] text-[#8e8e93]">{tr("{0} ta dars xonaga biriktirilmagan — ular xona bo'yicha to'qnashuvda tekshirilmaydi", roomless)}</p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {canWrite && (
        <LessonSheet
          open={sheet.open}
          onClose={() => setSheet((s) => ({ ...s, open: false }))}
          slug={slug}
          branchId={forcedBranchId}
          schedule={sheet.schedule}
          defaults={{ groupId: groupFilter, employeeId: teacherFilter, roomId: roomFilter === "__none__" ? "" : roomFilter, weekday: day }}
          groups={groups}
          employees={employees}
          rooms={rooms}
          loading={dataLoading}
        />
      )}
    </div>
  );
}

function ClashNote({ clashes }: { clashes: Clash[] }) {
  const tr = useTr();
  return <span className="block truncate text-[12px] font-medium text-[#ff3b30]">{clashes.map((c) => tr(CLASH_LABEL[c.kind], tr(c.groupName))).join(" · ")}</span>;
}

function RoomLabel({ lesson }: { lesson: LessonSchedule }) {
  const tr = useTr();
  return lesson.room ? (
    <span className="inline-flex min-w-0 items-center gap-1">
      <DoorOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
      <span className="truncate">{tr(lesson.room.name)}</span>
    </span>
  ) : (
    <span className="text-[#c4c4c6]">{tr("xonasiz")}</span>
  );
}

/** Telefon: kun ro'yxatidagi qator — chapda vaqt, o'rtada fan/guruh, o'qituvchi va xona */
function LessonRow({ lesson, clashes, onClick }: { lesson: LessonSchedule; clashes?: Clash[]; onClick?: () => void }) {
  const tr = useTr();
  const Tag = onClick ? "button" : "div";
  return (
    <div className="group/row relative">
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className={clsx("flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left", onClick && ROW_PRESS, clashes && "bg-[#ff3b30]/[0.05]")}>
        <span className="w-[52px] shrink-0 tabular-nums">
          <span className={clsx("block text-[15px] font-semibold", clashes ? "text-[#ff3b30]" : "text-[var(--color-text)]")}>{lesson.startTime}</span>
          <span className="block text-[12.5px] text-[#8e8e93]">{lesson.endTime}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-[var(--color-text)]">
            {tr(lesson.group.name)}
            {lesson.subject && <span className="font-normal text-[#8e8e93]"> · {tr(lesson.subject)}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-[#8e8e93]">
            <span className="truncate">{tr(lesson.employee.fullName)}</span>
            <span aria-hidden="true">·</span>
            <RoomLabel lesson={lesson} />
          </span>
          {clashes && <ClashNote clashes={clashes} />}
        </span>
      </Tag>
      <span className={ROW_SEPARATOR} style={{ left: 80 }} aria-hidden="true" />
    </div>
  );
}

/** Katta ekran: kun ustunidagi kartochka */
function LessonCard({ lesson, clashes, onClick }: { lesson: LessonSchedule; clashes?: Clash[]; onClick?: () => void }) {
  const tr = useTr();
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "block w-full rounded-[14px] bg-white px-3 py-2.5 text-left",
        onClick && "transition-transform hover:bg-[#fafafc] active:scale-[0.98]",
        clashes && "ring-2 ring-[#ff3b30]",
      )}
    >
      <span className={clsx("block text-[13px] font-semibold tabular-nums", clashes ? "text-[#ff3b30]" : "text-[var(--color-primary)]")}>
        {lesson.startTime}–{lesson.endTime}
      </span>
      <span className="mt-0.5 block truncate text-[14px] font-medium text-[var(--color-text)]">{tr(lesson.group.name)}</span>
      {lesson.subject && <span className="block truncate text-[12.5px] text-[var(--color-text)]">{tr(lesson.subject)}</span>}
      <span className="mt-0.5 block truncate text-[12px] text-[#8e8e93]">{tr(lesson.employee.fullName)}</span>
      <span className="flex min-w-0 text-[12px] text-[#8e8e93]">
        <RoomLabel lesson={lesson} />
      </span>
      {clashes && <ClashNote clashes={clashes} />}
    </Tag>
  );
}
