"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Proverb } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteUseful } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { UsefulScreen, UsefulViewSheet } from "@/features/useful/useful-parts";
import { ProverbReading, ProverbSheet } from "@/features/useful/proverb-sheet";
import { useTr } from "@/i18n/tr";

/**
 * Foydali → Maqollar. Qator bosilsa ota-onalar ko'radigan ko'rinish
 * ochiladi; tahrirlash va o'chirish o'sha varaqda (tarbiyachi — faqat o'zi
 * qo'shganini, filial admini va administrator — hammasini).
 */
export default function ProverbsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteUseful(user?.role);
  const isTeacher = user?.role === "TEACHER";
  const { branchId: forcedBranchId, branchSlug } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const queryClient = useQueryClient();

  const [groupFilter, setGroupFilter] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; proverb: Proverb | null }>({ open: false, proverb: null });

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];

  const proverbsQuery = useQuery({
    queryKey: ["useful-proverbs", slug, forcedBranchId, groupFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (groupFilter) qs.set("groupId", groupFilter);
      if (forcedBranchId) qs.set("branchId", forcedBranchId);
      const query = qs.toString();
      return api.get<Proverb[]>(`/app/useful/proverbs${query ? `?${query}` : ""}`);
    },
  });
  const proverbs = proverbsQuery.data ?? [];
  // Yopilish animatsiyasida (va o'chirilgach) varaq bo'shab qolmasin
  const lastViewed = useRef<Proverb | null>(null);
  const found = proverbs.find((p) => p.id === viewId) ?? null;
  if (found) lastViewed.current = found;
  const viewing = found ?? lastViewed.current;
  // Tarbiyachi faqat o'zi qo'shganini, admin — hammasini o'zgartiradi
  const canEdit = (p: Proverb) => canWrite && (!isTeacher || p.createdById === user?.id);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/useful/proverbs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-proverbs", slug] });
      setViewId(null);
    },
  });

  return (
    <UsefulScreen
      kind="proverbs"
      base={base}
      canWrite={canWrite}
      onAdd={() => setEditor({ open: true, proverb: null })}
      groups={groups}
      groupFilter={groupFilter}
      onGroupFilter={setGroupFilter}
      items={proverbs.map((p) => ({
        id: p.id,
        title: p.text,
        detail: p.meaning,
        meta: [p.group?.name ?? tr("Barcha guruhlar"), formatDate(p.createdAt)].filter(Boolean).join(" · "),
        draft: p.status === "DRAFT",
      }))}
      loading={proverbsQuery.isLoading}
      error={proverbsQuery.isError ? (proverbsQuery.error instanceof ApiError ? proverbsQuery.error.message : tr("Xatolik yuz berdi")) : null}
      onRetry={() => proverbsQuery.refetch()}
      retrying={proverbsQuery.isFetching}
      onOpen={(id) => {
        deleteMutation.reset();
        setViewId(id);
      }}
    >
      {viewing && (
        <UsefulViewSheet
          open={!!found && !editor.open}
          onClose={() => setViewId(null)}
          title="Maqol"
          noun="maqol"
          info={[
            { label: "Guruh", value: tr(viewing.group?.name ?? "Barcha guruhlar") },
            { label: "Holat", value: tr(viewing.status === "PUBLISHED" ? "Ota-onalarga ko'rinadi" : "Qoralama") },
            { label: "Qo'shgan", value: `${tr(viewing.createdBy.fullName)} · ${formatDate(viewing.createdAt)}` },
          ]}
          canEdit={canEdit(viewing)}
          onEdit={() => setEditor({ open: true, proverb: viewing })}
          onDelete={() => deleteMutation.mutate(viewing.id)}
          deleting={deleteMutation.isPending}
          deleteError={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        >
          <ProverbReading text={viewing.text} meaning={viewing.meaning} />
        </UsefulViewSheet>
      )}

      {canWrite && (
        <ProverbSheet
          open={editor.open}
          onClose={() => setEditor((e) => ({ ...e, open: false }))}
          slug={slug}
          groups={groups}
          isTeacher={isTeacher}
          proverb={editor.proverb}
        />
      )}
    </UsefulScreen>
  );
}
