"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import type { CoinChildBalance, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { isTeacher } from "@/lib/permissions";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Group, ListRow, Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { Segmented } from "@/components/ios/form";
import { IosSheet } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { CheckIcon, InfoIcon } from "@/components/ios/icons";
import { GROUP_BLOCK, IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { WeeklyAssessmentModal } from "@/features/coins/weekly-assessment-modal";
import { CoinHistoryModal } from "@/features/coins/coin-history-modal";
import { AwardStarsSheet } from "@/features/coins/award-stars-sheet";
import { useTr } from "@/i18n/tr";

/** Ko'p bo'lmasa filial segment bilan, aks holda ro'yxat varag'ida tanlanadi */
const SEGMENT_MAX = 4;

/**
 * Yulduzcha — bolalar: har bir bolaning balansi (davomat + haftalik +
 * tarbiyachi bergan − do'konda sarflangan). Qator bosilsa bolaning
 * yulduzcha varag'i (tarix) ochiladi; tarbiyachi o'sha varaqdan yulduzcha
 * beradi va haftalik baholaydi.
 */
export default function CoinChildrenPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const { user } = useAuth();
  const canAssess = isTeacher(user?.role);

  // Ochiq varaq: bolaning tarixi, yulduzcha berish yoki haftalik baholash
  const [target, setTarget] = useState<CoinChildBalance | null>(null);
  const [view, setView] = useState<"history" | "award" | "assess" | null>(null);

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
  const rows = balancesQuery.data ?? [];
  // Varaqdagi balans ro'yxat yangilanganda ham yangi bo'lib tursin
  const current = target ? (rows.find((r) => r.childId === target.childId) ?? target) : null;

  const showBranchPicker = !forcedBranchId && branches.length > 1;
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  return (
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={Star}
          tint="orange"
          title={tr("Yulduzcha — Bolalar")}
          count={balancesQuery.data ? tr("{0} ta bola", rows.length) : undefined}
          subtitle={tr("Bolalarning yulduzcha balansi va hisoboti")}
        />

        {showBranchPicker &&
          (branches.length <= SEGMENT_MAX ? (
            <Segmented label={tr("Filial")} value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: tr(b.name) }))} />
          ) : (
            <Group>
              <Row title={tr("Filial")} value={tr(branchName)} onClick={() => setBranchPickerOpen(true)} />
            </Group>
          ))}

        {/* Qanday yig'iladi */}
        <div className={`${GROUP_BLOCK} flex items-start gap-3 px-4 py-3.5`}>
          <IosIcon icon={InfoIcon} tint="orange" size={30} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Yulduzcha qanday yig'iladi")}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-[#8e8e93]">
              {tr("Har kelgan kuni uchun +5 (davomat), haftalik savol-javob va she'r yodlashdan max +50/hafta. Bundan tashqari tarbiyachi o'z guruhidagi bolaga xohlagancha yulduzcha bera oladi.")}
            </p>
          </div>
        </div>

        <Group
          title={
            <>
              {tr("Bolalar")}
              {rows.length > 0 && <span className="font-normal normal-case tracking-normal">· {rows.length}</span>}
            </>
          }
          refreshing={balancesQuery.isFetching && !balancesQuery.isLoading}
          footer={rows.length > 0 ? tr("Bolani bosing — yulduzcha tarixi ochiladi.") : undefined}
          bare
        >
          {!branchId && !orgQuery.isLoading ? (
            <EmptyState icon={Star} title="Filial mavjud emas" />
          ) : !branchId || balancesQuery.isLoading ? (
            <SkeletonRows rows={6} />
          ) : balancesQuery.isError && !balancesQuery.data ? (
            <ErrorState message={tr((balancesQuery.error as Error).message)} onRetry={() => balancesQuery.refetch()} retrying={balancesQuery.isFetching} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Star} title="Bu filialda faol bola yo'q" />
          ) : (
            <div className={GROUP_BLOCK}>
              {rows.map((child) => {
                const color = child.balance > 0 ? IOS.orange : child.balance < 0 ? IOS.red : IOS.gray;
                return (
                  <ListRow
                    key={child.childId}
                    onClick={() => {
                      setTarget(child);
                      setView("history");
                    }}
                    avatar={
                      <ChildPhoto
                        child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }}
                        size={44}
                        fallback={initials(child.fullName)}
                      />
                    }
                    title={tr(child.fullName)}
                    subtitle={[
                      child.groupName ? tr(child.groupName) : null,
                      `${tr("Davomat:")} ${child.attendanceCoins}`,
                      `${tr("Haftalik:")} ${child.weeklyAssessmentCoins}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    meta={
                      <Pill color={color} title={tr("{0} ta yulduzcha", child.balance)}>
                        <Star className="mr-1 h-3.5 w-3.5" fill={color} stroke={color} />
                        {child.balance}
                      </Pill>
                    }
                    chevron
                  />
                );
              })}
            </div>
          )}
        </Group>
      </div>

      {/* Filial tanlash (ko'p filial bo'lsa) */}
      <IosSheet open={branchPickerOpen} onClose={() => setBranchPickerOpen(false)} cancelLabel="Orqaga" title={tr("Filial")}>
        <div className={GROUP_BLOCK}>
          {branches.map((b) => (
            <div key={b.id} className="group/row relative">
              <button
                type="button"
                role="radio"
                aria-checked={b.id === branchId}
                onClick={() => {
                  setBranchId(b.id);
                  setBranchPickerOpen(false);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
              >
                <span className="min-w-0 flex-1 truncate py-3 text-[15px] text-[var(--color-text)]">{tr(b.name)}</span>
                {b.id === branchId && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
              </button>
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
          ))}
        </div>
      </IosSheet>

      {current && (
        <>
          <CoinHistoryModal
            open={view === "history"}
            onClose={() => setView(null)}
            child={current}
            onAward={canAssess ? () => setView("award") : undefined}
            onAssess={canAssess ? () => setView("assess") : undefined}
          />
          {canAssess && (
            <>
              <AwardStarsSheet
                open={view === "award"}
                onClose={() => setView("history")}
                slug={slug}
                child={{ id: current.childId, fullName: current.fullName, gender: current.gender, avatarUpdatedAt: current.avatarUpdatedAt }}
                balance={current.balance}
              />
              <WeeklyAssessmentModal open={view === "assess"} onClose={() => setView("history")} slug={slug} branchId={branchId} child={current} />
            </>
          )}
        </>
      )}
    </div>
  );
}
