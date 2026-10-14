"use client";

import { use, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby,
  BadgePercent,
  Camera,
  Check,
  ChevronLeft,
  Copy,
  FileText,
  HeartPulse,
  KeyRound,
  Pencil,
  Phone,
  Pill as PillIcon,
  Plus,
  Sparkles,
  Syringe,
  Trash2,
  TriangleAlert,
  UserPlus,
  Wallet,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type {
  Child,
  ChildAttendanceHistory,
  ChildGuardian,
  DailyReport,
  DevelopmentAssessment,
  HealthProfile,
  LedgerEntry,
  MedicationLog,
  Vaccination,
} from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { downloadCsv } from "@/lib/download";
import { prepareChildPhoto } from "@/lib/child-photo";
import { formatAge, formatChildId, formatDate, formatDateTime, formatGender, formatPhone } from "@/lib/format";
import { isCashierPosition } from "@/lib/employee-position";
import { canWriteOperational, canWriteTeaching } from "@/lib/permissions";
import { WEEKDAYS, dayMonthLabel } from "@/components/ios/day-stepper";
import { Segmented } from "@/components/ios/form";
import { Group, ListRow, Row } from "@/components/ios/group";
import { PageCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { IosIcon, type AnyIcon } from "@/features/director/ios-icon";
import { ChildCashCard } from "@/features/cash/child-cash-card";
import { groupDigits } from "@/features/payments/shared";
import { ruleLabel, scopeLabel, type DiscountChildHistory } from "@/features/discounts/shared";
import { EditDevelopmentModal } from "@/features/development/edit-development-modal";
import { EditHealthProfileModal, BLOOD_TYPE_LABEL } from "@/features/child-health/edit-health-profile-modal";
import { AddVaccinationModal } from "@/features/child-health/add-vaccination-modal";
import { UpdateVaccinationModal } from "@/features/child-health/update-vaccination-modal";
import { AddMedicationModal } from "@/features/child-health/add-medication-modal";
import { AddGuardianModal } from "@/features/guardians/add-guardian-modal";
import { ParentCabinetModal } from "@/features/guardians/parent-cabinet-modal";
import { EditGuardianLinkModal } from "@/features/guardians/edit-guardian-link-modal";
import { EditChildModal } from "@/features/children/edit-child-modal";
import { ChildAttendanceCalendar } from "@/features/attendance/child-attendance-calendar";
import { useTr } from "@/i18n/tr";

type Tab = "overview" | "attendance" | "health" | "development";
const TABS: Tab[] = ["overview", "attendance", "health", "development"];

const STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Faol", color: IOS.green },
  INACTIVE: { label: "Nofaol", color: IOS.gray },
  QUARANTINED: { label: "Karantinda", color: IOS.red },
};
const RELATION: Record<string, string> = { FATHER: "Ota", MOTHER: "Ona", GRANDPARENT: "Bobo/Buvi", OTHER: "Boshqa" };
const LEDGER_TYPE: Record<string, string> = { CHARGE: "Hisoblandi", DISCOUNT: "Chegirma", PAYMENT: "To'lov", REFUND: "Qaytarish", ADJUSTMENT: "Tuzatish" };
const VACCINATION: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Rejalashtirilgan", color: IOS.orange },
  DONE: { label: "Bajarildi", color: IOS.green },
  MISSED: { label: "O'tkazib yuborildi", color: IOS.red },
};
const EATING: Record<string, string> = { GOOD: "Yaxshi", AVERAGE: "O'rtacha", POOR: "Yomon" };
const MOOD: Record<string, string> = { HAPPY: "Xursand", NEUTRAL: "Oddiy", UPSET: "Xafa" };
const RATING: Record<string, { label: string; color: string }> = {
  BELOW_EXPECTED: { label: "Kutilganidan past", color: IOS.red },
  ON_TRACK: { label: "Yoshiga mos", color: IOS.green },
  ABOVE_EXPECTED: { label: "Kutilganidan yuqori", color: IOS.blue },
};

/** Rejalashtirilgan sanasi o'tgan, lekin hali belgilanmagan emlash */
const isVaccinationOverdue = (v: { status: string; scheduledDate: string }) => v.status === "SCHEDULED" && new Date(v.scheduledDate) < new Date();
const dayLabel = (iso: string, tr: (k: string) => string) => {
  const d = iso.slice(0, 10);
  return `${dayMonthLabel(d, tr, new Date().getUTCFullYear())}, ${tr(WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]).toLowerCase()}`;
};

/**
 * Bola profili — iOS uslubida. Tepada surat (bosilsa almashtiriladi), ism,
 * holat, ID va tezkor amallar (qo'ng'iroq, hujjatlar, tahrirlash, moliya);
 * ko'rsatkichlar; pastda bitta tanlov — Umumiy (ota-onalar va ularning
 * huquqlari, kabinet, ma'lumot, moliya) / Davomat (statistika, kalendar,
 * kelmagan kunlar) / Sog'liq (profil, emlashlar, dori-darmon) / Rivojlanish
 * (baholash, kundalik hisobotlar). Barcha tahrirlash oynalari — varaqlar.
 */
