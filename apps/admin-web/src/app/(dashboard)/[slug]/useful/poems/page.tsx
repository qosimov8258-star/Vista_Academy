"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Poem } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteUseful } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { UsefulScreen, UsefulViewSheet } from "@/features/useful/useful-parts";
import { PoemReading, PoemSheet } from "@/features/useful/poem-sheet";
import { useTr } from "@/i18n/tr";

/**
 * Foydali → She'rlar. Qator bosilsa ota-onalar ko'radigan ko'rinish
 * ochiladi; tahrirlash va o'chirish o'sha varaqda (tarbiyachi — faqat o'zi
 * qo'shganini, filial admini va administrator — hammasini).
 */
export default function PoemsPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const [editor, setEditor] = useState<{ open: boolean; poem: Poem | null }>({ open: false, poem: null });

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];

  const poemsQuery = useQuery({
    queryKey: ["useful-poems", slug, forcedBranchId, groupFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (groupFilter) qs.set("groupId", groupFilter);
      if (forcedBranchId) qs.set("branchId", forcedBranchId);
      const query = qs.toString();
      return api.get<Poem[]>(`/app/useful/poems${query ? `?${query}` : ""}`);
    },
  });
  const poems = poemsQuery.data ?? [];
  // Yopilish animatsiyasida (va o'chirilgach) varaq bo'shab qolmasin
  const lastViewed = useRef<Poem | null>(null);
  const found = poems.find((p) => p.id === viewId) ?? null;
  if (found) lastViewed.current = found;
  const viewing = found ?? lastViewed.current;
  // Tarbiyachi faqat o'zi qo'shganini, admin — hammasini o'zgartiradi
  const canEdit = (p: Poem) => canWrite && (!isTeacher || p.createdById === user?.id);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/useful/poems/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-poems", slug] });
      setViewId(null);
    },
  });

  return (
    <UsefulScreen
      kind="poems"
      base={base}
      canWrite={canWrite}
      onAdd={() => setEditor({ open: true, poem: null })}
      groups={groups}
      groupFilter={groupFilter}
      onGroupFilter={setGroupFilter}
      items={poems.map((p) => ({
        id: p.id,
        title: p.title,
        meta: [p.group?.name ?? tr("Barcha guruhlar"), p.author, `${p.ageFrom}–${p.ageTo} ${tr("yosh")}`].filter(Boolean).join(" · "),
        draft: p.status === "DRAFT",
        searchText: `${p.author ?? ""} ${p.stanzas.flat().join(" ")}`,
      }))}
      loading={poemsQuery.isLoading}
      error={poemsQuery.isError ? (poemsQuery.error instanceof ApiError ? poemsQuery.error.message : tr("Xatolik yuz berdi")) : null}
      onRetry={() => poemsQuery.refetch()}
      retrying={poemsQuery.isFetching}
      onOpen={(id) => {
        deleteMutation.reset();
        setViewId(id);
      }}
    >
      {viewing && (
        <UsefulViewSheet
          open={!!found && !editor.open}
          onClose={() => setViewId(null)}
          title="She'r"
          noun="she'r"
          info={[
            { label: "Guruh", value: tr(viewing.group?.name ?? "Barcha guruhlar") },
            { label: "Yosh", value: `${viewing.ageFrom}–${viewing.ageTo} ${tr("yosh")}` },
            { label: "Holat", value: tr(viewing.status === "PUBLISHED" ? "Ota-onalarga ko'rinadi" : "Qoralama") },
            { label: "Qo'shgan", value: `${tr(viewing.createdBy.fullName)} · ${formatDate(viewing.createdAt)}` },
          ]}
          canEdit={canEdit(viewing)}
          onEdit={() => setEditor({ open: true, poem: viewing })}
          onDelete={() => deleteMutation.mutate(viewing.id)}
          deleting={deleteMutation.isPending}
          deleteError={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        >
          <PoemReading title={viewing.title} author={viewing.author} stanzas={viewing.stanzas} />
        </UsefulViewSheet>
      )}

      {canWrite && (
        <PoemSheet
          open={editor.open}
          onClose={() => setEditor((e) => ({ ...e, open: false }))}
          slug={slug}
          groups={groups}
          isTeacher={isTeacher}
          poem={editor.poem}
        />
      )}
    </UsefulScreen>
  );
}
