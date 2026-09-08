"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DailyReportDay, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import { EditDailyReportModal } from "@/features/daily-reports/edit-daily-report-modal";
import { canWriteTeaching } from "@/lib/permissions";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

const EATING_LABEL: Record<string, string> = { GOOD: "Yaxshi", AVERAGE: "O'rtacha", POOR: "Yomon" };
const MOOD_LABEL: Record<string, string> = { HAPPY: "Xursand", NEUTRAL: "Oddiy", UPSET: "Xafa" };

export default function DailyReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date input.
  const [date, setDate] = useState("");
  const [editChild, setEditChild] = useState<{ childId: string; fullName: string } | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);

  useEffect(() => {
    setDate((current) => current || todayDateString());
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

  const reportsQuery = useQuery({
    queryKey: ["daily-reports", slug, branchId, date],
    queryFn: () => api.get<DailyReportDay>(`/app/daily-reports?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Kundalik hisobot</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Har bir bola uchun ovqatlanish, uyqu, kayfiyat va faoliyat</p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        {!forcedBranchId && (
          <Select label="Filial" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="sm:max-w-xs">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        )}
        <div className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Sana</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:w-auto"
          />
        </div>
      </Card>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {!date ? (
        <LoadingState />
      ) : !branchId ? (
        <EmptyState title="Filial mavjud emas" />
      ) : reportsQuery.isLoading ? (
        <LoadingState />
      ) : reportsQuery.isError ? (
        <ErrorState message={(reportsQuery.error as Error).message} />
      ) : !reportsQuery.data || reportsQuery.data.children.length === 0 ? (
        <EmptyState title="Bu filialda faol bola yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {reportsQuery.data.children.map((c) => (
              <li key={c.childId} className="flex items-center justify-between px-5 py-3">
                <div>
                  <Link href={`/${slug}/children/${c.childId}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                    {c.fullName}
                  </Link>
                  {/* Bir necha guruhli tarbiyachi uchun guruh nomi */}
                  {c.groupName && <p className="text-xs text-[var(--color-text-muted)]">{c.groupName}</p>}
                  {c.report && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {c.report.eatingQuality && `Ovqat: ${EATING_LABEL[c.report.eatingQuality]}`}
                      {c.report.mood && ` • Kayfiyat: ${MOOD_LABEL[c.report.mood]}`}
                      {c.report.sleepMinutes != null && ` • Uyqu: ${c.report.sleepMinutes} daq`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={c.report ? "success" : "neutral"}>{c.report ? "To'ldirilgan" : "To'ldirilmagan"}</Badge>
                  {canWrite && (
                    <Button size="sm" variant="secondary" onClick={() => setEditChild({ childId: c.childId, fullName: c.fullName })}>
                      {c.report ? "Tahrirlash" : "To'ldirish"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canWrite && editChild && date && (
        <EditDailyReportModal
          open={!!editChild}
          onClose={() => setEditChild(null)}
          slug={slug}
          branchId={branchId}
          date={date}
          childId={editChild.childId}
          childName={editChild.fullName}
          report={reportsQuery.data?.children.find((c) => c.childId === editChild.childId)?.report ?? null}
        />
      )}
    </div>
  );
}
