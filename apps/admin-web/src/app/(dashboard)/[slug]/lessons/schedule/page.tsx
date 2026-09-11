"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { LessonSchedule, Group, Weekday } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClockIcon, DoorIcon, PencilIcon, TeacherIcon, TrashIcon } from "@/components/ui/icons";
import { LessonScheduleModal } from "@/features/lessons/lesson-schedule-modal";
import { ManageRoomsModal } from "@/features/lessons/manage-rooms-modal";

const WEEKDAY_ORDER: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: "Dushanba",
  TUESDAY: "Seshanba",
  WEDNESDAY: "Chorshanba",
  THURSDAY: "Payshanba",
  FRIDAY: "Juma",
  SATURDAY: "Shanba",
  SUNDAY: "Yakshanba",
};

export default function LessonSchedulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [groupId, setGroupId] = useState("");
  const [scheduleModal, setScheduleModal] = useState<{ open: boolean; schedule: LessonSchedule | null }>({
    open: false,
    schedule: null,
  });
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<LessonSchedule | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const groups = groupsQuery.data ?? [];

  useEffect(() => {
    if (!groupId && groups.length > 0) {
      setGroupId(groups[0].id);
    }
  }, [groupId, groups]);

  const scheduleQuery = useQuery({
    queryKey: ["lesson-schedules", slug, groupId, forcedBranchId],
    queryFn: () =>
      api.get<LessonSchedule[]>(
        `/app/lesson-schedules?groupId=${groupId}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    enabled: !!groupId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/lesson-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-schedules", slug] });
      setDeleting(null);
    },
    onError: (err) => setDeleteError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi"),
  });

  const byWeekday = new Map<Weekday, LessonSchedule[]>();
  for (const item of scheduleQuery.data ?? []) {
    const list = byWeekday.get(item.weekday) ?? [];
    list.push(item);
    byWeekday.set(item.weekday, list);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Dars jadvali
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            Guruh darslari qaysi xonada, qaysi kunda va soatda o&apos;tishi
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRoomsModalOpen(true)}>
              Xonalarni boshqarish
            </Button>
            <Button
              onClick={() => setScheduleModal({ open: true, schedule: null })}
              disabled={!groupId}
            >
              + Yangi dars
            </Button>
          </div>
        )}
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="p-4">
        {groupsQuery.isLoading ? (
          <LoadingState rows={1} />
        ) : groups.length === 0 ? (
          <p className="text-[14px] text-[var(--color-text-muted)]">Hali guruh yo&apos;q</p>
        ) : (
          <Select
            label="Guruh"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="sm:max-w-xs"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        )}
      </Card>

      {!groupId ? (
        groupsQuery.isLoading ? (
          <LoadingState />
        ) : (
          <EmptyState title="Guruh tanlanmagan" description="Avval yuqoridan guruhni tanlang" />
        )
      ) : scheduleQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : scheduleQuery.isError ? (
        <ErrorState message={(scheduleQuery.error as Error).message} />
      ) : !scheduleQuery.data || scheduleQuery.data.length === 0 ? (
        <EmptyState
          title="Dars jadvali bo'sh"
          description={canWrite ? "\"+ Yangi dars\" tugmasi orqali qo'shing" : "Hali dars jadvali belgilanmagan"}
        />
      ) : (
        <div className="space-y-4">
          {WEEKDAY_ORDER.filter((day) => byWeekday.has(day)).map((day) => (
            <Card key={day} className="overflow-hidden">
              <div className="border-b border-[var(--color-separator)] px-5 py-3">
                <h2 className="text-[14px] font-semibold text-[var(--color-text)]">{WEEKDAY_LABEL[day]}</h2>
              </div>
              <ul className="divide-y divide-[var(--color-separator)]">
                {byWeekday.get(day)!.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      <ClockIcon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {item.startTime} — {item.endTime}
                        {item.subject && <span className="text-[var(--color-text-muted)]"> · {item.subject}</span>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <DoorIcon className="h-3.5 w-3.5" />
                          {item.room.name}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <TeacherIcon className="h-3.5 w-3.5" />
                          {item.employee.fullName}
                        </span>
                      </p>
                    </div>
                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setScheduleModal({ open: true, schedule: item })}
                          aria-label="Tahrirlash"
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(item);
                          }}
                          aria-label="O'chirish"
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {canWrite && groupId && (
        <LessonScheduleModal
          open={scheduleModal.open}
          onClose={() => setScheduleModal({ open: false, schedule: null })}
          slug={slug}
          branchId={forcedBranchId}
          groupId={groupId}
          schedule={scheduleModal.schedule}
        />
      )}

      {canWrite && <ManageRoomsModal open={roomsModalOpen} onClose={() => setRoomsModalOpen(false)} slug={slug} branchId={forcedBranchId} />}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Darsni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteError}
        description={
          deleting && (
            <>
              <b className="text-[var(--color-text)]">
                {WEEKDAY_LABEL[deleting.weekday]}, {deleting.startTime}–{deleting.endTime}
              </b>{" "}
              dars jadvalidan o&apos;chiriladi.
            </>
          )
        }
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
