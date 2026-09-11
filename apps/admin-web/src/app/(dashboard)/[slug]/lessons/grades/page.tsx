"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Group, LessonGradeDay, LessonTopic } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteTeaching } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { StarIcon } from "@/components/ui/icons";
import { GradeChildModal } from "@/features/lessons/grade-child-modal";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 7) return "success";
  if (score >= 4) return "warning";
  return "danger";
}

export default function LessonGradesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [groupId, setGroupId] = useState("");
  // "Bugun" mijoz soatiga bog'liq — server va brauzer render'i mos kelishi
  // uchun effektda hisoblanadi.
  const [date, setDate] = useState("");
  const [gradingChild, setGradingChild] = useState<{ childId: string; fullName: string } | null>(null);

  useEffect(() => {
    setDate((current) => current || todayDateString());
  }, []);

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];

  useEffect(() => {
    if (!groupId && groups.length > 0) {
      setGroupId(groups[0].id);
    }
  }, [groupId, groups]);

  const gradesQuery = useQuery({
    queryKey: ["lesson-grades", slug, groupId, date],
    queryFn: () => api.get<LessonGradeDay>(`/app/lesson-grades?groupId=${groupId}&date=${date}`),
    enabled: !!groupId && !!date,
  });

  // Modaldagi "mavzu bilan bog'lash" tanlovi uchun — shu guruhning mavzulari
  const topicsQuery = useQuery({
    queryKey: ["lesson-topics", slug, groupId],
    queryFn: () => api.get<LessonTopic[]>(`/app/lesson-topics?groupId=${groupId}`),
    enabled: !!groupId && canWrite,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
          Baholari
        </h1>
        <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
          Bolaning kunlik ishtiroki va bajargan topshiriqlari bo&apos;yicha 1–10 baho
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        {groupsQuery.isLoading ? (
          <LoadingState rows={1} />
        ) : groups.length === 0 ? (
          <p className="text-[14px] text-[var(--color-text-muted)]">Hali guruh yo&apos;q</p>
        ) : (
          <Select label="Guruh" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="sm:max-w-xs">
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        )}
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">Sana</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] sm:w-auto"
          />
        </div>
      </Card>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {!groupId || !date ? (
        groupsQuery.isLoading ? (
          <LoadingState />
        ) : (
          <EmptyState title="Guruh tanlanmagan" description="Avval yuqoridan guruh va sanani tanlang" />
        )
      ) : gradesQuery.isLoading ? (
        <LoadingState />
      ) : gradesQuery.isError ? (
        <ErrorState message={(gradesQuery.error as Error).message} />
      ) : !gradesQuery.data || gradesQuery.data.children.length === 0 ? (
        <EmptyState icon={<StarIcon className="h-[26px] w-[26px]" />} title="Bu guruhda faol bola yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {gradesQuery.data.children.map((child) => (
              <li key={child.childId} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{child.fullName}</p>
                  {child.grade?.note && (
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{child.grade.note}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {child.grade ? (
                    <Badge tone={scoreTone(child.grade.score)}>{child.grade.score} / 10</Badge>
                  ) : (
                    <Badge tone="neutral">Baholanmagan</Badge>
                  )}
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setGradingChild({ childId: child.childId, fullName: child.fullName })}
                    >
                      {child.grade ? "Tahrirlash" : "Baholash"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canWrite && gradingChild && groupId && date && (
        <GradeChildModal
          open={!!gradingChild}
          onClose={() => setGradingChild(null)}
          slug={slug}
          groupId={groupId}
          date={date}
          childId={gradingChild.childId}
          childName={gradingChild.fullName}
          grade={gradesQuery.data?.children.find((c) => c.childId === gradingChild.childId)?.grade ?? null}
          topics={topicsQuery.data ?? []}
        />
      )}
    </div>
  );
}
