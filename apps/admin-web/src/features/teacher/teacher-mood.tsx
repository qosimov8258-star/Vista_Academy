"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Meh, Smile } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AttendanceDay, DailyReportChild, DailyReportDay, MoodStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { canWriteTeaching } from "@/lib/permissions";
import { isAssistantPosition } from "@/lib/employee-position";
import { useBranchContext } from "@/lib/use-branch-context";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { CheckIcon } from "@/components/ios/icons";
import { IOS } from "@/components/ios/tokens";
import { DayStepper } from "@/components/ios/day-stepper";
import { EmptyRow, FloatingBar, Group, LargeTitle, PrimaryButton, SkeletonRows, TeacherPage, formatDayLong, todayIso } from "./teacher-ui";
import { useTr } from "@/i18n/tr";

/** Tarbiyachi tanlaydigan ikki holat — kundalik hisobotning `mood` maydoniga yoziladi */
type MoodChoice = Extract<MoodStatus, "HAPPY" | "NEUTRAL">;

const MOODS: { value: MoodChoice; label: string; color: string; icon: typeof Smile }[] = [
  { value: "HAPPY", label: "Yaxshi", color: IOS.green, icon: Smile },
  { value: "NEUTRAL", label: "O'rtacha", color: IOS.orange, icon: Meh },
];

/** Davomatdan: kelmagan yoki kasal bola qatorida kichik izoh */
const ABSENCE_LABEL: Partial<Record<NonNullable<AttendanceDay["children"][number]["status"]>, string>> = {
  ABSENT: "Kelmadi",
  SICK: "Kasal",
};

/**
 * Kayfiyat belgilash — tarbiyachi uchun, davomat sahifasi uslubida. Guruhdagi
 * har bola qatorida ikki katta tugma: «Yaxshi» / «O'rtacha» (tanlangani qayta
 * bosilsa — belgi olinadi). Belgilanmagan bola tegilmaydi. Pastdagi «Saqlash»
 * faqat o'zgargan bolalarni kundalik hisobotga yozadi (`POST /app/daily-reports`
 * faqat `mood` bilan — ovqatlanish va boshqa maydonlar o'zgarmaydi); ota-ona
 * kabinetida shu kayfiyat ko'rinadi.
 */
