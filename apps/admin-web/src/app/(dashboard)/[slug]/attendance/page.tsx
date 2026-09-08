"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AttendanceDay, AttendanceStatus, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import clsx from "clsx";
import { canWriteTeaching } from "@/lib/permissions";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

export default function AttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date input.
  const [date, setDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);

  useEffect(() => {
    setDate((current) => current || todayDateString());
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv(`/app/exports/attendance?date=${date}&branchId=${branchId}`, `davomat-${date}.csv`);
    } finally {
      setExporting(false);
    }
  };

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
    queryKey: ["attendance", slug, branchId, date],
    queryFn: () => api.get<AttendanceDay>(`/app/attendance?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
  });

  const mutation = useMutation({
    mutationFn: (vars: { childId: string; status: AttendanceStatus }) =>
      api.post("/app/attendance", { childId: vars.childId, date, status: vars.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Kunlik hisobot — Davomat</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Bolalarning kunlik qatnashuvini belgilang</p>
        </div>
        <Button variant="outline" loading={exporting} disabled={!date || !branchId} onClick={handleExport}>
          Eksport (CSV)
        </Button>
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
      ) : attendanceQuery.isLoading ? (
        <LoadingState />
      ) : attendanceQuery.isError ? (
        <ErrorState message={(attendanceQuery.error as Error).message} />
      ) : !attendanceQuery.data || attendanceQuery.data.children.length === 0 ? (
        <EmptyState title="Bu filialda faol bola yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {attendanceQuery.data.children.map((child) => (
              <li key={child.childId} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{child.fullName}</p>
                  {/* Bir necha guruhli tarbiyachi kimni belgilayotganini bilsin */}
                  {child.groupName && (
                    <p className="text-xs text-[var(--color-text-muted)]">{child.groupName}</p>
                  )}
                </div>
                {canWrite ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={child.status === "PRESENT" ? "primary" : "tertiary"}
                      className={clsx(child.status === "PRESENT" && "bg-[var(--color-success)] hover:opacity-90")}
                      loading={mutation.isPending && mutation.variables?.childId === child.childId && mutation.variables?.status === "PRESENT"}
                      onClick={() => mutation.mutate({ childId: child.childId, status: "PRESENT" })}
                    >
                      Keldi
                    </Button>
                    <Button
                      size="sm"
                      variant={child.status === "ABSENT" ? "danger" : "tertiary"}
                      loading={mutation.isPending && mutation.variables?.childId === child.childId && mutation.variables?.status === "ABSENT"}
                      onClick={() => mutation.mutate({ childId: child.childId, status: "ABSENT" })}
                    >
                      Kelmadi
                    </Button>
                  </div>
                ) : (
                  <Badge tone={child.status === "PRESENT" ? "success" : child.status === "ABSENT" ? "danger" : "neutral"}>
                    {child.status === "PRESENT" ? "Keldi" : child.status === "ABSENT" ? "Kelmadi" : "Belgilanmagan"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
