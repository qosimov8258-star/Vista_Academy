"use client";

import { use, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  Child,
  DailyReport,
  DevelopmentAssessment,
  HealthProfile,
  Vaccination,
  MedicationLog,
  ChildGuardian,
} from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ArrowLeftIcon, CalendarIcon, ChecklistIcon, GroupIcon, NoteIcon, PhoneIcon } from "@/components/ui/icons";
import { CopyButton } from "@/components/ui/copy-button";
import { initials } from "@/components/ui/avatar";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatAge, formatChildId, formatDate, formatDateTime, formatGender, formatPhone } from "@/lib/format";
import { useBranchContext } from "@/lib/use-branch-context";
import { EditDevelopmentModal } from "@/features/development/edit-development-modal";
import { EditHealthProfileModal, BLOOD_TYPE_LABEL } from "@/features/child-health/edit-health-profile-modal";
import { AddVaccinationModal } from "@/features/child-health/add-vaccination-modal";
import { UpdateVaccinationModal } from "@/features/child-health/update-vaccination-modal";
import { AddMedicationModal } from "@/features/child-health/add-medication-modal";
import { QuarantineModal } from "@/features/child-health/quarantine-modal";
import { AddGuardianModal } from "@/features/guardians/add-guardian-modal";
import { EditGuardianLinkModal } from "@/features/guardians/edit-guardian-link-modal";
import { canWriteOperational } from "@/lib/permissions";

const VACCINATION_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Rejalashtirilgan",
  DONE: "Bajarildi",
  MISSED: "O'tkazib yuborildi",
};
const VACCINATION_STATUS_TONE: Record<string, "warning" | "success" | "danger"> = {
  SCHEDULED: "warning",
  DONE: "success",
  MISSED: "danger",
};
const GUARDIAN_RELATION_LABEL: Record<string, string> = {
  FATHER: "Ota",
  MOTHER: "Ona",
  GRANDPARENT: "Bobo/Buvi",
  OTHER: "Boshqa",
};

const EATING_LABEL: Record<string, string> = { GOOD: "Yaxshi", AVERAGE: "O'rtacha", POOR: "Yomon" };
const MOOD_LABEL: Record<string, string> = { HAPPY: "Xursand", NEUTRAL: "Oddiy", UPSET: "Xafa" };
const RATING_LABEL: Record<string, string> = {
  BELOW_EXPECTED: "Kutilganidan past",
  ON_TRACK: "Yoshiga mos",
  ABOVE_EXPECTED: "Kutilganidan yuqori",
};
const RATING_TONE: Record<string, "danger" | "success" | "primary"> = {
  BELOW_EXPECTED: "danger",
  ON_TRACK: "success",
  ABOVE_EXPECTED: "primary",
};

