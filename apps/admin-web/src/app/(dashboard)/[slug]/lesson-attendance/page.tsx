"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

type LessonStatus = "PRESENT" | "ABSENT";

interface MyLesson {
  scheduleId: string;
  groupId: string;
  groupName: string;
  subject: string | null;
  startTime: string;
  endTime: string;
}

interface MyLessonsResponse {
  date: string;
  lessons: MyLesson[];
}

interface LessonAttendanceDay {
  scheduleId: string;
  date: string;
  children: { childId: string; fullName: string; status: LessonStatus | null }[];
}

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function nowTimeString(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: DEFAULT_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(
    new Date(),
  );
}

/** Bugun bo'lsa — hozir davom etayotgan dars, bo'lmasa keyingisi, u ham bo'lmasa oxirgisi. */
function pickCurrentLesson(lessons: MyLesson[], date: string): MyLesson | null {
  if (lessons.length === 0) return null;
  if (date !== todayDateString()) return lessons[0];
  const now = nowTimeString();
  return (
    lessons.find((l) => l.startTime <= now && now <= l.endTime) ??
    lessons.find((l) => l.startTime > now) ??
    lessons[lessons.length - 1]
  );
}

function lessonLabel(lesson: MyLesson): string {
  return `${lesson.startTime}–${lesson.endTime} · ${lesson.groupName}${lesson.subject ? ` · ${lesson.subject}` : ""}`;
}

export default function LessonAttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  // "Bugun" mijoz soatiga bog'liq — server va brauzer render'i mos kelishi
  // uchun effektda hisoblanadi.
  const [date, setDate] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [localStatuses, setLocalStatuses] = useState<Record<string, LessonStatus>>({});

  useEffect(() => {
    setDate((current) => current || todayDateString());
  }, []);

  const lessonsQuery = useQuery({
    queryKey: ["my-lessons-today", slug, date],
    queryFn: () => api.get<MyLessonsResponse>(`/app/lesson-attendance/my-lessons?date=${date}`),
    enabled: !!date,
  });
  const lessons = lessonsQuery.data?.lessons;

  // Sana almashganda yoki darslar yuklanganda mos darsni o'zi tanlaydi;
  // foydalanuvchi qo'lda boshqasini tanlagan bo'lsa (u ro'yxatda bo'lsa) tegmaydi.
  useEffect(() => {
    if (!lessons || !date) return;
    if (lessons.some((l) => l.scheduleId === scheduleId)) return;
    setScheduleId(pickCurrentLesson(lessons, date)?.scheduleId ?? "");
  }, [lessons, date, scheduleId]);

  const selectedLesson = lessons?.find((l) => l.scheduleId === scheduleId) ?? null;

  const dayQuery = useQuery({
    queryKey: ["lesson-attendance", slug, scheduleId, date],
    queryFn: () => api.get<LessonAttendanceDay>(`/app/lesson-attendance?scheduleId=${scheduleId}&date=${date}`),
    enabled: !!scheduleId && !!date,
  });

  // Sahifa ochilganda hamma bola "Keldi" (hali saqlanmagan) — Kunlik davomat sahifasidagi
  // kabi: faqat kelmaganlarni o'zgartirib, oxirida "Saqlash" bosiladi.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dayQuery.data || dayQuery.data.date !== date || dayQuery.data.scheduleId !== scheduleId) return;
    const key = `${scheduleId}_${date}`;
    if (initializedForRef.current === key) return;
    initializedForRef.current = key;
    setLocalStatuses(Object.fromEntries(dayQuery.data.children.map((c) => [c.childId, c.status ?? "PRESENT"])));
  }, [dayQuery.data, scheduleId, date]);
  const statusFor = (childId: string): LessonStatus => localStatuses[childId] ?? "PRESENT";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dayQuery.data) return;
      await Promise.all(
        dayQuery.data.children.map((child) =>
          api.post("/app/lesson-attendance", {
            scheduleId,
            childId: child.childId,
            date,
            status: statusFor(child.childId),
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-attendance", slug, scheduleId, date] });
    },
  });

  // Dars yoki sana almashganda oldingi "Saqlandi"/xatolik xabari qolib ketmasin.
  useEffect(() => {
    saveMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, date]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
          Davomat
        </h1>
        <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
          O&apos;z darsingiz bo&apos;yicha bolalarning qatnashuvini belgilang
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">Sana</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] sm:w-auto"
          />
        </div>
        {lessons && lessons.length > 0 && (
          <Select label="Dars" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className="sm:max-w-md">
            {lessons.map((lesson) => (
              <option key={lesson.scheduleId} value={lesson.scheduleId}>
                {lessonLabel(lesson)}
              </option>
            ))}
          </Select>
        )}
      </Card>

      {!date || lessonsQuery.isLoading ? (
        <LoadingState />
      ) : lessonsQuery.isError ? (
        <ErrorState message={(lessonsQuery.error as Error).message} />
      ) : !lessons || lessons.length === 0 ? (
        <EmptyState
          title="Bu kunda darsingiz yo'q"
          description="Dars jadvalida sizga dars belgilanganda shu yerda ko'rinadi"
        />
      ) : !selectedLesson || dayQuery.isLoading ? (
        <LoadingState />
      ) : dayQuery.isError ? (
        <ErrorState message={(dayQuery.error as Error).message} />
      ) : !dayQuery.data || dayQuery.data.children.length === 0 ? (
        <EmptyState title="Bu guruhda faol bola yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--color-separator)] px-5 py-3 text-[14px] text-[var(--color-text-muted)]">
            {lessonLabel(selectedLesson)}
          </div>
          <ul className="divide-y divide-[var(--color-separator)]">
            {dayQuery.data.children.map((child) => (
              <li key={child.childId} className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3">
                <p className="text-sm font-medium text-[var(--color-text)]">{child.fullName}</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={statusFor(child.childId) === "PRESENT" ? "primary" : "tertiary"}
                    className={clsx(statusFor(child.childId) === "PRESENT" && "bg-[var(--color-success)] hover:opacity-90")}
                    onClick={() => setLocalStatuses((s) => ({ ...s, [child.childId]: "PRESENT" }))}
                  >
                    Keldi
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFor(child.childId) === "ABSENT" ? "danger" : "tertiary"}
                    onClick={() => setLocalStatuses((s) => ({ ...s, [child.childId]: "ABSENT" }))}
                  >
                    Kelmadi
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 sm:px-6">
            {saveMutation.isError && (
              <span className="text-[13px] text-[var(--color-danger)]">
                {(saveMutation.error as Error).message || "Saqlashda xatolik yuz berdi"}
              </span>
            )}
            {saveMutation.isSuccess && !saveMutation.isPending && (
              <span className="text-[13px] text-[var(--color-success)]">Saqlandi</span>
            )}
            <Button className="ml-auto" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Saqlash
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