export function TeacherMood({ slug }: { slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const branchId = forcedBranchId ?? user?.branchId ?? "";
  // Yordamchi faqat ko'radi — belgilash tarbiyachiniki (API ham shunday)
  const canWrite = canWriteTeaching(user?.role) && !(user?.position && isAssistantPosition(user.position));

  // "Bugun" foydalanuvchi soatiga bog'liq — server va brauzer farq qilmasin
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const t = todayIso();
    setToday(t);
    setDate((d) => d || t);
  }, []);

  const reportsQuery = useQuery({
    queryKey: ["daily-reports", slug, branchId, date],
    queryFn: () => api.get<DailyReportDay>(`/app/daily-reports?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
  });
  // Davomat bilan bir xil kalit — bola surati va kelmaganlar shu yerdan
  const attendanceQuery = useQuery({
    queryKey: ["attendance", slug, branchId, date],
    queryFn: () => api.get<AttendanceDay>(`/app/attendance?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
  });
  const attendanceByChild = new Map((attendanceQuery.data?.children ?? []).map((c) => [c.childId, c]));

  // Faqat shu sahifada o'zgartirilgan (hali saqlanmagan) bolalar; null — belgi olib tashlangan
  const [local, setLocal] = useState<Record<string, MoodChoice | null>>({});
  const children = reportsQuery.data?.children ?? [];
  const serverMood = (c: DailyReportChild): MoodStatus | null => c.report?.mood ?? null;
  const moodFor = (c: DailyReportChild): MoodStatus | null => (c.childId in local ? local[c.childId] : serverMood(c));
  const isChanged = (c: DailyReportChild) => c.childId in local && local[c.childId] !== serverMood(c);
  const changed = children.filter(isChanged);

  const toggle = (c: DailyReportChild, value: MoodChoice) => {
    const next = moodFor(c) === value ? null : value;
    setLocal((s) => ({ ...s, [c.childId]: next }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        changed.map((c) => api.post("/app/daily-reports", { childId: c.childId, date, mood: local[c.childId] })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw new Error(tr("Saqlashda xatolik — qayta urinib ko'ring"));
    },
    // Yangi ma'lumot kelgach tozalanadi — orada tanlov eski holatga «sakrab» qaytmasin
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["daily-reports", slug] });
      setLocal({});
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["daily-reports", slug] }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] }),
  });

  useEffect(() => {
    saveMutation.reset();
    setLocal({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchId]);

  // Guruhlar bo'yicha (API guruh nomi, keyin ism bo'yicha tartiblab beradi)
  const groups: { name: string | null; rows: DailyReportChild[] }[] = [];
  for (const child of children) {
    const last = groups[groups.length - 1];
    if (last && last.name === child.groupName) last.rows.push(child);
    else groups.push({ name: child.groupName, rows: [child] });
  }

  const showSaveBar = canWrite && children.length > 0 && (changed.length > 0 || saveMutation.isPending || saveMutation.isSuccess || saveMutation.isError);

  return (
    <TeacherPage className="pb-4">
      <LargeTitle icon={Smile} tint="green" eyebrow={date ? formatDayLong(date) : " "} title={tr("Kayfiyat belgilash")} />

      {date && today && <DayStepper value={date} onChange={setDate} today={today} max={today} />}

      {!date || reportsQuery.isLoading || (!branchId && !user) ? (
        <Group title={tr("Bolalar")}>
          <SkeletonRows rows={6} />
        </Group>
      ) : reportsQuery.isError ? (
        <Group>
          <EmptyRow title={tr("Yuklab bo'lmadi")} description={tr((reportsQuery.error as Error).message)} />
        </Group>
      ) : children.length === 0 ? (
        <Group>
          <EmptyRow icon={Smile} title={tr("Guruhda faol bola yo'q")} />
        </Group>
      ) : (
        groups.map((group) => (
          <Group
            key={group.name ?? "-"}
            title={group.name ? tr(group.name) : tr("Guruhsiz")}
            action={<span className="text-[13px] tabular-nums text-[#8e8e93]">{group.rows.length}</span>}
          >
            {group.rows.map((child, i) => {
              const mood = moodFor(child);
              const att = attendanceByChild.get(child.childId);
              const absence = att?.status ? ABSENCE_LABEL[att.status] : undefined;
              return (
                <div key={child.childId} className="relative px-4 py-3">
                  {i > 0 && <span className="absolute left-[72px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
                  <div className="flex items-center gap-3.5">
                    <span className="relative shrink-0">
                      <ChildPhoto
                        child={{ id: child.childId, fullName: child.fullName, gender: att?.gender ?? null, avatarUpdatedAt: att?.avatarUpdatedAt ?? null }}
                        size={44}
                        fallback={initials(child.fullName)}
                      />
                      {canWrite && isChanged(child) && (
                        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--color-primary)]" aria-label={tr("Saqlanmagan")} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] leading-snug text-[var(--color-text)]">{tr(child.fullName)}</span>
                      {absence && <span className="mt-0.5 block truncate text-[13px] leading-snug text-[var(--color-danger)]">{tr(absence)}</span>}
                    </span>
                  </div>
                  <div role="radiogroup" aria-label={`${tr(child.fullName)}: ${tr("Kayfiyati")}`} className="mt-2.5 grid grid-cols-2 gap-2 pl-[58px]">
                    {MOODS.map((m) => {
                      const on = mood === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={!canWrite}
                          onClick={() => toggle(child, m.value)}
                          className={clsx(
                            "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[15px] font-semibold transition-[transform,background-color] active:scale-[0.97]",
                            canWrite ? "cursor-pointer" : "cursor-default",
                          )}
                          style={on ? { backgroundColor: m.color, color: "#fff" } : { backgroundColor: "rgba(118,118,128,0.12)", color: "var(--color-text)" }}
                        >
                          <m.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} style={{ color: on ? "#fff" : m.color }} />
                          <span className="truncate">{tr(m.label)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Group>
        ))
      )}

      {/* Saqlash — faqat o'zgarish bo'lsa, tab-bar ustida */}
      {showSaveBar && (
        <FloatingBar>
          <PrimaryButton loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} disabled={changed.length === 0}>
            {saveMutation.isPending ? (
              tr("Saqlanmoqda…")
            ) : changed.length === 0 && saveMutation.isSuccess ? (
              <>
                <CheckIcon className="h-5 w-5" strokeWidth={2.6} /> {tr("Saqlandi")}
              </>
            ) : changed.length > 0 ? (
              tr("Saqlash · {0} ta o'zgarish", changed.length)
            ) : (
              tr("Saqlash")
            )}
          </PrimaryButton>
          {saveMutation.isError && <p className="mt-1.5 text-center text-[13px] font-medium text-[var(--color-danger)]">{tr("Saqlashda xatolik — qayta urinib ko'ring")}</p>}
        </FloatingBar>
      )}
    </TeacherPage>
  );
}
