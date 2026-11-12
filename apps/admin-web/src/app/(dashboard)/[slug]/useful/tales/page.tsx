"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Tale } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteUseful } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { UsefulScreen, UsefulViewSheet } from "@/features/useful/useful-parts";
import { TaleReading, TaleSheet } from "@/features/useful/tale-sheet";
import { useTr } from "@/i18n/tr";

/**
 * Foydali → Ertaklar. Qator bosilsa ota-onalar ko'radigan ko'rinish
 * ochiladi; tahrirlash va o'chirish o'sha varaqda (tarbiyachi — faqat o'zi
 * qo'shganini, filial admini va administrator — hammasini).
 */
export default function TalesPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const [editor, setEditor] = useState<{ open: boolean; tale: Tale | null }>({ open: false, tale: null });

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];

  const talesQuery = useQuery({
    queryKey: ["useful-tales", slug, forcedBranchId, groupFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (groupFilter) qs.set("groupId", groupFilter);
      if (forcedBranchId) qs.set("branchId", forcedBranchId);
      const query = qs.toString();
      return api.get<Tale[]>(`/app/useful/tales${query ? `?${query}` : ""}`);
    },
  });
  const tales = talesQuery.data ?? [];
  // Yopilish animatsiyasida (va o'chirilgach) varaq bo'shab qolmasin
  const lastViewed = useRef<Tale | null>(null);
  const found = tales.find((p) => p.id === viewId) ?? null;
  if (found) lastViewed.current = found;
  const viewing = found ?? lastViewed.current;
  // Tarbiyachi faqat o'zi qo'shganini, admin — hammasini o'zgartiradi
  const canEdit = (p: Tale) => canWrite && (!isTeacher || p.createdById === user?.id);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/useful/tales/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-tales", slug] });
      setViewId(null);
    },
  });

  return (
    <UsefulScreen
      kind="tales"
      base={base}
      canWrite={canWrite}
      onAdd={() => setEditor({ open: true, tale: null })}
      groups={groups}
      groupFilter={groupFilter}
      onGroupFilter={setGroupFilter}
      items={tales.map((p) => ({
        id: p.id,
        title: p.title,
        meta: [p.group?.name ?? tr("Barcha guruhlar"), p.origin, tr("{0} daq", p.minutes)].filter(Boolean).join(" · "),
        draft: p.status === "DRAFT",
        searchText: `${p.origin} ${p.moral} ${p.paragraphs.join(" ")}`,
      }))}
      loading={talesQuery.isLoading}
      error={talesQuery.isError ? (talesQuery.error instanceof ApiError ? talesQuery.error.message : tr("Xatolik yuz berdi")) : null}
      onRetry={() => talesQuery.refetch()}
      retrying={talesQuery.isFetching}
      onOpen={(id) => {
        deleteMutation.reset();
        setViewId(id);
      }}
    >
      {viewing && (
        <UsefulViewSheet
          open={!!found && !editor.open}
          onClose={() => setViewId(null)}
          title="Ertak"
          noun="ertak"
          info={[
            { label: "Guruh", value: tr(viewing.group?.name ?? "Barcha guruhlar") },
            { label: "Yosh", value: `${viewing.ageFrom}–${viewing.ageTo} ${tr("yosh")}` },
            { label: "Holat", value: tr(viewing.status === "PUBLISHED" ? "Ota-onalarga ko'rinadi" : "Qoralama") },
            { label: "Qo'shgan", value: `${tr(viewing.createdBy.fullName)} · ${formatDate(viewing.createdAt)}` },
          ]}
          canEdit={canEdit(viewing)}
          onEdit={() => setEditor({ open: true, tale: viewing })}
          onDelete={() => deleteMutation.mutate(viewing.id)}
          deleting={deleteMutation.isPending}
          deleteError={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        >
          <TaleReading
            title={viewing.title}
            origin={viewing.origin}
            minutes={viewing.minutes}
            cover={viewing.cover}
            paragraphs={viewing.paragraphs}
            moral={viewing.moral}
            questions={viewing.questions}
          />
        </UsefulViewSheet>
      )}

      {canWrite && (
        <TaleSheet
          open={editor.open}
          onClose={() => setEditor((e) => ({ ...e, open: false }))}
          slug={slug}
          groups={groups}
          isTeacher={isTeacher}
          tale={editor.tale}
        />
      )}
    </UsefulScreen>
  );
}
