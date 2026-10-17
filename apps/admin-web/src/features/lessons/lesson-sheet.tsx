"use client";

import { useEffect, useId, useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group, LessonSchedule, Room, ScheduleConflict, Weekday } from "@/lib/types";
import { FieldRow, FormSection, TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton } from "@/components/ios/sheet";
import { IOS } from "@/components/ios/tokens";
import { OptionPicker } from "@/features/lessons/option-picker";
import { TIME_REGEX, WEEKDAY_LABEL, WEEKDAY_ORDER, WEEKDAY_SHORT, timeToMinutes } from "@/features/lessons/schedule-shared";
import { useTr } from "@/i18n/tr";

interface FormState {
  groupId: string;
  employeeId: string;
  roomId: string;
  subject: string;
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
}

const DANGER_BOX = "rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-3 text-[13px] leading-snug text-[#ff3b30]";
const WARN_BOX = "rounded-[14px] bg-[#ff9500]/[0.12] px-4 py-3 text-[13px] leading-snug text-[#c93400]";

/**
 * Dars qo'shish / tahrirlash varag'i. Guruh, o'qituvchi va xona ichki
 * ro'yxatdan tanlanadi; forma to'lgan zahoti server to'qnashuvlarni
 * tekshiradi (xona, o'qituvchi, guruh band; xona sig'imi). To'qnashuv
 * bo'lsa ham admin «Baribir saqlash» bilan saqlay oladi.
 */