export default function ChildDetailPage({ params }: { params: Promise<{ slug: string; childId: string }> }) {
  const tr = useTr();
  const { slug, childId } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  // Moliyachi va kassirga ota-ona kartasi tepasida to'lov qabul qilish kartasi
  const showCash = user?.role === "FINANCE" || (!!user?.position && isCashierPosition(user.position));
  // Davomatga izoh yozish — tarbiyachilik ishi (kunlik davomat bilan bir xil ruxsat)
  const canWriteAttendance = canWriteTeaching(user?.role);
  // `assertMoneyReader` faqat o'qituvchini rad etadi — UI ham shunday
  const canReadMoney = user?.role !== "TEACHER";
  const { branchSlug } = useBranchContext(slug);
  const childrenHref = branchSlug ? `/${slug}/${branchSlug}/children` : `/${slug}/children`;
  const financeHref = branchSlug ? `/${slug}/${branchSlug}/finance/${childId}` : `/${slug}/finance/${childId}`;
  const discountsHref = `${branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`}/discounts?child=${childId}`;
  // Chegirmalar bo'limini oshpaz ham ko'rmaydi (API ham rad etadi)
  const canReadDiscounts = canReadMoney && user?.role !== "CHEF";

  const [tab, setTab] = useState<Tab>("overview");
  const [editChildOpen, setEditChildOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [guardianSheet, setGuardianSheet] = useState<ChildGuardian | null>(null);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ChildGuardian | null>(null);
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [vaccinationOpen, setVaccinationOpen] = useState(false);
  const [updatingVaccination, setUpdatingVaccination] = useState<Vaccination | null>(null);
  const [medicationOpen, setMedicationOpen] = useState(false);
  const [report, setReport] = useState<DailyReport | null>(null);

  // ?tab=health kabi havola bilan to'g'ridan-to'g'ri bo'lim ochiladi
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (wanted && TABS.includes(wanted)) setTab(wanted);
  }, []);
  const switchTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  const childQuery = useQuery({ queryKey: ["child", slug, childId], queryFn: () => api.get<Child>(`/app/children/${childId}`) });
  const attendanceQuery = useQuery({
    queryKey: ["child-attendance-history", slug, childId],
    queryFn: () => api.get<ChildAttendanceHistory>(`/app/children/${childId}/attendance-history`),
  });
  const reportsQuery = useQuery({ queryKey: ["daily-reports-history", slug, childId], queryFn: () => api.get<DailyReport[]>(`/app/children/${childId}/daily-reports`) });
  const developmentQuery = useQuery({ queryKey: ["development", slug, childId], queryFn: () => api.get<DevelopmentAssessment[]>(`/app/children/${childId}/development`) });
  const healthQuery = useQuery({ queryKey: ["child-health", slug, childId], queryFn: () => api.get<HealthProfile | null>(`/app/children/${childId}/health`) });
  const vaccinationsQuery = useQuery({ queryKey: ["vaccinations", slug, childId], queryFn: () => api.get<Vaccination[]>(`/app/children/${childId}/vaccinations`) });
  const medicationsQuery = useQuery({ queryKey: ["medications", slug, childId], queryFn: () => api.get<MedicationLog[]>(`/app/children/${childId}/medications`) });
  const guardiansQuery = useQuery({ queryKey: ["child-guardians", slug, childId], queryFn: () => api.get<ChildGuardian[]>(`/app/children/${childId}/guardians`) });
  const ledgerQuery = useQuery({
    queryKey: ["ledger", slug, childId],
    queryFn: () => api.get<LedgerEntry[]>(`/app/children/${childId}/ledger`),
    enabled: canReadMoney,
  });
  const discountQuery = useQuery({
    queryKey: ["child-discount", slug, childId],
    queryFn: () => api.get<DiscountChildHistory>(`/app/discounts/child/${childId}`),
    enabled: canReadDiscounts,
  });

  const child = childQuery.data;
  const guardians = guardiansQuery.data ?? [];
  const primary = guardians.find((g) => g.isPrimary) ?? guardians[0] ?? null;
  // Kabinet bolaga bitta: qaysi vasiyning raqami login ekanini shu yerda topamiz
  const cabinetHolder = guardians.find((link) => link.guardian.hasCabinet) ?? null;
  const balance = (ledgerQuery.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const stats = attendanceQuery.data?.stats;
  const health = healthQuery.data ?? null;
  const latest = developmentQuery.data?.[0] ?? null;
  const absences = [...(attendanceQuery.data?.records ?? [])].filter((r) => r.status !== "PRESENT").reverse();
  const overdueVaccinations = (vaccinationsQuery.data ?? []).filter(isVaccinationOverdue).length;

  const refresh = () =>
    Promise.all([childQuery, attendanceQuery, reportsQuery, developmentQuery, healthQuery, vaccinationsQuery, medicationsQuery, guardiansQuery, ...(canReadMoney ? [ledgerQuery] : [])].map((q) => q.refetch()));

  if (childQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState message={(childQuery.error as Error).message} onRetry={() => childQuery.refetch()} retrying={childQuery.isFetching} />
      </div>
    );
  }

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <Link href={childrenHref} className="hidden h-9 items-center gap-0.5 rounded-full pr-3 text-[15px] font-medium text-[var(--color-primary)] active:opacity-50 md:inline-flex">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
          {tr("Bolalar")}
        </Link>

        {/* Sarlavha: surat, ism, holat, ID, tezkor amallar */}
        <PageCard className="px-4 pb-4 pt-5">
          {!child ? (
            <div className="flex flex-col items-center gap-3">
              <span className="h-[88px] w-[88px] animate-pulse rounded-full bg-[#767680]/[0.12]" />
              <span className="h-5 w-48 animate-pulse rounded-full bg-[#767680]/[0.12]" />
              <span className="h-3.5 w-32 animate-pulse rounded-full bg-[#767680]/[0.08]" />
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setPhotoOpen(true)}
                  className="relative rounded-full transition-transform enabled:active:scale-95"
                  aria-label={canWrite ? tr("Bolaning suratini almashtirish") : undefined}
                >
                  <ChildPhoto child={child} size={88} fallback={initials(child.fullName)} />
                  {canWrite && (
                    <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-white ring-[3px] ring-white">
                      <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </span>
                  )}
                </button>
                <h1 data-hero className="mt-3 text-[22px] font-bold leading-tight text-[var(--color-text)]">
                  {tr(child.fullName)}
                </h1>
                <p className="mt-1 text-[14px] text-[#8e8e93]">
                  {[child.group?.name ? tr(child.group.name) : tr("Guruhsiz"), child.birthDate ? tr(formatAge(child.birthDate)) : null].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                  <Pill color={STATUS[child.status]?.color}>{tr(STATUS[child.status]?.label ?? child.status)}</Pill>
                  <CopyChip value={formatChildId(child.publicId)} />
                  {health?.allergies && <Pill color={IOS.red}>{tr("Allergiya")}</Pill>}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2">
                <QuickAction icon={Phone} label={tr("Qo'ng'iroq")} color={IOS.green} href={primary ? `tel:${primary.guardian.phone}` : undefined} />
                <QuickAction icon={FileText} label={tr("Hujjatlar")} color={IOS.blue} onClick={canWrite ? () => setDocsOpen(true) : undefined} />
                <QuickAction icon={Pencil} label={tr("Tahrirlash")} color={IOS.orange} onClick={canWrite ? () => setEditChildOpen(true) : undefined} />
                <QuickAction icon={Wallet} label={tr("Moliya")} color="#5856d6" href={canReadMoney ? financeHref : undefined} />
              </div>
            </>
          )}
        </PageCard>

        <StatStrip tone="white">
          <StatCell
            label={tr("Davomat")}
            value={stats?.attendanceRate != null ? `${stats.attendanceRate}%` : "—"}
            color={stats?.attendanceRate == null ? undefined : stats.attendanceRate >= 80 ? IOS.green : stats.attendanceRate >= 50 ? IOS.orange : IOS.red}
            hint={attendanceQuery.data ? tr("{0}-yil", attendanceQuery.data.year) : undefined}
            loading={attendanceQuery.isLoading}
          />
          <StatCell label={tr("Kelmagan")} value={stats?.absent ?? 0} hint={stats ? tr("sababsiz {0}", stats.unexcusedAbsent) : undefined} color={stats?.unexcusedAbsent ? IOS.red : undefined} loading={attendanceQuery.isLoading} />
          {canReadMoney ? (
            <StatCell
              label={tr("Qarzdorlik")}
              value={balance > 0.5 ? groupDigits(balance) : "0"}
              hint={tr("so'm")}
              color={balance > 0.5 ? IOS.red : IOS.green}
              href={financeHref}
              loading={ledgerQuery.isLoading}
            />
          ) : (
            <StatCell label={tr("Ota-onalar")} value={guardians.length} loading={guardiansQuery.isLoading} />
          )}
          <StatCell label={tr("Emlash")} value={overdueVaccinations ? tr("{0} kechikkan", overdueVaccinations) : (vaccinationsQuery.data?.length ?? 0)} color={overdueVaccinations ? IOS.red : undefined} hint={overdueVaccinations ? undefined : tr("yozuv")} loading={vaccinationsQuery.isLoading} />
        </StatStrip>

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        <Segmented<Tab>
          value={tab}
          onChange={switchTab}
          label={tr("Bo'lim")}
          options={[
            { value: "overview", label: tr("Umumiy") },
            { value: "attendance", label: tr("Davomat") },
            { value: "health", label: tr("Sog'liq") },
            { value: "development", label: tr("Rivojlanish") },
          ]}
        />

        {/* ---------------- Umumiy ---------------- */}
        {tab === "overview" && (
          <>
            {showCash && child && <ChildCashCard slug={slug} childId={childId} childName={child.fullName} />}

            <Group
              title={tr("Ota-onalar")}
              action={
                canWrite && guardians.length > 0 ? (
                  <button type="button" className="text-[var(--color-primary)] active:opacity-50" onClick={() => setGuardianOpen(true)}>
                    {tr("Qo'shish")}
                  </button>
                ) : undefined
              }
              footer={guardians.length > 0 ? tr("Ota-onani bosing — qo'ng'iroq, huquqlar va tahrirlash.") : undefined}
              bare={guardiansQuery.isLoading || guardiansQuery.isError || (guardians.length === 0 && !canWrite)}
            >
              {guardiansQuery.isLoading ? (
                <SkeletonRows rows={2} />
              ) : guardiansQuery.isError ? (
                <ErrorState message={(guardiansQuery.error as Error).message} onRetry={() => guardiansQuery.refetch()} />
              ) : guardians.length === 0 ? (
                canWrite ? (
                  <Row onClick={() => setGuardianOpen(true)} leading={<IosIcon icon={UserPlus} tint="orange" size={30} />} title={<span className="font-medium text-[var(--color-primary)]">{tr("Ota-ona qo'shish")}</span>} subtitle={tr("Bola bilan bog'lanish uchun ota-ona qo'shing")} />
                ) : (
                  <EmptyState icon={UserPlus} title="Hali ota-ona biriktirilmagan" />
                )
              ) : (
                <>
                  {guardians.map((link) => (
                    <ListRow
                      key={link.id}
                      onClick={() => setGuardianSheet(link)}
                      avatar={<IosAvatar name={link.guardian.fullName} size={44} />}
                      title={
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{tr(link.guardian.fullName)}</span>
                          {link.isPrimary && <Pill color={IOS.blue}>{tr("Asosiy")}</Pill>}
                        </span>
                      }
                      subtitle={[tr(RELATION[link.relation]), formatPhone(link.guardian.phone), link.canPickup ? tr("olib ketadi") : null].filter(Boolean).join(" · ")}
                      trailing={<CallButton phone={link.guardian.phone} name={link.guardian.fullName} />}
                    />
                  ))}
                  {canWrite && (
                    <Row
                      onClick={() => setCabinetOpen(true)}
                      leading={<IosIcon icon={KeyRound} tint={cabinetHolder ? "green" : "blue"} size={30} />}
                      title={cabinetHolder ? tr("Kabinet ochiq") : tr("Kabinet ochish")}
                      subtitle={
                        cabinetHolder
                          ? tr("Login: {0} · ota-ona ikkalasi shu kabinetdan foydalanadi", formatPhone(cabinetHolder.guardian.phone))
                          : tr("Ota-ona davomat, ovqat va mashg'ulotlarni ko'rishi uchun")
                      }
                    />
                  )}
                </>
              )}
            </Group>

            {child && (
              <Group title={tr("Ma'lumot")}>
                <Row title={tr("Filial")} value={child.branch?.name ? tr(child.branch.name) : "—"} />
                <Row title={tr("Guruh")} value={child.group?.name ? tr(child.group.name) : tr("Guruhsiz")} />
                <Row title={tr("Jinsi")} value={tr(formatGender(child.gender))} />
                <Row title={tr("Tug'ilgan sana")} value={child.birthDate ? `${formatDate(child.birthDate)} · ${tr(formatAge(child.birthDate))}` : "—"} />
                <Row title={tr("ID")} value={<span className="font-mono">{formatChildId(child.publicId)}</span>} />
              </Group>
            )}

            {canReadDiscounts && !discountQuery.isError && (
              <Group title={tr("Chegirma")} bare={discountQuery.isLoading}>
                {discountQuery.isLoading ? (
                  <SkeletonRows rows={1} avatar={false} />
                ) : (
                  (() => {
                    const current = discountQuery.data?.current ?? null;
                    const rule = current?.rule?.isActive ? current.rule : null;
                    return (
                      <Row
                        href={discountsHref}
                        leading={<IosIcon icon={BadgePercent} tint={rule ? "pink" : "gray"} size={30} />}
                        title={rule ? `${ruleLabel(rule, tr)} · ${tr(scopeLabel(rule.scope))}` : tr("Chegirma yo'q")}
                        subtitle={rule ? (rule.reason ?? undefined) : tr("Bosing — chegirma berish yoki o'zgartirish")}
                        value={
                          current && current.discount > 0 ? (
                            <span className="tabular-nums">
                              {groupDigits(current.net)} {tr("so'm")}
                            </span>
                          ) : undefined
                        }
                      />
                    );
                  })()
                )}
              </Group>
            )}

            {canReadMoney && !showCash && (
              <Group title={tr("Moliya")} action={<Link href={financeHref} className="text-[var(--color-primary)] active:opacity-50">{tr("To'liq tarix")}</Link>} bare={ledgerQuery.isLoading || ledgerQuery.isError}>
                {ledgerQuery.isLoading ? (
                  <SkeletonRows rows={2} avatar={false} />
                ) : ledgerQuery.isError ? (
                  <ErrorState message={(ledgerQuery.error as Error).message} onRetry={() => ledgerQuery.refetch()} />
                ) : (ledgerQuery.data ?? []).length === 0 ? (
                  <Row title={<span className="text-[#8e8e93]">{tr("Moliyaviy yozuv yo'q")}</span>} />
                ) : (
                  <>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] text-[#8e8e93]">{tr("Joriy qarzdorlik")}</p>
                      <p className="mt-0.5 text-[28px] font-bold leading-tight tabular-nums" style={{ color: balance > 0.5 ? IOS.red : IOS.green }}>
                        {groupDigits(Math.max(0, balance))} <span className="text-[15px] font-semibold text-[#8e8e93]">{tr("so'm")}</span>
                      </p>
                    </div>
                    {(ledgerQuery.data ?? []).slice(0, 4).map((e) => {
                      const amount = Number(e.amount);
                      return (
                        <Row
                          key={e.id}
                          title={[tr(LEDGER_TYPE[e.type] ?? e.type), e.invoice?.period].filter(Boolean).join(" · ")}
                          subtitle={formatDateTime(e.createdAt)}
                          value={
                            <span className="font-semibold" style={{ color: amount < 0 ? IOS.green : "var(--color-text)" }}>
                              {amount > 0 ? "+" : "−"}
                              {groupDigits(Math.abs(amount))}
                            </span>
                          }
                        />
                      );
                    })}
                  </>
                )}
              </Group>
            )}
          </>
        )}

        {/* ---------------- Davomat ---------------- */}
        {tab === "attendance" &&
          (attendanceQuery.isLoading ? (
            <SkeletonRows rows={4} avatar={false} />
          ) : attendanceQuery.isError ? (
            <ErrorState message={(attendanceQuery.error as Error).message} onRetry={() => attendanceQuery.refetch()} retrying={attendanceQuery.isFetching} />
          ) : (
            <>
              <StatStrip tone="white">
                <StatCell label={tr("Kelgan kunlar")} value={stats?.present ?? 0} color={IOS.green} />
                <StatCell label={tr("Kelmagan kunlar")} value={stats?.absent ?? 0} />
                <StatCell label={tr("Sababli")} value={stats?.excusedAbsent ?? 0} color={stats?.excusedAbsent ? IOS.orange : undefined} />
                <StatCell label={tr("Sababsiz")} value={stats?.unexcusedAbsent ?? 0} color={stats?.unexcusedAbsent ? IOS.red : undefined} />
              </StatStrip>
              {attendanceQuery.data && attendanceQuery.data.records.length > 0 && (
                <ChildAttendanceCalendar slug={slug} childId={childId} year={attendanceQuery.data.year} records={attendanceQuery.data.records} canEditNote={canWriteAttendance} />
              )}
              <ExpandableGroup
                title={tr("Kelmagan kunlar")}
                empty={<EmptyState icon={Check} title="Bu yil hali kelmagan kun yo'q" />}
                items={absences.map((a) => (
                  <Row
                    key={a.date}
                    title={dayLabel(a.date, tr)}
                    subtitle={a.note ? tr(a.note) : tr("Sabab yozilmagan")}
                    value={<Pill color={a.note ? IOS.orange : IOS.red}>{a.note ? tr("Sababli") : tr("Sababsiz")}</Pill>}
                  />
                ))}
              />
            </>
          ))}

        {/* ---------------- Sog'liq ---------------- */}
        {tab === "health" && (
          <>
            <Group
              title={tr("Sog'liq profili")}
              action={canWrite ? <button type="button" className="text-[var(--color-primary)] active:opacity-50" onClick={() => setHealthOpen(true)}>{health ? tr("Tahrirlash") : tr("To'ldirish")}</button> : undefined}
              bare={healthQuery.isLoading || healthQuery.isError}
            >
              {healthQuery.isLoading ? (
                <SkeletonRows rows={3} avatar={false} />
              ) : healthQuery.isError ? (
                <ErrorState message={(healthQuery.error as Error).message} onRetry={() => healthQuery.refetch()} />
              ) : (
                <>
                  <Row leading={<IosIcon icon={HeartPulse} tint="red" size={30} />} title={tr("Qon guruhi")} value={health?.bloodType ? BLOOD_TYPE_LABEL[health.bloodType] : tr("Kiritilmagan")} />
                  <InfoRow icon={TriangleAlert} tint={health?.allergies ? "red" : "gray"} title={tr("Allergiyalar")} text={health?.allergies} danger />
                  <InfoRow icon={HeartPulse} tint="orange" title={tr("Surunkali kasalliklar")} text={health?.chronicConditions} />
                  <InfoRow icon={FileText} tint="gray" title={tr("Qo'shimcha izoh")} text={health?.notes} />
                </>
              )}
            </Group>

            <ExpandableGroup
              title={tr("Emlashlar")}
              action={canWrite ? <button type="button" className="text-[var(--color-primary)] active:opacity-50" onClick={() => setVaccinationOpen(true)}>{tr("Qo'shish")}</button> : undefined}
              loading={vaccinationsQuery.isLoading}
              footer={canWrite && (vaccinationsQuery.data ?? []).some((v) => v.status === "SCHEDULED") ? tr("Rejalashtirilgan emlashni bosing — bajarildi yoki o'tkazib yuborildi deb belgilang.") : undefined}
              empty={<EmptyState icon={Syringe} title="Hali emlash yozuvi yo'q" hint={canWrite ? "«Qo'shish» orqali rejalashtiring" : undefined} />}
              items={(vaccinationsQuery.data ?? []).map((v) => {
                const overdue = isVaccinationOverdue(v);
                const meta = overdue ? { label: "Muddati o'tgan", color: IOS.red } : VACCINATION[v.status];
                return (
                  <Row
                    key={v.id}
                    onClick={canWrite && v.status === "SCHEDULED" ? () => setUpdatingVaccination(v) : undefined}
                    leading={<IosIcon icon={Syringe} tint={overdue ? "red" : v.status === "DONE" ? "green" : "orange"} size={30} />}
                    title={tr(v.name)}
                    subtitle={[v.doneDate ? tr("bajarildi {0}", formatDate(v.doneDate)) : tr("reja {0}", formatDate(v.scheduledDate)), v.note].filter(Boolean).join(" · ")}
                    value={<Pill color={meta.color}>{tr(meta.label)}</Pill>}
                  />
                );
              })}
            />

            <ExpandableGroup
              title={tr("Dori-darmon jurnali")}
              action={canWrite ? <button type="button" className="text-[var(--color-primary)] active:opacity-50" onClick={() => setMedicationOpen(true)}>{tr("Qo'shish")}</button> : undefined}
              loading={medicationsQuery.isLoading}
              empty={<EmptyState icon={PillIcon} title="Hali dori-darmon yozuvi yo'q" />}
              items={(medicationsQuery.data ?? []).map((m) => (
                <Row
                  key={m.id}
                  leading={<IosIcon icon={PillIcon} tint="purple" size={30} />}
                  title={`${tr(m.medicationName)} · ${tr(m.dose)}`}
                  subtitle={[formatDateTime(m.givenAt), m.note].filter(Boolean).join(" · ")}
                  value={<Pill color={m.parentAuthorized ? IOS.green : IOS.red}>{m.parentAuthorized ? tr("Ruxsat bor") : tr("Ruxsatsiz")}</Pill>}
                />
              ))}
            />
          </>
        )}

        {/* ---------------- Rivojlanish ---------------- */}
        {tab === "development" && (
          <>
            <Group
              title={latest ? tr("Rivojlanish · {0}", latest.period) : tr("Rivojlanish")}
              action={canWrite ? <button type="button" className="text-[var(--color-primary)] active:opacity-50" onClick={() => setAssessOpen(true)}>{latest ? tr("Tahrirlash") : tr("Baholash")}</button> : undefined}
              footer={latest?.note ? tr(latest.note) : !latest ? tr("Hali baholanmagan") : undefined}
              bare={developmentQuery.isLoading}
            >
              {developmentQuery.isLoading ? (
                <SkeletonRows rows={4} avatar={false} />
              ) : (
                (
                  [
                    ["Nutq", latest?.speechRating],
                    ["Motorika", latest?.motorRating],
                    ["Ijtimoiy ko'nikma", latest?.socialRating],
                    ["Bilim / idrok", latest?.cognitiveRating],
                  ] as const
                ).map(([label, value]) => (
                  <Row key={label} leading={<IosIcon icon={Sparkles} tint={value ? (value === "BELOW_EXPECTED" ? "red" : value === "ON_TRACK" ? "green" : "blue") : "gray"} size={30} />} title={tr(label)} value={value ? <Pill color={RATING[value].color}>{tr(RATING[value].label)}</Pill> : "—"} />
                ))
              )}
            </Group>

            <ExpandableGroup
              title={tr("Kundalik hisobotlar")}
              loading={reportsQuery.isLoading}
              empty={<EmptyState icon={Baby} title="Hali kundalik hisobot yo'q" hint="Tarbiyachi kunlik hisobot kiritgach, shu yerda ko'rinadi" />}
              items={(reportsQuery.data ?? []).map((r) => (
                <Row
                  key={r.id}
                  onClick={() => setReport(r)}
                  title={dayLabel(r.date, tr)}
                  subtitle={[
                    r.eatingQuality ? `${tr("ovqat")}: ${tr(EATING[r.eatingQuality])}` : null,
                    r.sleepMinutes != null ? `${tr("uyqu")}: ${r.sleepMinutes} ${tr("daq")}` : null,
                    r.mood ? `${tr("kayfiyat")}: ${tr(MOOD[r.mood])}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || tr("Izohlar")}
                />
              ))}
            />
          </>
        )}
      </div>

      {/* ---------------- Varaqlar ---------------- */}
      {child && canWrite && (
        <PhotoSheet open={photoOpen} onClose={() => setPhotoOpen(false)} slug={slug} child={child} />
      )}
      {child && canWrite && <DocsSheet open={docsOpen} onClose={() => setDocsOpen(false)} childId={childId} />}

      <GuardianSheet
        link={guardianSheet}
        onClose={() => setGuardianSheet(null)}
        canWrite={canWrite}
        isCabinet={!!guardianSheet && cabinetHolder?.id === guardianSheet.id}
        slug={slug}
        childId={childId}
        onEdit={(link) => {
          setGuardianSheet(null);
          setEditingLink(link);
        }}
      />

      <IosSheet open={!!report} onClose={() => setReport(null)} title={report ? dayLabel(report.date, tr) : ""} cancelLabel="Yopish">
        {report && (
          <SheetSection>
            <SheetRow label={tr("Ovqatlanishi")}>{report.eatingQuality ? tr(EATING[report.eatingQuality]) : "—"}</SheetRow>
            <SheetRow label={tr("Uyqu")}>{report.sleepMinutes != null ? `${report.sleepMinutes} ${tr("daq")}` : "—"}</SheetRow>
            <SheetRow label={tr("Kayfiyati")}>{report.mood ? tr(MOOD[report.mood]) : "—"}</SheetRow>
            <SheetRow label={tr("Tualet")}>{report.toiletNotes ? tr(report.toiletNotes) : "—"}</SheetRow>
            <SheetRow label={tr("Faoliyat")}>{report.activityNotes ? tr(report.activityNotes) : "—"}</SheetRow>
          </SheetSection>
        )}
      </IosSheet>

      {canWrite && editChildOpen && child && <EditChildModal open={editChildOpen} onClose={() => setEditChildOpen(false)} slug={slug} child={child} />}
      {canWrite && assessOpen && <EditDevelopmentModal open={assessOpen} onClose={() => setAssessOpen(false)} slug={slug} childId={childId} existing={latest} />}
      {canWrite && healthOpen && <EditHealthProfileModal open={healthOpen} onClose={() => setHealthOpen(false)} slug={slug} childId={childId} existing={health} />}
      {canWrite && vaccinationOpen && <AddVaccinationModal open={vaccinationOpen} onClose={() => setVaccinationOpen(false)} slug={slug} childId={childId} />}
      {canWrite && updatingVaccination && (
        <UpdateVaccinationModal open={!!updatingVaccination} onClose={() => setUpdatingVaccination(null)} slug={slug} childId={childId} vaccination={updatingVaccination} />
      )}
      {canWrite && medicationOpen && <AddMedicationModal open={medicationOpen} onClose={() => setMedicationOpen(false)} slug={slug} childId={childId} />}
      {canWrite && guardianOpen && <AddGuardianModal open={guardianOpen} onClose={() => setGuardianOpen(false)} slug={slug} childId={childId} />}
      {canWrite && cabinetOpen && child && (
        <ParentCabinetModal open={cabinetOpen} onClose={() => setCabinetOpen(false)} slug={slug} childId={childId} childName={child.fullName} links={guardians} />
      )}
      {canWrite && editingLink && <EditGuardianLinkModal open={!!editingLink} onClose={() => setEditingLink(null)} slug={slug} childId={childId} link={editingLink} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Sarlavhadagi tezkor amal: rangli doira va nom (iOS "Kontaktlar" uslubi) */
function QuickAction({ icon: Icon, label, color, onClick, href }: { icon: ComponentType<{ className?: string; strokeWidth?: number }>; label: string; color: string; onClick?: () => void; href?: string }) {
  const disabled = !onClick && !href;
  const body = (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: disabled ? "#767680" + "1f" : `${color}1f`, color: disabled ? "#c7c7cc" : color }}>
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className={clsx("text-[12px] font-medium", disabled ? "text-[#c7c7cc]" : "text-[var(--color-text)]")}>{label}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-1.5 rounded-[14px] py-2 transition-transform active:scale-95";
  if (href) {
    return href.startsWith("tel:") ? (
      <a href={href} className={cls}>
        {body}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {body}
    </button>
  );
}

/** ID kapsulasi — bosilsa nusxalanadi */
function CopyChip({ value }: { value: string }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // brauzer ruxsat bermasa — jim
        }
      }}
      className="inline-flex h-6 items-center gap-1 rounded-full bg-[#767680]/[0.12] px-2.5 font-mono text-[12.5px] font-semibold tabular-nums text-[var(--color-text)] active:scale-95"
      aria-label={tr("ID nusxalash")}
    >
      {value}
      {copied ? <Check className="h-3 w-3 text-[#34c759]" strokeWidth={3} /> : <Copy className="h-3 w-3 text-[#8e8e93]" strokeWidth={2.4} />}
    </button>
  );
}

