"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group, LessonSchedule, Weekday } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import clsx from "clsx";

const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: "MONDAY", label: "Dushanba" },
  { value: "TUESDAY", label: "Seshanba" },
  { value: "WEDNESDAY", label: "Chorshanba" },
  { value: "THURSDAY", label: "Payshanba" },
  { value: "FRIDAY", label: "Juma" },
  { value: "SATURDAY", label: "Shanba" },
  { value: "SUNDAY", label: "Yakshanba" },
];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

const schema = z
  .object({
    groupId: z.string().min(1, "Guruhni tanlang"),
    employeeId: z.string().min(1, "Xodimni tanlang"),
    subject: z.string().optional(),
    weekdays: z
      .array(z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]))
      .min(1, "Kamida bitta hafta kunini tanlang"),
    startTime: z.string().regex(TIME_REGEX, "Vaqt HH:mm formatida bo'lishi kerak"),
    endTime: z.string().regex(TIME_REGEX, "Vaqt HH:mm formatida bo'lishi kerak"),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak",
    path: ["endTime"],
  });

type FormValues = z.infer<typeof schema>;

export function LessonScheduleModal({
  open,
  onClose,
  slug,
  branchId,
  groupId,
  schedule,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  /** NETWORK_ADMIN filial ichiga kirganda kerak — boshqa rollarda scope o'zi biladi. */
  branchId: string | null;
  /** Sahifada tanlangan guruh — yangi yozuvda sukut qiymat sifatida. */
  groupId: string;
  /** Tahrirlash uchun — bo'lmasa yangi yozuv yaratiladi. */
  schedule?: LessonSchedule | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!schedule;

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, branchId],
    queryFn: () => api.get<Group[]>(`/app/groups${branchId ? `?branchId=${branchId}` : ""}`),
    enabled: open,
  });
  const employeesQuery = useQuery({
    queryKey: ["employees", slug, branchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${branchId ? `?branchId=${branchId}` : ""}`),
    enabled: open,
  });
  // Guruhi qanday bo'lishidan qat'i nazar — bitta o'qituvchi bir vaqtda ikkita
  // darsga yozilib qolmasin (band bo'lsa saqlash tugmasi o'chadi; server ham rad etadi).
  const allSchedulesQuery = useQuery({
    queryKey: ["lesson-schedules", slug, branchId, "all"],
    queryFn: () => api.get<LessonSchedule[]>(`/app/lesson-schedules${branchId ? `?branchId=${branchId}` : ""}`),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      groupId: schedule?.groupId ?? groupId,
      employeeId: schedule?.employeeId ?? "",
      subject: schedule?.subject ?? "",
      weekdays: schedule ? [schedule.weekday] : ["MONDAY"],
      startTime: schedule?.startTime ?? "09:00",
      endTime: schedule?.endTime ?? "09:45",
    },
  });

  useEffect(() => {
    if (open) setServerError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: ({ weekdays, ...values }: FormValues): Promise<unknown> => {
      const subject = values.subject || undefined;
      // Tahrirlashda bitta yozuv = bitta kun; yangi darsda tanlangan hamma kunlar birdan yaratiladi.
      return isEdit
        ? api.patch<LessonSchedule>(`/app/lesson-schedules/${schedule!.id}`, { ...values, subject, weekday: weekdays[0] })
        : api.post<LessonSchedule[]>("/app/lesson-schedules", { ...values, subject, weekdays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-schedules", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const handleClose = () => {
    setServerError(null);
    onClose();
  };

  const groups = groupsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

  const watchEmployeeId = watch("employeeId");
  const watchWeekdays = watch("weekdays");
  const watchStartTime = watch("startTime");
  const watchEndTime = watch("endTime");

  const teacherConflicts = (() => {
    if (!watchEmployeeId || !TIME_REGEX.test(watchStartTime) || !TIME_REGEX.test(watchEndTime)) return [];
    const startMinutes = timeToMinutes(watchStartTime);
    const endMinutes = timeToMinutes(watchEndTime);
    if (endMinutes <= startMinutes) return [];
    return (allSchedulesQuery.data ?? []).filter((row) => {
      if (row.id === schedule?.id) return false;
      if (row.employeeId !== watchEmployeeId || !watchWeekdays.includes(row.weekday)) return false;
      const rowStart = timeToMinutes(row.startTime);
      const rowEnd = timeToMinutes(row.endTime);
      return startMinutes < rowEnd && rowStart < endMinutes;
    });
  })();

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Darsni tahrirlash" : "Yangi dars"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="font-heading text-center text-[28px] font-extrabold tracking-tight text-[var(--color-primary)]">
          Vista Academy
        </h1>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <Select label="Guruh" error={errors.groupId?.message} {...register("groupId")}>
          <option value="">Tanlang</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>

        <Select label="Xodim (o'qituvchi)" error={errors.employeeId?.message} {...register("employeeId")}>
          <option value="">Tanlang</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </Select>

        <div>
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">
            {isEdit ? "Hafta kuni" : "Hafta kunlari"}
          </span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((option) => {
              const selected = watchWeekdays.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    const next = isEdit
                      ? [option.value]
                      : selected
                        ? watchWeekdays.filter((day) => day !== option.value)
                        : [...watchWeekdays, option.value];
                    setValue("weekdays", next, { shouldValidate: true, shouldDirty: true });
                  }}
                  className={clsx(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition-colors",
                    selected
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border-hair)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]",
                  )}
                >
                  {selected && <CheckIcon className="h-4 w-4" />}
                  {option.label}
                </button>
              );
            })}
          </div>
          {errors.weekdays?.message && (
            <p className="mt-1.5 text-[13px] text-[var(--color-danger)]">{errors.weekdays.message}</p>
          )}
        </div>

        <Input label="Fan (ixtiyoriy)" placeholder="Ingliz tili" {...register("subject")} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Boshlanish vaqti" type="time" error={errors.startTime?.message} {...register("startTime")} />
          <Input label="Tugash vaqti" type="time" error={errors.endTime?.message} {...register("endTime")} />
        </div>

        {teacherConflicts.length > 0 && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            Bu o&apos;qituvchi shu vaqtda band:{" "}
            {teacherConflicts
              .map(
                (row) =>
                  `${WEEKDAY_OPTIONS.find((o) => o.value === row.weekday)?.label}, ${row.group.name} guruhi, ${row.startTime}–${row.endTime}`,
              )
              .join("; ")}
            .
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending} disabled={teacherConflicts.length > 0}>
            {isEdit ? "Saqlash" : "Yaratish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
