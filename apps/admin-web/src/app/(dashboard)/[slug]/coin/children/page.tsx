"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CoinChildBalance, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { InfoIcon } from "@/components/ui/icons";
import { useBranchContext } from "@/lib/use-branch-context";
import { isTeacher } from "@/lib/permissions";
import { WeeklyAssessmentModal } from "@/features/coins/weekly-assessment-modal";
import { CoinHistoryModal } from "@/features/coins/coin-history-modal";

export default function CoinChildrenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  const { user } = useAuth();
  const canAssess = isTeacher(user?.role);
  const [assessTarget, setAssessTarget] = useState<CoinChildBalance | null>(null);
  const [historyTarget, setHistoryTarget] = useState<CoinChildBalance | null>(null);

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

  const balancesQuery = useQuery({
    queryKey: ["coin-children", slug, branchId],
    queryFn: () => api.get<CoinChildBalance[]>(`/app/coins/children?branchId=${branchId}`),
    enabled: !!branchId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Coin — Bolalar</h1>
        <p className="text-[14px] text-[var(--color-text-muted)]">Bolalarning coin balansi va hisoboti</p>
      </div>

      {!forcedBranchId && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row">
          <Select label="Filial" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="sm:max-w-xs">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-primary)]/[0.06] px-4 py-3.5">
        <InfoIcon className="mt-px h-5 w-5 shrink-0 text-[var(--color-primary)]" />
        <div>
          <p className="text-[14px] font-semibold text-[var(--color-text)]">Coin hech qachon qo&apos;lda berilmaydi</p>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            Coin faqat avtomatik hisoblanadi: har kelgan kuni uchun +5 (davomat), haftalik savol-javob va she&apos;r
            yodlashdan esa max +50/hafta. Bu yerda faqat natija ko&apos;rinadi.
          </p>
        </div>
      </div>

      {!branchId ? (
        <EmptyState title="Filial mavjud emas" />
      ) : balancesQuery.isLoading ? (
        <LoadingState />
      ) : balancesQuery.isError ? (
        <ErrorState message={(balancesQuery.error as Error).message} />
      ) : !balancesQuery.data || balancesQuery.data.length === 0 ? (
        <EmptyState title="Bu filialda faol bola yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {balancesQuery.data.map((child) => (
              <li key={child.childId} className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{child.fullName}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
                    {child.groupName && <span>{child.groupName}</span>}
                    <span>Davomat: {child.attendanceCoins}</span>
                    <span>Haftalik: {child.weeklyAssessmentCoins}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={child.balance > 0 ? "success" : child.balance < 0 ? "danger" : "neutral"}>
                    {child.balance} coin
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setHistoryTarget(child)}>
                    Tarix
                  </Button>
                  {canAssess && (
                    <Button size="sm" variant="outline" onClick={() => setAssessTarget(child)}>
                      Haftalik baholash
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {assessTarget && (
        <WeeklyAssessmentModal
          open={!!assessTarget}
          onClose={() => setAssessTarget(null)}
          slug={slug}
          branchId={branchId}
          child={assessTarget}
        />
      )}

      {historyTarget && (
        <CoinHistoryModal open={!!historyTarget} onClose={() => setHistoryTarget(null)} child={historyTarget} />
      )}
    </div>
  );
}
