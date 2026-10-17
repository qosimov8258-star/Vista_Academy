"use client";

import { use, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { Organization, StaffAttendanceDay, StaffAttendanceStatus, StaffAttendanceSummary } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { formatPositionLabel } from "@/lib/employee-position";
import { DayStepper, PeriodStepper } from "@/components/ios/day-stepper";
import { IosSwitch, Segmented } from "@/components/ios/form";
import { Group as IosGroup, ListRow } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { SheetPrimaryButton } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { OptionPicker } from "@/features/lessons/option-picker";
import { periodLabel, shiftPeriod } from "@/features/payments/shared";
import { EmployeeHistoryModal, STAFF_STATUS_COLOR, STAFF_STATUS_LABEL } from "@/features/staff-attendance/employee-history-modal";
import { useTr } from "@/i18n/tr";

type Tab = "davomat" | "royxat";

const DEFAULT_TIMEZONE = "Asia/Tashkent";
// Ko'pchilik xodim har kuni shu vaqt oralig'ida ishlaydi — har birini qo'lda
// kiritish o'rniga standart shu bilan to'ldirib qo'yiladi, faqat istisnolar
// (kimdir erta ketsa va h.k.) qo'lda o'zgartiriladi.
const DEFAULT_CHECK_IN_TIME = "07:30";
const DEFAULT_CHECK_OUT_TIME = "18:00";

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

  const attendanceQuery = useQuery({
    queryKey: ["staff-attendance", slug, branchId, date],
    queryFn: () => api.get<StaffAttendanceDay>(`/app/staff-attendance?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
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

  const [times, setTimes] = useState<Record<string, { checkInTime: string; checkOutTime: string }>>({});
  const timeFor = (employeeId: string, employee: { checkInTime: string | null; checkOutTime: string | null }) =>
    times[employeeId] ?? {
      checkInTime: employee.checkInTime ?? DEFAULT_CHECK_IN_TIME,
      checkOutTime: employee.checkOutTime ?? DEFAULT_CHECK_OUT_TIME,
    };

  // Kelishni belgilash: sahifa ochilganda hamma "Keldi" deb ko'rsatiladi (hali
  // saqlanmagan) — ko'pchilik kun sayin kelgani uchun shunday tezroq. Faqat
  // kelmagan/kech qolgan kabi istisnolarni o'zgartirib, oxirida "Saqlash"
  // bosiladi — shunda hammasi birdan yuboriladi.
  //
  // `attendanceQuery.data.date` bilan tekshiramiz (shunchaki obyekt
  // referensiyasi emas) — aks holda sana oldinga-orqaga almashtirilsa (masalan
  // A -> B -> A, keshdan darhol qaytadi) eski sananing belgilashlari yangi
  // sanaga "sizib o'tib" saqlanib ketishi mumkin edi.
  const [localStatuses, setLocalStatuses] = useState<Record<string, StaffAttendanceStatus>>({});
  // Faqat filial+sana haqiqatan almashganda tozalanadi — aks holda so'rov fon
  // rejimida qayta yuklanganda (masalan oyna qaytadan fokuslanganda) hali
  // saqlanmagan belgilashlar jimgina o'chirib yuborilishi mumkin edi.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!attendanceQuery.data || attendanceQuery.data.date !== date) return;
    const key = `${branchId}_${date}`;
    if (initializedForRef.current === key) return;
    initializedForRef.current = key;
    setLocalStatuses(
      Object.fromEntries(attendanceQuery.data.employees.map((e) => [e.employeeId, e.status ?? "PRESENT"])),
    );
    // Vaqt maydonlari ham shu sanaga xos — sana almashganda avvalgi
    // kiritilgan (hali saqlanmagan) vaqtlar olib tashlanadi.
    setTimes({});
  }, [attendanceQuery.data, date, branchId]);
  const statusFor = (employeeId: string) => localStatuses[employeeId] ?? "PRESENT";

  // Saqlash — hamma xodimni yozib, so'ng kunni qulflaydi (backend
  // requireOperationalScope/requireBranchScope orqali ruxsatni o'zi tekshiradi
  // — buyerda qayta tekshirmaymiz). Qulflangandan keyin bu kun uchun "Saqlash"
  // butunlay yo'qoladi, chunki ish haqi shu ma'lumotga bog'liq bo'ladi.
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!attendanceQuery.data) return;
      await Promise.all(
        attendanceQuery.data.employees.map((employee) => {
          const t = timeFor(employee.employeeId, employee);
          return api.post("/app/staff-attendance", {
            employeeId: employee.employeeId,
            date,
            status: statusFor(employee.employeeId),
            // Bo'sh satr backend validatsiyasidan o'tmaydi ("" - to'g'ri
            // HH:MM emas) — shuning uchun bo'sh bo'lsa umuman yubormaymiz.
            checkInTime: t.checkInTime || undefined,
            checkOutTime: t.checkOutTime || undefined,
          });
        }),
      );
      await api.post("/app/staff-attendance/lock", { branchId, date });
    },
    onSuccess: () => {
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

  const today = todayDateString();
  const employees = attendanceQuery.data?.employees ?? [];
  const presentCount = employees.filter((e) => (editable ? statusFor(e.employeeId) : e.status) === "PRESENT").length;
  const absentCount = employees.length - presentCount;
  const setTime = (employeeId: string, employee: { checkInTime: string | null; checkOutTime: string | null }, key: "checkInTime" | "checkOutTime", value: string) =>
    setTimes((t) => ({ ...t, [employeeId]: { ...timeFor(employeeId, employee), [key]: value } }));
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
              <IosGroup
                title={
                  <>
                    {tr("Xodimlar")}
                    <span className="font-normal normal-case tracking-normal">
                      · {tr("keldi {0}", presentCount)} · {tr("kelmadi {0}", absentCount)}
                    </span>
                  </>
                }
                refreshing={attendanceQuery.isFetching && !attendanceQuery.isLoading}
                footer={editable ? tr("Hamma «Keldi» bo'lib turadi — faqat kelmaganlarni o'chiring. Saqlangach kun qulflanadi va o'zgartirib bo'lmaydi.") : undefined}
                bare
              >
                <div className={GROUP_BLOCK}>
                  {employees.map((employee) => {
                    const status = editable ? statusFor(employee.employeeId) : employee.status;
                    const present = status === "PRESENT";
                    const t = timeFor(employee.employeeId, employee);
                    return (
                      <div key={employee.employeeId} className="group/row relative px-4 py-2.5">
                        <div className="flex min-h-[44px] items-center gap-3">
                          <IosAvatar name={employee.fullName} size={40} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15.5px] font-medium text-[var(--color-text)]">{tr(employee.fullName)}</span>
                            <span className="block truncate text-[13px] text-[#8e8e93]">{tr(employee.position)}</span>
                          </span>
                          {editable ? (
                            <span className="flex shrink-0 items-center gap-2.5">
                              <span className={clsx("text-[13px] font-medium", present ? "text-[#34c759]" : "text-[#8e8e93]")}>{tr(present ? "Keldi" : "Kelmadi")}</span>
                              <IosSwitch
                                checked={present}
                                onChange={() => setLocalStatuses((s) => ({ ...s, [employee.employeeId]: present ? "ABSENT" : "PRESENT" }))}
                                label={`${employee.fullName} — ${tr("davomat")}`}
                              />
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-2">
                              {(employee.checkInTime || employee.checkOutTime) && (
                                <span className="text-[13px] tabular-nums text-[#8e8e93] max-sm:hidden">
                                  {employee.checkInTime ?? "—"}–{employee.checkOutTime ?? "—"}
                                </span>
                              )}
                              <Pill color={employee.status ? STAFF_STATUS_COLOR[employee.status] : IOS.gray}>
                                {tr(employee.status ? STAFF_STATUS_LABEL[employee.status] : "Belgilanmagan")}
                              </Pill>
                            </span>
                          )}
                        </div>
                        {editable && present && (
                          // Kelgan va ketgan vaqti — standart 07:30–18:00, faqat istisnolar o'zgartiriladi
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[52px]">
                            <TimePill label={tr("Kelgan vaqti")} value={t.checkInTime} onChange={(v) => setTime(employee.employeeId, employee, "checkInTime", v)} />
                            <span className="text-[#c7c7cc]">–</span>
                            <TimePill label={tr("Ketgan vaqti")} value={t.checkOutTime} onChange={(v) => setTime(employee.employeeId, employee, "checkOutTime", v)} />
                          </div>
                        )}
                        <span className={ROW_SEPARATOR} style={{ left: 68 }} aria-hidden="true" />
                      </div>
                    );
                  })}
                </div>
              </IosGroup>
            )}

            {editable && employees.length > 0 && (
              <div className="space-y-2">
                {saveMutation.isError && <p className="px-1 text-[13px] text-[#ff3b30]">{tr("Saqlashda xatolik yuz berdi")}</p>}
                <SheetPrimaryButton loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {tr("Saqlash")}
                </SheetPrimaryButton>
              </div>
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
                        avatar={<IosAvatar name={employee.fullName} size={44} />}
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

/** Kelgan/ketgan vaqti — kulrang kapsula ichidagi vaqt maydoni */
function TimePill({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#767680]/[0.12] pl-3 pr-2 text-[12.5px] text-[#8e8e93]">
      {/* Telefonda joy tor — ikkala vaqt bir qatorga sig'ishi uchun yozuv yashiriladi (aria-label qoladi) */}
      <span className="max-sm:hidden">{label}</span>
      <input
        type="time"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-[14px] font-medium tabular-nums text-[var(--color-text)] outline-none"
      />
    </label>
  );
}