function CallButton({ phone, name }: { phone: string; name: string }) {
  const tr = useTr();
  return (
    <a
      href={`tel:${phone}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={tr("{0} ga qo'ng'iroq: {1}", name, phone)}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759] transition-transform active:scale-90"
    >
      <Phone className="h-[17px] w-[17px]" strokeWidth={2.2} />
    </a>
  );
}

/** Matnli ma'lumot qatori (bo'sh bo'lsa "Kiritilmagan"), uzun matn qatorga o'raladi */
function InfoRow({ icon, tint, title, text, danger }: { icon: AnyIcon; tint: "red" | "orange" | "gray"; title: string; text?: string | null; danger?: boolean }) {
  const tr = useTr();
  return (
    <div className="group/row relative flex min-h-[52px] items-start gap-3 px-4 py-2.5">
      <IosIcon icon={icon} tint={tint} size={30} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-[var(--color-text)]">{title}</p>
        <p className={clsx("whitespace-pre-wrap break-words text-[13px]", text ? (danger ? "font-medium text-[#ff3b30]" : "text-[#6d6d72]") : "text-[#8e8e93]")}>{text ? tr(text) : tr("Kiritilmagan")}</p>
      </div>
      <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
    </div>
  );
}

/** Uzun ro'yxat: dastlab 8 ta, qolgani "Hammasini ko'rsatish" bilan */
function ExpandableGroup({ title, action, footer, items, empty, loading }: { title: ReactNode; action?: ReactNode; footer?: ReactNode; items: ReactNode[]; empty: ReactNode; loading?: boolean }) {
  const tr = useTr();
  const [all, setAll] = useState(false);
  const LIMIT = 8;
  const shown = all ? items : items.slice(0, LIMIT);
  return (
    <Group title={title} action={action} footer={items.length ? footer : undefined} bare={loading || items.length === 0}>
      {loading ? (
        <SkeletonRows rows={3} avatar={false} />
      ) : items.length === 0 ? (
        empty
      ) : (
        <>
          {shown}
          {items.length > LIMIT && (
            <button type="button" onClick={() => setAll((v) => !v)} className={clsx("group/row relative flex h-12 w-full items-center justify-center text-[15px] font-medium text-[var(--color-primary)]", ROW_PRESS)}>
              {all ? tr("Kamroq ko'rsatish") : tr("Hammasini ko'rsatish ({0})", items.length)}
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </Group>
  );
}

/** Surat varag'i: yuz tekshiruvi va kesish brauzerda, keyin saqlanadi; o'chirish */
function PhotoSheet({ open, onClose, slug, child }: { open: boolean; onClose: () => void; slug: string; child: Child }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setConfirmRemove(false);
    }
  }, [open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["child", slug, child.id] });
    queryClient.invalidateQueries({ queryKey: ["children", slug] });
  };
  const upload = useMutation({
    mutationFn: (image: string) => api.put(`/app/children/${child.id}/avatar`, { image }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Suratni saqlab bo'lmadi")),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/app/children/${child.id}/avatar`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Suratni o'chirib bo'lmadi")),
  });

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setChecking(true);
    try {
      // Yuz tekshiruvi va kesish shu yerda — natija tayyor bo'lsagina yuboriladi
      const result = await prepareChildPhoto(file);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      upload.mutate(result.image);
    } finally {
      setChecking(false);
    }
  };
  const busy = checking || upload.isPending || remove.isPending;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Surat")}
      footer={
        confirmRemove ? (
          <div className="space-y-2.5">
            <button type="button" disabled={busy} onClick={() => remove.mutate()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white active:scale-[0.96] disabled:opacity-60">
              {remove.isPending ? <Spinner className="h-5 w-5 text-white" /> : <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
              {tr("O'chirish")}
            </button>
            <SheetSecondaryButton onClick={() => setConfirmRemove(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
          </div>
        ) : (
          <div className="space-y-2.5">
            <SheetPrimaryButton loading={checking || upload.isPending} onClick={() => inputRef.current?.click()}>
              <Camera className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {child.avatarUpdatedAt ? tr("Suratni almashtirish") : tr("Surat qo'yish")}
            </SheetPrimaryButton>
            {child.avatarUpdatedAt && (
              <SheetSecondaryButton danger onClick={() => setConfirmRemove(true)}>
                {tr("Suratni o'chirish")}
              </SheetSecondaryButton>
            )}
          </div>
        )
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <ChildPhoto child={child} size={120} fallback={initials(child.fullName)} />
        <p className="max-w-[300px] text-[13px] leading-snug text-[#8e8e93]">
          {checking ? tr("Surat tekshirilmoqda…") : confirmRemove ? tr("Surat o'chiriladi, o'rniga bosh harflar ko'rinadi.") : tr("Yuzi ko'rinib turgan surat, 3 MB gacha. Yuz avtomatik topiladi va kesiladi.")}
        </p>
        {error && (
          <p role="alert" className="rounded-[12px] bg-[#ff3b30]/[0.1] px-3 py-2 text-[13px] text-[#ff3b30]">
            {tr(error)}
          </p>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
    </IosSheet>
  );
}

/** Hujjatlar: shartnoma va ma'lumotnoma (PDF) */
function DocsSheet({ open, onClose, childId }: { open: boolean; onClose: () => void; childId: string }) {
  const tr = useTr();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docs = [
    { kind: "contract", title: "Shartnoma", hint: "Ota-ona bilan tuziladigan shartnoma", file: "shartnoma" },
    { kind: "certificate", title: "Ma'lumotnoma", hint: "Bog'chaga qatnashini tasdiqlovchi ma'lumotnoma", file: "malumotnoma" },
  ];
  const download = async (kind: string, file: string) => {
    setLoading(kind);
    setError(null);
    try {
      await downloadCsv(`/app/exports/children/${childId}/${kind}-pdf`, `${file}-${childId}.pdf`);
    } catch {
      setError(tr("Hujjatni yuklab bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setLoading(null);
    }
  };
  return (
    <IosSheet open={open} onClose={onClose} title={tr("Hujjatlar")} cancelLabel="Yopish">
      <SheetSection footer={tr("PDF fayl yuklab olinadi — chop etish yoki ota-onaga yuborish mumkin.")}>
        {docs.map((d) => (
          <div key={d.kind} className="group/row relative">
            <button type="button" disabled={!!loading} onClick={() => download(d.kind, d.file)} className={clsx("flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}>
              <IosIcon icon={FileText} tint={d.kind === "contract" ? "blue" : "green"} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-[var(--color-text)]">{tr(d.title)} (PDF)</span>
                <span className="block truncate text-[12.5px] text-[#8e8e93]">{tr(d.hint)}</span>
              </span>
              {loading === d.kind ? <Spinner className="h-5 w-5 text-[#8e8e93]" /> : <span className="text-[14px] font-medium text-[var(--color-primary)]">{tr("Yuklash")}</span>}
            </button>
            <span className={ROW_SEPARATOR} style={{ left: 64 }} aria-hidden="true" />
          </div>
        ))}
      </SheetSection>
      {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
    </IosSheet>
  );
}

/**
 * Ota-ona varag'i: qo'ng'iroq va nusxalash, huquqlar (asosiy, olib ketadi,
 * moliya, bildirishnoma), tahrirlash va bog'lanishni o'chirish (ikkinchi
 * bosqich — sheet ichida tasdiqlash).
 */
function GuardianSheet({
  link,
  onClose,
  canWrite,
  isCabinet,
  slug,
  childId,
  onEdit,
}: {
  link: ChildGuardian | null;
  onClose: () => void;
  canWrite: boolean;
  isCabinet: boolean;
  slug: string;
  childId: string;
  onEdit: (link: ChildGuardian) => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setConfirm(false);
    setCopied(false);
  }, [link]);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/app/child-guardians/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      onClose();
    },
  });

  const rights = link
    ? [
        { on: link.isPrimary, label: "Asosiy aloqa", hint: "Birinchi navbatda shu raqamga qo'ng'iroq qilinadi" },
        { on: link.canPickup, label: "Olib keta oladi", hint: "Bolani bog'chadan olib ketishga ruxsat" },
        { on: link.canViewFinance, label: "Moliyani ko'radi", hint: "Kabinetda to'lov va qarzni ko'radi" },
        { on: link.canReceiveNotifications, label: "Bildirishnoma oladi", hint: "Kelmadi, to'lov eslatmasi va boshqa xabarlar" },
      ]
    : [];

  return (
    <IosSheet
      open={!!link}
      onClose={() => !remove.isPending && onClose()}
      title={confirm ? tr("Bog'lanishni o'chirish") : tr("Ota-ona")}
      cancelLabel={confirm ? "Orqaga" : "Yopish"}
      footer={
        link && canWrite ? (
          confirm ? (
            <div className="space-y-2.5">
              <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(link.id)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white active:scale-[0.96] disabled:opacity-60">
                {remove.isPending ? <Spinner className="h-5 w-5 text-white" /> : <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
                {tr("O'chirish")}
              </button>
              <SheetSecondaryButton onClick={() => setConfirm(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
            </div>
          ) : (
            <div className="space-y-2.5">
              <SheetPrimaryButton onClick={() => onEdit(link)}>
                <Pencil className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {tr("Huquqlarni tahrirlash")}
              </SheetPrimaryButton>
              <SheetSecondaryButton danger onClick={() => setConfirm(true)}>
                {tr("Bog'lanishni o'chirish")}
              </SheetSecondaryButton>
            </div>
          )
        ) : undefined
      }
    >
      {link && (
        <>
          <div className="flex flex-col items-center gap-2 pt-1 text-center">
            <IosAvatar name={link.guardian.fullName} size={64} />
            <p className="text-[18px] font-semibold text-[var(--color-text)]">{tr(link.guardian.fullName)}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Pill>{tr(RELATION[link.relation])}</Pill>
              {isCabinet && <Pill color={IOS.green}>{tr("Kabinet logini")}</Pill>}
            </div>
          </div>

          {confirm ? (
            <p className="flex items-start gap-3 rounded-[16px] bg-[#ff3b30]/[0.1] px-4 py-3.5 text-[14px] leading-snug text-[var(--color-text)]">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#ff3b30]" strokeWidth={2.2} />
              {tr("Shu bola bilan bog'lanish o'chiriladi. Ota-onaning o'zi tizimda qoladi — boshqa farzandlari bilan aloqasi saqlanadi.")}
            </p>
          ) : (
            <>
              <SheetSection>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[20px] font-semibold tabular-nums text-[var(--color-text)]">{formatPhone(link.guardian.phone)}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link.guardian.phone);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        // ruxsat yo'q — jim
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#8e8e93] active:scale-90"
                    aria-label={tr("Telefon raqamini nusxalash")}
                  >
                    {copied ? <Check className="h-[18px] w-[18px] text-[#34c759]" strokeWidth={3} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2.2} />}
                  </button>
                  <a href={`tel:${link.guardian.phone}`} className="flex h-10 items-center gap-1.5 rounded-full bg-[#34c759] px-4 text-[15px] font-semibold text-white active:scale-95">
                    <Phone className="h-4 w-4" strokeWidth={2.4} />
                    {tr("Qo'ng'iroq")}
                  </a>
                </div>
              </SheetSection>
              <SheetSection title={tr("Huquqlar")}>
                {rights.map((r) => (
                  <div key={r.label} className="group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-[var(--color-text)]">{tr(r.label)}</span>
                      <span className="block truncate text-[12.5px] text-[#8e8e93]">{tr(r.hint)}</span>
                    </span>
                    <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", r.on ? "bg-[#34c759] text-white" : "bg-[#767680]/[0.12] text-[#c7c7cc]")}>
                      {r.on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5 rotate-45" strokeWidth={3} />}
                    </span>
                    <span className={ROW_SEPARATOR} aria-hidden="true" />
                  </div>
                ))}
              </SheetSection>
            </>
          )}
          {remove.isError && <p className="px-4 text-[13px] text-[#ff3b30]">{remove.error instanceof ApiError ? tr(remove.error.message) : tr("O'chirib bo'lmadi")}</p>}
        </>
      )}
    </IosSheet>
  );
}
