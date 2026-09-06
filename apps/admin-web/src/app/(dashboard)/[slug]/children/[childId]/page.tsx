"use client";

import { use, useState } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate, formatDateTime } from "@/lib/format";
import { useBranchContext } from "@/lib/use-branch-context";
import { EditDevelopmentModal } from "@/features/development/edit-development-modal";
import { EditHealthProfileModal, BLOOD_TYPE_LABEL } from "@/features/child-health/edit-health-profile-modal";
import { AddVaccinationModal } from "@/features/child-health/add-vaccination-modal";
import { UpdateVaccinationModal } from "@/features/child-health/update-vaccination-modal";
import { AddMedicationModal } from "@/features/child-health/add-medication-modal";
import { QuarantineModal } from "@/features/child-health/quarantine-modal";
import { AddGuardianModal } from "@/features/guardians/add-guardian-modal";
import { EditGuardianLinkModal } from "@/features/guardians/edit-guardian-link-modal";

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

function RatingBadge({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      {value ? (
        <Badge tone={RATING_TONE[value]} className="mt-1">
          {RATING_LABEL[value]}
        </Badge>
      ) : (
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">—</p>
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
  const canWrite = user?.role !== "NETWORK_ADMIN";
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
    <div className="space-y-6">
      <div>
        <Link href={childrenHref} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← Bolalar
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{child.fullName}</h1>
          <Badge tone={child.status === "ACTIVE" ? "success" : child.status === "QUARANTINED" ? "danger" : "neutral"}>
            {child.status === "ACTIVE" ? "Faol" : child.status === "QUARANTINED" ? "Karantinda" : "Nofaol"}
          </Badge>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {child.branch?.name ?? "—"} • {child.group?.name ?? "Guruhsiz"}
          {child.birthDate ? ` • ${formatDate(child.birthDate)}` : ""}
        </p>
      </div>

      {!canWrite && <ViewOnlyNote />}

      {child.status === "QUARANTINED" ? (
        <Card className="border-[var(--color-danger)]/40">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-[var(--color-danger)]">Bola karantinda</CardTitle>
            {canWrite && (
              <Button size="sm" variant="danger" loading={clearQuarantineMutation.isPending} onClick={() => clearQuarantineMutation.mutate()}>
                Karantinni yopish
              </Button>
            )}
          </CardHeader>
          <CardBody className="space-y-1 text-sm">
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
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Rivojlanish ({latestAssessment?.period ?? "hali baholanmagan"})</CardTitle>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setAssessOpen(true)}>
              {latestAssessment ? "Tahrirlash" : "Baholash"}
            </Button>
          )}
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <RatingBadge label="Nutq" value={latestAssessment?.speechRating ?? null} />
          <RatingBadge label="Motorika" value={latestAssessment?.motorRating ?? null} />
          <RatingBadge label="Ijtimoiy ko'nikma" value={latestAssessment?.socialRating ?? null} />
          <RatingBadge label="Bilim / idrok" value={latestAssessment?.cognitiveRating ?? null} />
        </CardBody>
        {latestAssessment?.note && (
          <CardBody className="pt-0 text-sm text-[var(--color-text-muted)]">{latestAssessment.note}</CardBody>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kundalik hisobotlar tarixi</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {reportsQuery.isLoading ? (
            <LoadingState />
          ) : reportsQuery.isError ? (
            <ErrorState message={(reportsQuery.error as Error).message} />
          ) : !reportsQuery.data || reportsQuery.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Hali kundalik hisobot yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Sana</th>
                    <th className="px-5 py-3 font-medium">Ovqatlanishi</th>
                    <th className="px-5 py-3 font-medium">Uyqu</th>
                    <th className="px-5 py-3 font-medium">Kayfiyati</th>
                    <th className="px-5 py-3 font-medium">Faoliyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {reportsQuery.data.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{formatDate(r.date)}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">
                        {r.eatingQuality ? EATING_LABEL[r.eatingQuality] : "—"}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">
                        {r.sleepMinutes != null ? `${r.sleepMinutes} daq` : "—"}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{r.mood ? MOOD_LABEL[r.mood] : "—"}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{r.activityNotes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Sog'liq profili</CardTitle>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setHealthOpen(true)}>
              {health ? "Tahrirlash" : "To'ldirish"}
            </Button>
          )}
        </CardHeader>
        <CardBody>
          {healthQuery.isLoading ? (
            <LoadingState />
          ) : healthQuery.isError ? (
            <ErrorState message={(healthQuery.error as Error).message} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Qon guruhi</p>
                <p className="mt-1 text-sm text-[var(--color-text)]">
                  {health?.bloodType ? BLOOD_TYPE_LABEL[health.bloodType] : "Hali kiritilmagan"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Allergiyalar</p>
                <p className="mt-1 text-sm text-[var(--color-text)]">{health?.allergies || "Hali kiritilmagan"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Surunkali kasalliklar</p>
                <p className="mt-1 text-sm text-[var(--color-text)]">{health?.chronicConditions || "Hali kiritilmagan"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Qo'shimcha izoh</p>
                <p className="mt-1 text-sm text-[var(--color-text)]">{health?.notes || "Hali kiritilmagan"}</p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Vaksinatsiyalar</CardTitle>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setVaccinationOpen(true)}>
              + Yangi vaksinatsiya
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {vaccinationsQuery.isLoading ? (
            <LoadingState />
          ) : vaccinationsQuery.isError ? (
            <ErrorState message={(vaccinationsQuery.error as Error).message} />
          ) : !vaccinationsQuery.data || vaccinationsQuery.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Hali vaksinatsiya yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Nomi</th>
                    <th className="px-5 py-3 font-medium">Rejalashtirilgan sana</th>
                    <th className="px-5 py-3 font-medium">Holati</th>
                    <th className="px-5 py-3 font-medium">Bajarilgan sana</th>
                    <th className="px-5 py-3 font-medium">Izoh</th>
                    {canWrite && <th className="px-5 py-3 font-medium" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {vaccinationsQuery.data.map((v) => (
                    <tr key={v.id}>
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{v.name}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDate(v.scheduledDate)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={VACCINATION_STATUS_TONE[v.status]}>{VACCINATION_STATUS_LABEL[v.status]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{v.doneDate ? formatDate(v.doneDate) : "—"}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{v.note || "—"}</td>
                      {canWrite && (
                        <td className="px-5 py-3 text-right">
                          {v.status === "SCHEDULED" && (
                            <Button size="sm" variant="ghost" onClick={() => setUpdatingVaccination(v)}>
                              Yangilash
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Dori-darmon jurnali</CardTitle>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setMedicationOpen(true)}>
              + Yangi yozuv
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {medicationsQuery.isLoading ? (
            <LoadingState />
          ) : medicationsQuery.isError ? (
            <ErrorState message={(medicationsQuery.error as Error).message} />
          ) : !medicationsQuery.data || medicationsQuery.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Hali dori-darmon yozuvi yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Dori nomi</th>
                    <th className="px-5 py-3 font-medium">Doza</th>
                    <th className="px-5 py-3 font-medium">Berilgan vaqti</th>
                    <th className="px-5 py-3 font-medium">Ota-ona ruxsati</th>
                    <th className="px-5 py-3 font-medium">Izoh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {medicationsQuery.data.map((m) => (
                    <tr key={m.id}>
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{m.medicationName}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{m.dose}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDateTime(m.givenAt)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={m.parentAuthorized ? "success" : "danger"}>
                          {m.parentAuthorized ? "Ha" : "Yo'q"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{m.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Ota-onalar</CardTitle>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={() => setGuardianOpen(true)}>
              + Ota-ona qo'shish
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {guardiansQuery.isLoading ? (
            <LoadingState />
          ) : guardiansQuery.isError ? (
            <ErrorState message={(guardiansQuery.error as Error).message} />
          ) : !guardiansQuery.data || guardiansQuery.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Hali ota-ona biriktirilmagan</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Ism</th>
                    <th className="px-5 py-3 font-medium">Telefon</th>
                    <th className="px-5 py-3 font-medium">Qarindoshlik</th>
                    <th className="px-5 py-3 font-medium">Belgilar</th>
                    {canWrite && <th className="px-5 py-3 font-medium" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {guardiansQuery.data.map((link) => (
                    <tr key={link.id}>
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{link.guardian.fullName}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{link.guardian.phone}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{GUARDIAN_RELATION_LABEL[link.relation]}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {link.isPrimary && <Badge tone="primary">Asosiy</Badge>}
                          {link.canPickup && <Badge tone="success">Olib ketadi</Badge>}
                          {link.canViewFinance && <Badge tone="neutral">Moliya</Badge>}
                          {link.canReceiveNotifications && <Badge tone="neutral">Bildirishnoma</Badge>}
                        </div>
                      </td>
                      {canWrite && (
                        <td className="px-5 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setEditingLink(link)}>
                            Tahrirlash
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
