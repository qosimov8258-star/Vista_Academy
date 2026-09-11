"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group, LessonSchedule, Room, Weekday } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

const schema = z
  .object({
    groupId: z.string().min(1, "Guruhni tanlang"),
    employeeId: z.string().min(1, "Xodimni tanlang"),
    roomId: z.string().min(1, "Xonani tanlang"),
    subject: z.string().optional(),
    weekday: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
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
  const roomsQuery = useQuery({
    queryKey: ["rooms", slug, branchId],
    queryFn: () => api.get<Room[]>(`/app/rooms${branchId ? `?branchId=${branchId}` : ""}`),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      groupId: schedule?.groupId ?? groupId,
      employeeId: schedule?.employeeId ?? "",
      roomId: schedule?.roomId ?? "",
      subject: schedule?.subject ?? "",
      weekday: schedule?.weekday ?? "MONDAY",
      startTime: schedule?.startTime ?? "09:00",
      endTime: schedule?.endTime ?? "09:45",
    },
  });

  useEffect(() => {
    if (open) setServerError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { ...values, subject: values.subject || undefined };
      return isEdit
        ? api.patch<LessonSchedule>(`/app/lesson-schedules/${schedule!.id}`, payload)
        : api.post<LessonSchedule>("/app/lesson-schedules", payload);
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
  const rooms = roomsQuery.data ?? [];

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Darsni tahrirlash" : "Yangi dars"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Xona" error={errors.roomId?.message} {...register("roomId")}>
            <option value="">Tanlang</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </Select>
          <Select label="Hafta kuni" error={errors.weekday?.message} {...register("weekday")}>
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <Input label="Fan (ixtiyoriy)" placeholder="Ingliz tili" {...register("subject")} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Boshlanish vaqti" type="time" error={errors.startTime?.message} {...register("startTime")} />
          <Input label="Tugash vaqti" type="time" error={errors.endTime?.message} {...register("endTime")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Saqlash" : "Yaratish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