export function LessonSheet({
  open,
  onClose,
  slug,
  branchId,
  schedule,
  defaults,
  groups,
  employees,
  rooms,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  /** NETWORK_ADMIN filial ichiga kirganda kerak — boshqa rollarda scope o'zi biladi */
  branchId: string | null;
  /** Tahrirlash uchun — bo'lmasa yangi dars */
  schedule: LessonSchedule | null;
  /** Yangi darsda oldindan tanlanadiganlar (jadval filtri) */
  defaults?: Partial<Pick<FormState, "groupId" | "employeeId" | "roomId">> & { weekday?: Weekday };
  groups: Group[];
  employees: Employee[];
  rooms: Room[];
  loading: boolean;
}) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const isEdit = !!schedule;

  const initial = (): FormState => ({
    groupId: schedule?.groupId ?? defaults?.groupId ?? "",
    employeeId: schedule?.employeeId ?? defaults?.employeeId ?? "",
    roomId: schedule?.roomId ?? defaults?.roomId ?? "",
    subject: schedule?.subject ?? "",
    weekdays: schedule ? [schedule.weekday] : [defaults?.weekday ?? "MONDAY"],
    startTime: schedule?.startTime ?? "09:00",
    endTime: schedule?.endTime ?? "09:45",
  });
  const [form, setForm] = useState<FormState>(initial);
  const [showMissing, setShowMissing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Har ochilishda forma yangidan (tanlangan dars yoki filtr qiymatlari bilan)
  useEffect(() => {
    if (!open) return;
    setForm(initial());
    setShowMissing(false);
    setServerError(null);
    setConflicts([]);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };

  const timesValid = TIME_REGEX.test(form.startTime) && TIME_REGEX.test(form.endTime);
  const timeOrderOk = timesValid && timeToMinutes(form.endTime) > timeToMinutes(form.startTime);
  const missing = {
    groupId: !form.groupId,
    employeeId: !form.employeeId,
    weekdays: form.weekdays.length === 0,
    time: !timeOrderOk,
  };
  const complete = !Object.values(missing).some(Boolean);

  const subjectsQuery = useQuery({
    queryKey: ["subjects", slug],
    queryFn: () => api.get<{ id: string; name: string }[]>("/app/subjects"),
    enabled: open,
    staleTime: 60_000,
  });

  const payload = useMemo(
    () => ({
      groupId: form.groupId,
      employeeId: form.employeeId,
      roomId: form.roomId || undefined,
      subject: form.subject.trim() || undefined,
      weekdays: form.weekdays,
      startTime: form.startTime,
      endTime: form.endTime,
    }),
    [form],
  );

  // Forma to'lgach — server to'qnashuvlarni tekshiradi (yozmaydi), yozish paytida biroz kutib
  useEffect(() => {
    if (!open || !complete) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .post<{ conflicts: ScheduleConflict[] }>("/app/lesson-schedules/check", { ...payload, scheduleId: schedule?.id })
        .then((res) => !cancelled && setConflicts(res.conflicts))
        .catch(() => !cancelled && setConflicts([]));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, complete, payload, schedule?.id]);

  const blockingConflicts = conflicts.filter((conflict) => conflict.kind !== "CAPACITY");
  const capacityWarning = conflicts.find((conflict) => conflict.kind === "CAPACITY");

  const saveMutation = useMutation({
    mutationFn: (force: boolean) =>
      isEdit
        ? api.patch(`/app/lesson-schedules/${schedule!.id}`, { ...payload, roomId: form.roomId || null, subject: form.subject.trim() || null, force: force || undefined })
        : api.post("/app/lesson-schedules", { ...payload, force: force || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-schedules", slug] });
      queryClient.invalidateQueries({ queryKey: ["rooms", slug] });
      onClose();
    },
    onError: (err) => {
      // Shu orada boshqa admin band qilib qo'ygan bo'lishi mumkin — server ro'yxatini ko'rsatamiz
      const details = err instanceof ApiError ? (err.details as { conflicts?: ScheduleConflict[] } | undefined) : undefined;
      if (err instanceof ApiError && err.status === 409 && details?.conflicts) {
        setConflicts(details.conflicts);
        return;
      }
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/app/lesson-schedules/${schedule!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-schedules", slug] });
      queryClient.invalidateQueries({ queryKey: ["rooms", slug] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const busy = saveMutation.isPending || deleteMutation.isPending;
  const submit = (force: boolean) => {
    if (!complete) {
      setShowMissing(true);
      return;
    }
    saveMutation.mutate(force);
  };

  const groupOptions = groups.map((group) => ({ id: group.id, label: tr(group.name), hint: group._count?.children !== undefined ? tr("{0} bola", group._count.children) : undefined }));
  const employeeOptions = employees.map((employee) => ({ id: employee.id, label: tr(employee.fullName), hint: tr(employee.position) }));
  const roomOptions = rooms
    .filter((room) => room.isActive || room.id === form.roomId)
    .map((room) => ({
      id: room.id,
      label: tr(room.name),
      hint: [room.capacity ? tr("{0} kishilik", room.capacity) : null, room.isActive ? null : tr("ishlatilmaydi")].filter(Boolean).join(" · ") || undefined,
    }));

  const footer = confirmDelete ? (
    <div className="space-y-2.5">
      <p className={DANGER_BOX}>{tr("Dars jadvaldan o'chiriladi. Davomat tarixi saqlanib qoladi.")}</p>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <SheetSecondaryButton onClick={() => setConfirmDelete(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
        </div>
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
        >
          {tr("O'chirish")}
        </button>
      </div>
    </div>
  ) : (
    <>
      {blockingConflicts.length > 0 ? (
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
        >
          {tr("Baribir saqlash")}
        </button>
      ) : (
        <SheetPrimaryButton type="submit" form={formId} loading={saveMutation.isPending} dim={!complete}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      )}
      {isEdit && (
        <SheetSecondaryButton danger onClick={() => setConfirmDelete(true)}>
          {tr("Darsni o'chirish")}
        </SheetSecondaryButton>
      )}
    </>
  );

  return (
    <IosSheet open={open} onClose={() => !busy && onClose()} title={isEdit ? tr("Darsni tahrirlash") : tr("Yangi dars")} footer={footer}>
      <form
        id={formId}
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
      >
        {serverError && (
          <p role="alert" className={DANGER_BOX}>
            {tr(serverError)}
          </p>
        )}

        <FormSection>
          <FieldRow label={tr("Guruh")} error={showMissing && missing.groupId ? "Guruhni tanlang" : undefined}>
            <OptionPicker title={tr("Guruh")} value={form.groupId} onChange={(v) => set("groupId", v)} options={groupOptions} loading={loading} placeholder={tr("Tanlang")} emptyHint="Hali guruh yo'q" />
          </FieldRow>
          <FieldRow label={tr("O'qituvchi")} error={showMissing && missing.employeeId ? "O'qituvchini tanlang" : undefined}>
            <OptionPicker title={tr("O'qituvchi")} value={form.employeeId} onChange={(v) => set("employeeId", v)} options={employeeOptions} loading={loading} placeholder={tr("Tanlang")} emptyHint="Xodim topilmadi" />
          </FieldRow>
          <FieldRow label={tr("Xona")}>
            <OptionPicker
              title={tr("Xona")}
              value={form.roomId}
              onChange={(v) => set("roomId", v)}
              options={roomOptions}
              loading={loading}
              placeholder={tr("Xonasiz")}
              emptyOption={tr("Xonasiz")}
              emptyHint="Xonalar «Xonalar» bo'limida qo'shiladi"
            />
          </FieldRow>
          <FieldRow label={tr("Fan")} htmlFor={`${formId}-subject`}>
            <TextInput
              id={`${formId}-subject`}
              list={`${formId}-subjects`}
              value={form.subject}
              onChange={(event) => set("subject", event.target.value)}
              placeholder={tr("Ixtiyoriy")}
              className="text-right"
            />
            <datalist id={`${formId}-subjects`}>
              {(subjectsQuery.data ?? []).map((subject) => (
                <option key={subject.id} value={subject.name} />
              ))}
            </datalist>
          </FieldRow>
        </FormSection>

        <FormSection
          title={tr("Hafta kunlari")}
          footer={isEdit ? tr("Bir nechta kun tanlansa — har biriga shu dars qo'yiladi") : undefined}
        >
          <div className={clsx("flex flex-wrap gap-2 px-4 py-3", showMissing && missing.weekdays && "bg-[#ff3b30]/[0.06]")} role="group" aria-label={tr("Hafta kunlari")}>
            {WEEKDAY_ORDER.map((day) => {
              const active = form.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={active}
                  aria-label={tr(WEEKDAY_LABEL[day])}
                  onClick={() => set("weekdays", active ? form.weekdays.filter((d) => d !== day) : WEEKDAY_ORDER.filter((d) => d === day || form.weekdays.includes(d)))}
                  className={clsx(
                    "h-10 w-11 rounded-full text-[14px] font-semibold transition-[transform,background-color] active:scale-[0.94]",
                    active ? "bg-[var(--color-primary)] text-white" : "bg-[#767680]/[0.12] text-[var(--color-text)]",
                  )}
                >
                  {tr(WEEKDAY_SHORT[day])}
                </button>
              );
            })}
          </div>
          {showMissing && missing.weekdays && <p className="px-4 pb-3 text-[12.5px] text-[#ff3b30]">{tr("Kamida bitta hafta kunini tanlang")}</p>}
        </FormSection>

        <FormSection>
          <FieldRow label={tr("Boshlanishi")} htmlFor={`${formId}-start`}>
            <div className="flex justify-end">
              <TextInput id={`${formId}-start`} type="time" value={form.startTime} onChange={(event) => set("startTime", event.target.value)} className="!w-auto text-right tabular-nums" />
            </div>
          </FieldRow>
          <FieldRow label={tr("Tugashi")} htmlFor={`${formId}-end`} error={showMissing && missing.time ? "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak" : undefined}>
            <div className="flex justify-end">
              <TextInput id={`${formId}-end`} type="time" value={form.endTime} onChange={(event) => set("endTime", event.target.value)} className="!w-auto text-right tabular-nums" />
            </div>
          </FieldRow>
        </FormSection>

        {blockingConflicts.length > 0 && (
          <div role="alert" className={DANGER_BOX}>
            <p className="font-semibold">{tr("Jadvalda to'qnashuv bor")}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {blockingConflicts.map((conflict, index) => (
                <li key={index}>{tr(conflict.message)}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12.5px] opacity-80">{tr("Vaqt yoki xonani o'zgartiring. Kerak bo'lsa «Baribir saqlash» bilan saqlashingiz mumkin.")}</p>
          </div>
        )}
        {capacityWarning && (
          <p className={WARN_BOX} style={{ color: "#c93400" }}>
            <span className="font-semibold" style={{ color: IOS.orange }}>
              {tr("Xona tor")}:{" "}
            </span>
            {tr(capacityWarning.message)}
          </p>
        )}
      </form>
    </IosSheet>
  );
}
