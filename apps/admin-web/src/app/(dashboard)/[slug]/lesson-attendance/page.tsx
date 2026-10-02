"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CalendarIcon, CheckIcon, ChecklistIcon, ClockIcon } from "@/components/ui/icons";
import {
  EmptyRow,
  Group,
  LargeTitle,
  PrimaryButton,
  Row,
  Segmented,
  SkeletonRows,
  TeacherPage,
  FloatingBar,
  formatDayLong,
  formatDayShort,
} from "@/features/teacher/teacher-ui";
import { useTr } from "@/i18n/tr";

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

export default function LessonAttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
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

  const children = dayQuery.data?.children ?? [];
  const present = children.filter((c) => statusFor(c.childId) === "PRESENT").length;
  const unsaved = children.filter((c) => c.status !== statusFor(c.childId)).length;
  const isToday = date === todayDateString();

  // Faqat fan o'qituvchisi ochadi — tarbiyachi kabinetining iOS uslubida
  return (
    <TeacherPage className="pb-4">
      <LargeTitle
        eyebrow={date ? formatDayLong(date) : " "}
        title={tr("Davomat")}
        trailing={
          <label className="relative flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3.5 text-[15px] font-medium text-[var(--color-primary)] shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-transform active:scale-95">
            <CalendarIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            {date ? (isToday ? "Bugun" : formatDayShort(date)) : "…"}
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label={tr("Sanani tanlash")}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        }
      />

      {!date || lessonsQuery.isLoading ? (
        <Group>
          <SkeletonRows rows={3} />
        </Group>
      ) : lessonsQuery.isError ? (
        <Group>
          <EmptyRow title={tr("Yuklab bo'lmadi")} description={tr((lessonsQuery.error as Error).message)} />
        </Group>
      ) : !lessons || lessons.length === 0 ? (
        <Group>
          <EmptyRow icon={ClockIcon} title={tr("Bu kunda darsingiz yo'q")} description={tr("Dars jadvalida sizga dars belgilanganda shu yerda ko'rinadi")} />
        </Group>
      ) : (
        <>
          {/* Darslar — bittasini tanlang (hozirgi dars o'zi tanlanadi) */}
          <Group title={tr("Darslar")}>
            {lessons.map((lesson, i) => {
              const active = lesson.scheduleId === scheduleId;
              return (
                <Row
                  key={lesson.scheduleId}
                  first={i === 0}
                  onClick={() => setScheduleId(lesson.scheduleId)}
                  chevron={false}
                  leading={
                    <span className="flex w-[40px] shrink-0 flex-col items-start leading-tight tabular-nums">
                      <span className="text-[15px] font-semibold text-[var(--color-text)]">{tr(lesson.startTime)}</span>
                      <span className="text-[12.5px] text-[var(--color-text-muted)]">{tr(lesson.endTime)}</span>
                    </span>
                  }
                  title={lesson.subject || "Dars"}
                  subtitle={tr(lesson.groupName)}
                  trailing={active ? <CheckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} /> : undefined}
                />
              );
            })}
          </Group>

          {!selectedLesson || dayQuery.isLoading ? (
            <Group>
              <SkeletonRows rows={5} />
            </Group>
          ) : dayQuery.isError ? (
            <Group>
              <EmptyRow title={tr("Yuklab bo'lmadi")} description={tr((dayQuery.error as Error).message)} />
            </Group>
          ) : children.length === 0 ? (
            <Group>
              <EmptyRow icon={ChecklistIcon} title={tr("Bu guruhda faol bola yo'q")} />
            </Group>
          ) : (
            <Group
              title={`${selectedLesson.groupName} · ${present}/${children.length}`}
              footer={tr("Hamma «Keldi» bo'lib ochiladi — faqat kelmaganlarni belgilab, «Saqlash»ni bosing.")}
            >
              {children.map((child, i) => (
                <div key={child.childId} className="relative flex items-center gap-3 px-4 py-2.5">
                  {i > 0 && <span className="absolute left-4 right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
                  <p className="min-w-0 flex-1 truncate text-[16px] text-[var(--color-text)]">{tr(child.fullName)}</p>
                  <Segmented
                    size="sm"
                    className="w-[168px] shrink-0"
                    label={`${child.fullName} — holat`}
                    value={statusFor(child.childId)}
                    onChange={(value) => setLocalStatuses((st) => ({ ...st, [child.childId]: value }))}
                    options={[
                      { value: "PRESENT", label: "Keldi", tint: "var(--color-success)" },
                      { value: "ABSENT", label: "Kelmadi", tint: "var(--color-danger)" },
                    ]}
                  />
                </div>
              ))}
            </Group>
          )}

        </>
      )}
      {children.length > 0 && (
        <FloatingBar>
          <PrimaryButton loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} disabled={unsaved === 0 && saveMutation.isSuccess}>
            {saveMutation.isPending ? (
              "Saqlanmoqda…"
            ) : unsaved === 0 && saveMutation.isSuccess ? (
              <>
                <CheckIcon className="h-5 w-5" strokeWidth={2.6} /> {tr("Saqlandi")}
              </>
            ) : (
              "Saqlash"
            )}
          </PrimaryButton>
          {saveMutation.isError && (
            <p className="mt-1.5 text-center text-[13px] font-medium text-[var(--color-danger)]">
              {(saveMutation.error as Error).message || tr("Saqlashda xatolik yuz berdi")}
            </p>
          )}
        </FloatingBar>
      )}
    </TeacherPage>
  );
}
