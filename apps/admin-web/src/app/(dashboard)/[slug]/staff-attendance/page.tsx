"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Lock, UserCheck, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Organization, StaffAttendanceDay, StaffAttendanceEmployee, StaffAttendanceSummary } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { formatPositionLabel } from "@/lib/employee-position";
import { DayStepper, PeriodStepper } from "@/components/ios/day-stepper";
import { Segmented } from "@/components/ios/form";
import { Group as IosGroup, ListRow } from "@/components/ios/group";
import { IosButton } from "@/components/ios/button";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { OptionPicker } from "@/features/lessons/option-picker";
import { ReportSheet } from "@/features/reports/report-sheet";
import { periodLabel, shiftPeriod } from "@/features/payments/shared";
import {
  DayEditSheet,
  DEFAULT_CHECK_IN_TIME,
  DEFAULT_CHECK_OUT_TIME,
  isPresentStatus,
  type DayDraft,
} from "@/features/staff-attendance/day-edit-sheet";
import { EmployeeHistoryModal, STAFF_STATUS_COLOR, STAFF_STATUS_LABEL } from "@/features/staff-attendance/employee-history-modal";
import { FaceIdMark, InOutTimes, isFaceIdRecord } from "@/features/staff-attendance/in-out-times";
import { employeePhotoUrl } from "@/components/ui/employee-photo";
import { useTr } from "@/i18n/tr";

type Tab = "davomat" | "royxat";
type DayFilter = "all" | "inside" | "left" | "missing";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function currentPeriodString(): string {
  return todayDateString().slice(0, 7);
}