/** Bolaning bitta fakti — sarlavha ostidagi to'rt katakli qatordan biri. */
function Fact({
  label,
  value,
  hint,
  muted,
  numeric,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className="px-5 py-3.5 sm:px-6">
      <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={clsx(
          "mt-1 truncate text-[15px] font-medium",
          numeric && "tabular-nums",
          muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]",
        )}
      >
        {value}
      </dd>
      {hint && <p className="text-[12px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

function RatingBadge({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{label}</p>
      {value ? (
        <Badge tone={RATING_TONE[value]} className="mt-1.5">
          {RATING_LABEL[value]}
        </Badge>
      ) : (
        <p className="mt-1.5 text-[14px] font-medium text-[var(--color-text-muted)]">—</p>
      )}
    </div>
  );
}

export default function ChildDetailPage({ params }: { params: Promise<{ slug: string; childId: string }> }) {
  const { slug, childId } = use(params);
  const [assessOpen, setAssessOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [vaccinationOpen, setVaccinationOpen] = useState(false);
  const [updatingVaccination, setUpdatingVaccination] = useState<Vaccination | null>(null);
  const [medicationOpen, setMedicationOpen] = useState(false);
  const [quarantineOpen, setQuarantineOpen] = useState(false);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ChildGuardian | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const queryClient = useQueryClient();
  const { branchSlug } = useBranchContext(slug);
  const childrenHref = branchSlug ? `/${slug}/${branchSlug}/children` : `/${slug}/children`;

  const childQuery = useQuery({
    queryKey: ["child", slug, childId],
    queryFn: () => api.get<Child>(`/app/children/${childId}`),
  });

  const reportsQuery = useQuery({
    queryKey: ["daily-reports-history", slug, childId],
    queryFn: () => api.get<DailyReport[]>(`/app/children/${childId}/daily-reports`),
  });

  const developmentQuery = useQuery({
    queryKey: ["development", slug, childId],
    queryFn: () => api.get<DevelopmentAssessment[]>(`/app/children/${childId}/development`),
  });

  const healthQuery = useQuery({
    queryKey: ["child-health", slug, childId],
    queryFn: () => api.get<HealthProfile | null>(`/app/children/${childId}/health`),
  });

  const vaccinationsQuery = useQuery({
    queryKey: ["vaccinations", slug, childId],
    queryFn: () => api.get<Vaccination[]>(`/app/children/${childId}/vaccinations`),
  });

  const medicationsQuery = useQuery({
    queryKey: ["medications", slug, childId],
    queryFn: () => api.get<MedicationLog[]>(`/app/children/${childId}/medications`),
  });

  const guardiansQuery = useQuery({
    queryKey: ["child-guardians", slug, childId],
    queryFn: () => api.get<ChildGuardian[]>(`/app/children/${childId}/guardians`),
  });

  const clearQuarantineMutation = useMutation({
    mutationFn: () => api.delete(`/app/children/${childId}/quarantine`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child", slug, childId] });
    },
  });

  if (childQuery.isLoading) return <LoadingState />;
  if (childQuery.isError) return <ErrorState message={(childQuery.error as Error).message} />;
  const child = childQuery.data;
  if (!child) return null;

  const latestAssessment = developmentQuery.data?.[0] ?? null;
  const health = healthQuery.data ?? null;

  return (
    <div className="space-y-5">
      <Link
        href={childrenHref}
        className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
        Bolalar
      </Link>

      {/* Bolaning asosiy ma'lumotlari — ilgari sarlavha ostidagi bitta kulrang
          qatorda edi va o'qilmasdi. Endi har bir fakt alohida katakda. */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-6">
          <span
            className={clsx(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[20px] font-semibold ring-1 ring-inset ring-[rgba(16,24,40,0.06)]",
              child.gender === "MALE"
                ? "bg-sky-50 text-sky-700"
                : child.gender === "FEMALE"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
            )}
          >
            {initials(child.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-semibold leading-tight tracking-[var(--tracking-title)] text-[var(--color-text)]">
                {child.fullName}
              </h1>
              <Badge tone={child.status === "ACTIVE" ? "success" : child.status === "QUARANTINED" ? "danger" : "neutral"}>
                {child.status === "ACTIVE" ? "Faol" : child.status === "QUARANTINED" ? "Karantinda" : "Nofaol"}
              </Badge>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                {formatChildId(child.publicId)}
              </span>
              <CopyButton value={formatChildId(child.publicId)} label="ID nusxalash" />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--color-separator)] border-t border-[var(--color-separator)] sm:grid-cols-4 sm:divide-y-0">
          <Fact label="Filial" value={child.branch?.name ?? "—"} />
          <Fact label="Guruh" value={child.group?.name ?? "Guruhsiz"} muted={!child.group} />
          <Fact label="Jinsi" value={formatGender(child.gender)} muted={!child.gender} />
          <Fact
            label="Tug'ilgan sana"
            value={child.birthDate ? formatDate(child.birthDate) : "—"}
            hint={child.birthDate ? formatAge(child.birthDate) : undefined}
            numeric
          />
        </dl>
      </Card>

      {/* Bog'lanish uchun ota-ona shu yerda — ro'yxatning pastida emas */}
      <Card className="overflow-hidden">
        <div className="hairline flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
              Bog&apos;langan ota-ona
            </h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Telefon raqamini bosib nusxalang</p>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setGuardianOpen(true)}>
              + Ota-ona qo&apos;shish
            </Button>
          )}
        </div>
        {guardiansQuery.isLoading ? (
          <div className="px-5 py-5 sm:px-6">
            <LoadingState rows={2} />
          </div>
        ) : guardiansQuery.isError ? (
          <div className="px-5 py-5 sm:px-6">
            <ErrorState message={(guardiansQuery.error as Error).message} />
          </div>
        ) : !guardiansQuery.data || guardiansQuery.data.length === 0 ? (
          <div className="px-5 py-5 sm:px-6">
            <EmptyState
              title="Hali ota-ona biriktirilmagan"
              description={canWrite ? "Bola bilan bog'lanish uchun ota-ona qo'shing" : undefined}
              icon={<GroupIcon className="h-[26px] w-[26px]" />}
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-separator)]">
            {guardiansQuery.data.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[12px] font-semibold text-[var(--color-primary)]">
                  {initials(link.guardian.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[15px] font-medium text-[var(--color-text)]">
                      {link.guardian.fullName}
                    </p>
                    {link.isPrimary && <Badge tone="primary">Asosiy</Badge>}
                  </div>
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">
                    {GUARDIAN_RELATION_LABEL[link.relation]}
                    {link.canPickup && " · olib ketadi"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`tel:${link.guardian.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-sunken)] px-3 py-1.5 text-[14px] font-medium tabular-nums text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                  >
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {formatPhone(link.guardian.phone)}
                  </a>
                  <CopyButton value={link.guardian.phone} label="Telefon raqamini nusxalash" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {child.status === "QUARANTINED" ? (
        <Card className="border-[var(--color-danger)]/40 shadow-[var(--shadow-raised)]">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-[var(--color-danger)]">Bola karantinda</CardTitle>
            {canWrite && (
              <Button size="sm" variant="danger" loading={clearQuarantineMutation.isPending} onClick={() => clearQuarantineMutation.mutate()}>
                Karantinni yopish
              </Button>
            )}
          </CardHeader>
          <CardBody className="space-y-1.5 text-[14px]">
            <p className="text-[var(--color-text)]">
              <span className="text-[var(--color-text-muted)]">Sabab: </span>
              {child.quarantineReason ?? "—"}
            </p>
            <p className="text-[var(--color-text)]">
              <span className="text-[var(--color-text-muted)]">Qaysi sanagacha: </span>
              {child.quarantineUntil ? formatDate(child.quarantineUntil) : "—"}
            </p>
            {clearQuarantineMutation.isError && (
              <p className="text-[var(--color-danger)]">
                {clearQuarantineMutation.error instanceof ApiError
                  ? clearQuarantineMutation.error.message
                  : "Kutilmagan xatolik yuz berdi"}
              </p>
            )}
          </CardBody>
        </Card>
      ) : (
        canWrite && (
          <div className="flex justify-end">
            <Button size="sm" variant="danger" onClick={() => setQuarantineOpen(true)}>
              Karantin e&apos;lon qilish
            </Button>
          </div>
        )
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Rivojlanish ({latestAssessment?.period ?? "hali baholanmagan"})</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setAssessOpen(true)}>
              {latestAssessment ? "Tahrirlash" : "Baholash"}
            </Button>
          )}
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RatingBadge label="Nutq" value={latestAssessment?.speechRating ?? null} />
          <RatingBadge label="Motorika" value={latestAssessment?.motorRating ?? null} />
          <RatingBadge label="Ijtimoiy ko'nikma" value={latestAssessment?.socialRating ?? null} />
          <RatingBadge label="Bilim / idrok" value={latestAssessment?.cognitiveRating ?? null} />
        </CardBody>
        {latestAssessment?.note && (
          <CardBody className="pt-0 text-[14px] text-[var(--color-text-muted)]">{latestAssessment.note}</CardBody>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Kundalik hisobotlar tarixi</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {reportsQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={4} />
            </div>
          ) : reportsQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(reportsQuery.error as Error).message} />
            </div>
          ) : !reportsQuery.data || reportsQuery.data.length === 0 ? (
            <EmptyState
              title="Hali kundalik hisobot yo'q"
              description="Tarbiyachi kunlik hisobot kiritgach, shu yerda ko'rinadi"
              icon={<CalendarIcon className="h-[26px] w-[26px]" />}
            />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Sana</Th>
                  <Th>Ovqatlanishi</Th>
                  <Th numeric>Uyqu</Th>
                  <Th>Kayfiyati</Th>
                  <Th>Faoliyat</Th>
                </tr>
              </THead>
              <TBody>
                {reportsQuery.data.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium tabular-nums">{formatDate(r.date)}</Td>
                    <Td className="text-[var(--color-text-muted)]">
                      {r.eatingQuality ? EATING_LABEL[r.eatingQuality] : "—"}
                    </Td>
                    <Td numeric className="text-[var(--color-text-muted)]">
                      {r.sleepMinutes != null ? `${r.sleepMinutes} daq` : "—"}
                    </Td>
                    <Td className="text-[var(--color-text-muted)]">{r.mood ? MOOD_LABEL[r.mood] : "—"}</Td>
                    <Td className="text-[var(--color-text-muted)]">{r.activityNotes || "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Sog'liq profili</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setHealthOpen(true)}>
              {health ? "Tahrirlash" : "To'ldirish"}
            </Button>
          )}
        </CardHeader>
        <CardBody>
          {healthQuery.isLoading ? (
            <LoadingState rows={2} />
          ) : healthQuery.isError ? (
            <ErrorState message={(healthQuery.error as Error).message} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
                <p className="text-[12.5px] text-[var(--color-text-muted)]">Qon guruhi</p>
                <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">
                  {health?.bloodType ? BLOOD_TYPE_LABEL[health.bloodType] : "Hali kiritilmagan"}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
                <p className="text-[12.5px] text-[var(--color-text-muted)]">Allergiyalar</p>
                <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">{health?.allergies || "Hali kiritilmagan"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
                <p className="text-[12.5px] text-[var(--color-text-muted)]">Surunkali kasalliklar</p>
                <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">{health?.chronicConditions || "Hali kiritilmagan"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
                <p className="text-[12.5px] text-[var(--color-text-muted)]">Qo'shimcha izoh</p>
                <p className="mt-1 text-[14px] font-medium text-[var(--color-text)]">{health?.notes || "Hali kiritilmagan"}</p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Vaksinatsiyalar</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setVaccinationOpen(true)}>
              + Yangi vaksinatsiya
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {vaccinationsQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : vaccinationsQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(vaccinationsQuery.error as Error).message} />
            </div>
          ) : !vaccinationsQuery.data || vaccinationsQuery.data.length === 0 ? (
            <EmptyState
              title="Hali vaksinatsiya yo'q"
              description={canWrite ? "Yangi vaksinatsiya qo'shish uchun tugmani bosing" : undefined}
              icon={<ChecklistIcon className="h-[26px] w-[26px]" />}
            />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Nomi</Th>
                  <Th>Rejalashtirilgan sana</Th>
                  <Th>Holati</Th>
                  <Th>Bajarilgan sana</Th>
                  <Th>Izoh</Th>
                  {canWrite && <Th />}
                </tr>
              </THead>
              <TBody>
                {vaccinationsQuery.data.map((v) => (
                  <Tr key={v.id}>
                    <Td className="font-medium">{v.name}</Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDate(v.scheduledDate)}</Td>
                    <Td>
                      <Badge tone={VACCINATION_STATUS_TONE[v.status]}>{VACCINATION_STATUS_LABEL[v.status]}</Badge>
                    </Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{v.doneDate ? formatDate(v.doneDate) : "—"}</Td>
                    <Td className="text-[var(--color-text-muted)]">{v.note || "—"}</Td>
                    {canWrite && (
                      <Td className="text-right">
                        {v.status === "SCHEDULED" && (
                          <Button size="sm" variant="ghost" onClick={() => setUpdatingVaccination(v)}>
                            Yangilash
                          </Button>
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Dori-darmon jurnali</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setMedicationOpen(true)}>
              + Yangi yozuv
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {medicationsQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : medicationsQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(medicationsQuery.error as Error).message} />
            </div>
          ) : !medicationsQuery.data || medicationsQuery.data.length === 0 ? (
            <EmptyState
              title="Hali dori-darmon yozuvi yo'q"
              description={canWrite ? "Yangi yozuv qo'shish uchun tugmani bosing" : undefined}
              icon={<NoteIcon className="h-[26px] w-[26px]" />}
            />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Dori nomi</Th>
                  <Th>Doza</Th>
                  <Th>Berilgan vaqti</Th>
                  <Th>Ota-ona ruxsati</Th>
                  <Th>Izoh</Th>
                </tr>
              </THead>
              <TBody>
                {medicationsQuery.data.map((m) => (
                  <Tr key={m.id}>
                    <Td className="font-medium">{m.medicationName}</Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{m.dose}</Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDateTime(m.givenAt)}</Td>
                    <Td>
                      <Badge tone={m.parentAuthorized ? "success" : "danger"}>
                        {m.parentAuthorized ? "Ha" : "Yo'q"}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--color-text-muted)]">{m.note || "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Ota-ona huquqlari</CardTitle>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              Kim olib keta oladi, kim moliyani ko&apos;radi, kimga bildirishnoma boradi
            </p>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {guardiansQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={2} />
            </div>
          ) : guardiansQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(guardiansQuery.error as Error).message} />
            </div>
          ) : !guardiansQuery.data || guardiansQuery.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState title="Hali ota-ona biriktirilmagan" icon={<GroupIcon className="h-[26px] w-[26px]" />} />
            </div>
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Ism</Th>
                  <Th>Telefon</Th>
                  <Th>Qarindoshlik</Th>
                  <Th>Belgilar</Th>
                  {canWrite && <Th />}
                </tr>
              </THead>
              <TBody>
                {guardiansQuery.data.map((link) => (
                  <Tr key={link.id}>
                    <Td className="font-medium">{link.guardian.fullName}</Td>
                    <Td nowrap>
                      <span className="inline-flex items-center gap-1">
                        <a
                          href={`tel:${link.guardian.phone}`}
                          className="tabular-nums text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
                        >
                          {formatPhone(link.guardian.phone)}
                        </a>
                        <CopyButton value={link.guardian.phone} label="Telefon raqamini nusxalash" />
                      </span>
                    </Td>
                    <Td className="text-[var(--color-text-muted)]">{GUARDIAN_RELATION_LABEL[link.relation]}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {link.isPrimary && <Badge tone="primary">Asosiy</Badge>}
                        {link.canPickup && <Badge tone="success">Olib ketadi</Badge>}
                        {link.canViewFinance && <Badge tone="neutral">Moliya</Badge>}
                        {link.canReceiveNotifications && <Badge tone="neutral">Bildirishnoma</Badge>}
                      </div>
                    </Td>
                    {canWrite && (
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditingLink(link)}>
                          Tahrirlash
                        </Button>
                      </Td>
                    )}
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      {canWrite && assessOpen && (
        <EditDevelopmentModal
          open={assessOpen}
          onClose={() => setAssessOpen(false)}
          slug={slug}
          childId={childId}
          existing={latestAssessment}
        />
      )}

      {canWrite && healthOpen && (
        <EditHealthProfileModal open={healthOpen} onClose={() => setHealthOpen(false)} slug={slug} childId={childId} existing={health} />
      )}

      {canWrite && vaccinationOpen && (
        <AddVaccinationModal open={vaccinationOpen} onClose={() => setVaccinationOpen(false)} slug={slug} childId={childId} />
      )}

      {canWrite && updatingVaccination && (
        <UpdateVaccinationModal
          open={!!updatingVaccination}
          onClose={() => setUpdatingVaccination(null)}
          slug={slug}
          childId={childId}
          vaccination={updatingVaccination}
        />
      )}

      {canWrite && medicationOpen && (
        <AddMedicationModal open={medicationOpen} onClose={() => setMedicationOpen(false)} slug={slug} childId={childId} />
      )}

      {canWrite && quarantineOpen && (
        <QuarantineModal open={quarantineOpen} onClose={() => setQuarantineOpen(false)} slug={slug} childId={childId} />
      )}

      {canWrite && guardianOpen && (
        <AddGuardianModal open={guardianOpen} onClose={() => setGuardianOpen(false)} slug={slug} childId={childId} />
      )}

      {canWrite && editingLink && (
        <EditGuardianLinkModal
          open={!!editingLink}
          onClose={() => setEditingLink(null)}
          slug={slug}
          childId={childId}
          link={editingLink}
        />
      )}
    </div>
  );
}