export default function StaffAttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date input.
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState("");
  const [tab, setTab] = useState<Tab>("davomat");
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);

  useEffect(() => {
    setDate((current) => current || todayDateString());
    setPeriod((current) => current || currentPeriodString());
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

  const today = todayDateString();
  const attendanceQuery = useQuery({
    queryKey: ["staff-attendance", slug, branchId, date],
    queryFn: () => api.get<StaffAttendanceDay>(`/app/staff-attendance?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
    // Bugun Face ID terminali vaqtlarni yozib turadi — sahifa ochiq bo'lsa yangilanib tursin
    refetchInterval: date === today ? 30_000 : false,
  });

  const summaryQuery = useQuery({
    queryKey: ["staff-attendance-summary", slug, branchId, period],
    queryFn: () => api.get<StaffAttendanceSummary>(`/app/staff-attendance/summary?branchId=${branchId}&period=${period}`),
    enabled: !!branchId && !!period,
  });

  // "Xodimlar ro'yxati" qatoriga bosilganda shu xodimning bir oylik kun-kun
  // tarixi (kelgan/kelmagan kunlari) alohida oynada ochiladi.
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState("");

  // Hali saqlanmagan o'zgarishlar (xodim → holat va vaqtlar). Ko'rsatilgani —
  // qoralama bo'lsa o'sha, bo'lmasa bazadagi yozuv (terminal yoki qo'lda
  // belgilangan). Yozuvi yo'q xodim «Belgilanmagan» — hech kim avtomatik
  // «Keldi» deb ko'rsatilmaydi, Face ID'dagi haqiqiy holat chalkashmasin.
  const [drafts, setDrafts] = useState<Record<string, DayDraft>>({});
  const [filter, setFilter] = useState<DayFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Hisobot — API'dagi StaffAttendanceReportService bilan bir xil qoida: o'qituvchi va oshpazdan boshqa rollar
  const canDownload = !!user && user.role !== "TEACHER" && user.role !== "CHEF";
  // Sana yoki filial almashganda qoralamalar tashlanadi — eski kunning
  // belgilashlari yangi kunga sizib o'tmasin.
  useEffect(() => {
    setDrafts({});
    setFilter("all");
  }, [date, branchId]);

  const recordOf = (e: StaffAttendanceEmployee): DayDraft => ({ status: e.status, checkInTime: e.checkInTime, checkOutTime: e.checkOutTime });
  const effectiveOf = (e: StaffAttendanceEmployee): DayDraft => drafts[e.employeeId] ?? recordOf(e);

  // Saqlash — hamma xodimni yozib, so'ng kunni qulflaydi (backend
  // requireOperationalScope/requireBranchScope orqali ruxsatni o'zi tekshiradi
  // — buyerda qayta tekshirmaymiz). Qulflangandan keyin bu kun uchun "Saqlash"
  // butunlay yo'qoladi, chunki ish haqi shu ma'lumotga bog'liq bo'ladi.
  // Belgilanmagan xodim «Kelmadi» bo'lib yoziladi (tasdiqlash oynasida aytiladi).
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!attendanceQuery.data) return;
      await Promise.all(
        attendanceQuery.data.employees.map((employee) => {
          const eff = effectiveOf(employee);
          const status = eff.status ?? "ABSENT";
          const present = isPresentStatus(status);
          return api.post("/app/staff-attendance", {
            employeeId: employee.employeeId,
            date,
            status,
            // Bo'sh satr backend validatsiyasidan o'tmaydi ("" - to'g'ri
            // HH:MM emas) — shuning uchun bo'sh bo'lsa umuman yubormaymiz.
            checkInTime: (present && eff.checkInTime) || undefined,
            checkOutTime: (present && eff.checkOutTime) || undefined,
          });
        }),
      );
      await api.post("/app/staff-attendance/lock", { branchId, date });
    },
    onSuccess: () => {
      setConfirmOpen(false);
      setDrafts({});
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", slug, branchId, date] });
      queryClient.invalidateQueries({ queryKey: ["staff-attendance-summary", slug, branchId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    },
  });

  // Sana yoki filial almashtirilganda oldingi urinishning "Saqlandi"/xatolik
  // xabari yangi kunga osilib qolmasin.
  useEffect(() => {
    saveMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchId]);

  // Qulflangan kunda tahrirlash tugmalari yo'qoladi — o'qituvchi/moliyachi
  // ko'radigan "faqat ko'rish" rejimi bilan bir xil ko'rinish ishlatiladi.
  const locked = attendanceQuery.data?.locked ?? false;
  const editable = canWrite && !locked;

  const employees = useMemo(() => attendanceQuery.data?.employees ?? [], [attendanceQuery.data]);
  const rows = employees.map((employee) => ({ employee, eff: effectiveOf(employee) }));
  const presentRows = rows.filter((r) => isPresentStatus(r.eff.status));
  const counts = {
    present: presentRows.length,
    late: rows.filter((r) => r.eff.status === "LATE").length,
    inside: presentRows.filter((r) => !r.eff.checkOutTime).length,
    left: presentRows.filter((r) => !!r.eff.checkOutTime).length,
    absent: rows.filter((r) => r.eff.status && !isPresentStatus(r.eff.status)).length,
    unmarked: rows.filter((r) => !r.eff.status).length,
  };
  const isToday = date === today;
  const visibleRows = rows.filter(({ eff }) => {
    if (filter === "inside") return isPresentStatus(eff.status) && !eff.checkOutTime;
    if (filter === "left") return isPresentStatus(eff.status) && !!eff.checkOutTime;
    if (filter === "missing") return !isPresentStatus(eff.status);
    return true;
  });
  const changedCount = Object.keys(drafts).length;
  const editing = employees.find((e) => e.employeeId === editingId) ?? null;

  // Terminalsiz filialda (yoki terminalga chiqmaganlar uchun) tezkor yo'l:
  // belgilanmaganlarning hammasini standart vaqt bilan «Keldi» qilish.
  const markUnmarkedPresent = () =>
    setDrafts((d) => {
      const next = { ...d };
      for (const { employee, eff } of rows) {
        if (!eff.status) next[employee.employeeId] = { status: "PRESENT", checkInTime: DEFAULT_CHECK_IN_TIME, checkOutTime: DEFAULT_CHECK_OUT_TIME };
      }
      return next;
    });

  const rateColor = (rate: number) => (rate >= 80 ? IOS.green : rate >= 50 ? IOS.orange : IOS.red);

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-2">
        <PageHeaderCard
          icon={UserCheck}
          tint="teal"
          title={tr("Xodimlar davomati")}
          subtitle={tr("Tarbiyachi va boshqa xodimlarning kunlik davomati")}
          actions={
            canDownload && branchId ? (
              <IosButton label={tr("Yuklab olish")} icon={Download} compact onClick={() => setReportOpen(true)} />
            ) : undefined
          }
        />

        {/* Ikki bo'lim: kunlik belgilash va xodimlar ro'yxati + oylik jamlanma. */}
        <div className="max-w-sm">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            label={tr("Bo'lim")}
            options={[
              { value: "davomat", label: tr("Davomat") },
              { value: "royxat", label: tr("Xodimlar ro'yxati") },
            ]}
          />
        </div>

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

        {tab === "davomat" && (
          <>
            {date && <DayStepper value={date} onChange={setDate} today={today} />}

            {!canWrite && <ViewOnlyNote role={user?.role} />}

            {canWrite && locked && (
              <div className="flex items-start gap-3 rounded-[18px] bg-[#ff9500]/[0.12] px-4 py-3 text-[13.5px] leading-snug text-[#c93400]">
                <Lock className="mt-0.5 h-[17px] w-[17px] shrink-0" strokeWidth={2.2} />
                <span>
                  {tr("Bu kun uchun davomat saqlangan va qulflangan")}
                  {attendanceQuery.data?.lockedByName ? ` — ${attendanceQuery.data.lockedByName}` : ""}
                  {tr(". Endi o'zgartirib bo'lmaydi.")}
                </span>
              </div>
            )}

            {!date || (!branchId && orgQuery.isLoading) ? (
              <SkeletonRows rows={6} />
            ) : !branchId ? (
              <EmptyState icon={UserCheck} title="Filial mavjud emas" />
            ) : attendanceQuery.isLoading ? (
              <SkeletonRows rows={6} />
            ) : attendanceQuery.isError ? (
              <ErrorState message={(attendanceQuery.error as Error).message} onRetry={() => attendanceQuery.refetch()} retrying={attendanceQuery.isFetching} />
            ) : employees.length === 0 ? (
              <EmptyState icon={UserCheck} title="Bu filialda faol xodim yo'q" />
            ) : (
              <>
                <StatStrip tone="white">
                  <StatCell
                    label={tr("Keldi")}
                    value={counts.present}
                    color={IOS.green}
                    hint={counts.late > 0 ? tr("{0} tasi kech qoldi", counts.late) : `${tr("jami")} ${employees.length}`}
                  />
                  <StatCell label={tr(isToday ? "Ichkarida" : "Chiqishsiz")} value={counts.inside} color={IOS.orange} hint={tr(isToday ? "hali ketmagan" : "chiqish yozilmagan")} />
                  <StatCell label={tr("Ketdi")} value={counts.left} color={IOS.blue} />
                  <StatCell
                    label={tr("Kelmadi")}
                    value={counts.absent + counts.unmarked}
                    color={IOS.red}
                    hint={counts.unmarked > 0 ? tr("{0} tasi belgilanmagan", counts.unmarked) : undefined}
                  />
                </StatStrip>

                <Segmented<DayFilter>
                  value={filter}
                  onChange={setFilter}
                  label={tr("Saralash")}
                  options={[
                    { value: "all", label: tr("Hammasi") },
                    { value: "inside", label: tr(isToday ? "Ichkarida" : "Chiqishsiz") },
                    { value: "left", label: tr("Ketdi") },
                    { value: "missing", label: tr("Kelmadi") },
                  ]}
                />

                <IosGroup
                  title={
                    <>
                      {tr("Xodimlar")}
                      {changedCount > 0 && (
                        <span className="font-normal normal-case tracking-normal text-[var(--color-primary)]"> · {tr("{0} ta o'zgarish saqlanmagan", changedCount)}</span>
                      )}
                    </>
                  }
                  refreshing={attendanceQuery.isFetching && !attendanceQuery.isLoading}
                  footer={
                    editable
                      ? tr("Kirish va chiqish vaqtini Face ID terminali o'zi yozadi. Xodimni bosib, holat yoki vaqtni tuzating; oxirida «Saqlash» — kun qulflanadi.")
                      : undefined
                  }
                  bare
                >
                  {visibleRows.length === 0 ? (
                    <div className={GROUP_BLOCK}>
                      <EmptyState icon={UserCheck} title="Bu bo'limda xodim yo'q" />
                    </div>
                  ) : (
                    <div className={GROUP_BLOCK}>
                      {visibleRows.map(({ employee, eff }) => {
                        const present = isPresentStatus(eff.status);
                        const changed = !!drafts[employee.employeeId];
                        const faceId = isFaceIdRecord(employee.note) && !changed;
                        return (
                          <ListRow
                            key={employee.employeeId}
                            onClick={() => setEditingId(employee.employeeId)}
                            chevron={false}
                            avatar={<IosAvatar name={employee.fullName} src={employeePhotoUrl({ id: employee.employeeId, avatarUpdatedAt: employee.avatarUpdatedAt })} size={44} />}
                            title={
                              <>
                                {changed && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-primary)] align-middle" aria-label={tr("O'zgartirilgan")} />}
                                {tr(employee.fullName)}
                              </>
                            }
                            subtitle={
                              <>
                                {tr(employee.position)}
                                {faceId && (
                                  <>
                                    {" · "}
                                    <FaceIdMark />
                                  </>
                                )}
                              </>
                            }
                            meta={
                              present ? (
                                <InOutTimes checkIn={eff.checkInTime} checkOut={eff.checkOutTime} late={eff.status === "LATE"} />
                              ) : (
                                <Pill color={eff.status ? STAFF_STATUS_COLOR[eff.status] : IOS.gray}>
                                  {tr(eff.status ? STAFF_STATUS_LABEL[eff.status] : "Belgilanmagan")}
                                </Pill>
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </IosGroup>

                {editable && (
                  <div className="space-y-2.5">
                    {counts.unmarked > 0 && (
                      <SheetSecondaryButton onClick={markUnmarkedPresent}>
                        <Wand2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
                        {tr("Belgilanmagan {0} tasini «Keldi» qilish", counts.unmarked)}
                      </SheetSecondaryButton>
                    )}
                    <SheetPrimaryButton onClick={() => setConfirmOpen(true)}>{tr("Saqlash")}</SheetPrimaryButton>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "royxat" && (
          <>
            {period && (
              <PeriodStepper
                onPrev={() => setPeriod((p) => shiftPeriod(p, -1))}
                onNext={() => setPeriod((p) => shiftPeriod(p, 1))}
                prevLabel={tr("Oldingi oy")}
                nextLabel={tr("Keyingi oy")}
                reset={period !== currentPeriodString() ? { label: tr("Shu oy"), onClick: () => setPeriod(currentPeriodString()) } : undefined}
              >
                {periodLabel(period, tr)}
              </PeriodStepper>
            )}

            {summaryQuery.data && summaryQuery.data.employees.length > 0 && (
              <StatStrip tone="white">
                <StatCell label={tr("Keldi")} value={summaryQuery.data.totals.present} color={IOS.green} />
                <StatCell label={tr("Kelmadi")} value={summaryQuery.data.totals.absent} color={IOS.red} />
                <StatCell label={tr("Kech qoldi")} value={summaryQuery.data.totals.late} color={IOS.orange} />
                <StatCell label={tr("Kasal / ta'til")} value={summaryQuery.data.totals.sick + summaryQuery.data.totals.onLeave} />
              </StatStrip>
            )}

            <IosGroup
              title={tr("Xodimlar ro'yxati")}
              refreshing={summaryQuery.isFetching && !summaryQuery.isLoading}
              footer={summaryQuery.data?.employees.length ? tr("Xodimni bosib, oylik tarixini ko'ring") : undefined}
              bare
            >
              {!period || summaryQuery.isLoading ? (
                <SkeletonRows rows={5} />
              ) : summaryQuery.isError ? (
                <ErrorState message={(summaryQuery.error as Error).message} onRetry={() => summaryQuery.refetch()} retrying={summaryQuery.isFetching} />
              ) : !summaryQuery.data || summaryQuery.data.employees.length === 0 ? (
                <EmptyState icon={UserCheck} title="Bu oy uchun ma'lumot yo'q" />
              ) : (
                <div className={GROUP_BLOCK}>
                  {summaryQuery.data.employees.map((employee) => {
                    // Kech qoldi, kasal va ta'til — barchasi "Kelmadi" qatoriga qo'shib ko'rsatiladi
                    const missed = employee.absent + employee.late + employee.sick + employee.onLeave;
                    return (
                      <ListRow
                        key={employee.employeeId}
                        onClick={() => {
                          setHistoryEmployeeId(employee.employeeId);
                          setHistoryPeriod(period);
                        }}
                        avatar={<IosAvatar name={employee.fullName} src={employeePhotoUrl({ id: employee.employeeId, avatarUpdatedAt: employee.avatarUpdatedAt })} size={44} />}
                        title={tr(employee.fullName)}
                        subtitle={`${tr(formatPositionLabel(employee.position, employee.subjects))}${employee.groups.length > 0 ? ` · ${employee.groups.join(", ")}` : ""}`}
                        meta={
                          <span className="flex flex-col items-end gap-1">
                            {employee.rate === null ? <Pill color={IOS.gray}>—</Pill> : <Pill color={rateColor(employee.rate)}>{employee.rate}%</Pill>}
                            <span className="whitespace-nowrap text-[12px] tabular-nums text-[#8e8e93]">
                              {tr("keldi {0}", employee.present)} · {tr("kelmadi {0}", missed)}
                            </span>
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </IosGroup>
          </>
        )}
      </div>

      <DayEditSheet
        open={!!editing}
        onClose={() => setEditingId(null)}
        employee={
          editing
            ? {
                fullName: editing.fullName,
                position: editing.position,
                photoUrl: employeePhotoUrl({ id: editing.employeeId, avatarUpdatedAt: editing.avatarUpdatedAt }),
                faceId: isFaceIdRecord(editing.note),
                recorded: recordOf(editing),
              }
            : null
        }
        value={editing ? effectiveOf(editing) : { status: null, checkInTime: null, checkOutTime: null }}
        editable={editable}
        onApply={(draft) => editing && setDrafts((d) => ({ ...d, [editing.employeeId]: draft }))}
      />

      {/* Saqlash qaytarib bo'lmaydi (kun qulflanadi) — ikkinchi bosqichda tasdiqlanadi */}
      <IosSheet
        open={confirmOpen}
        onClose={() => !saveMutation.isPending && setConfirmOpen(false)}
        cancelLabel="Qaytish"
        title={tr("Davomatni saqlash")}
        footer={
          <SheetPrimaryButton loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {tr("Saqlash va qulflash")}
          </SheetPrimaryButton>
        }
      >
        <div className="space-y-3 px-1 text-[15px] leading-snug text-[var(--color-text)]">
          <p>
            {tr("Keldi")}: <b className="tabular-nums">{counts.present}</b> · {tr("Kelmadi")}: <b className="tabular-nums">{counts.absent + counts.unmarked}</b>
          </p>
          {counts.unmarked > 0 && (
            <p className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] text-[#d70015]">
              {tr("{0} ta xodim belgilanmagan — ular «Kelmadi» deb saqlanadi.", counts.unmarked)}
            </p>
          )}
          <p className="text-[13.5px] text-[#8e8e93]">{tr("Saqlangach kun qulflanadi va o'zgartirib bo'lmaydi — ish haqi shu davomatdan hisoblanadi.")}</p>
          {saveMutation.isError && <p className="text-[13px] text-[#ff3b30]">{tr("Saqlashda xatolik yuz berdi")}</p>}
        </div>
      </IosSheet>

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        period={(tab === "royxat" ? period : date.slice(0, 7)) || undefined}
        title="Xodimlar davomati hisoboti"
        endpoint="/app/staff-attendance/report"
        filePrefix="xodimlar-davomati"
        formats={["xlsx"]}
        params={{ branchId }}
        allHint="Boshidan bugungacha barcha davomat yozuvlari"
        contents="Excel: «Umumiy» — har xodim bo'yicha kelgan, kech qolgan va kelmagan kunlar, o'rtacha kirish/chiqish va ishlagan vaqti; «Tabel» — har kun kirish va chiqish vaqti (holat rangida); «Kirish-chiqish» — batafsil ro'yxat; «Face ID voqealari» — terminaldagi har bir yuz ko'rsatish."
      />

      <EmployeeHistoryModal
        open={!!historyEmployeeId}
        onClose={() => setHistoryEmployeeId(null)}
        slug={slug}
        employeeId={historyEmployeeId}
        branchId={branchId}
        period={historyPeriod}
        onPeriodChange={setHistoryPeriod}
      />
    </div>
  );
}
