"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Poem } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteTeaching } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NoteIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { UsefulTabs } from "@/features/useful/useful-tabs";
import { PoemModal } from "@/features/useful/poem-modal";

export default function PoemsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);
  const isTeacher = user?.role === "TEACHER";
  const { branchId: forcedBranchId, branchSlug } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const [groupFilter, setGroupFilter] = useState("");
  const [modal, setModal] = useState<{ open: boolean; poem: Poem | null }>({ open: false, poem: null });
  const [deleting, setDeleting] = useState<Poem | null>(null);
  const queryClient = useQueryClient();

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/useful/poems/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-poems", slug] });
      setDeleting(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Foydali</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            She&apos;rlar, maqollar va ertaklar — ota-ona kabinetida shu yerdan ko&apos;rinadi
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setModal({ open: true, poem: null })}>+ Yangi she&apos;r qo&apos;shish</Button>
        )}
      </div>

      <UsefulTabs base={base} />

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="p-4">
        {groupsQuery.isLoading ? (
          <LoadingState rows={1} />
        ) : (
          <Select label="Guruh" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="sm:max-w-xs">
            <option value="">Barcha guruhlar</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        )}
      </Card>

      {poemsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : poemsQuery.isError ? (
        <ErrorState message={poemsQuery.error instanceof ApiError ? poemsQuery.error.message : "Xatolik yuz berdi"} />
      ) : !poemsQuery.data || poemsQuery.data.length === 0 ? (
        <EmptyState
          icon={<NoteIcon className="h-[26px] w-[26px]" />}
          title="Hali she'r yo'q"
          description={canWrite ? "\"+ Yangi she'r qo'shish\" tugmasi orqali birinchisini qo'shing" : undefined}
        />
      ) : (
        <div className="space-y-3">
          {poemsQuery.data.map((poem) => (
            <PoemRow
              key={poem.id}
              poem={poem}
              canEdit={canWrite && (!isTeacher || poem.createdById === user?.id)}
              onEdit={() => setModal({ open: true, poem })}
              onDelete={() => setDeleting(poem)}
            />
          ))}
        </div>
      )}

      {canWrite && (
        <PoemModal
          open={modal.open}
          onClose={() => setModal({ open: false, poem: null })}
          slug={slug}
          groups={groups}
          isTeacher={isTeacher}
          poem={modal.poem}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="She'rni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        description={<><b className="text-[var(--color-text)]">{deleting?.title}</b> o&apos;chiriladi.</>}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function PoemRow({
  poem,
  canEdit,
  onEdit,
  onDelete,
}: {
  poem: Poem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <NoteIcon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text)]">{poem.title}</span>
            <Badge tone={poem.status === "PUBLISHED" ? "success" : "neutral"}>
              {poem.status === "PUBLISHED" ? "Chop etilgan" : "Qoralama"}
            </Badge>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
            <span>{poem.group?.name ?? "Barcha guruhlar"}</span>
            {poem.author && <span>· {poem.author}</span>}
            <span>· {formatDate(poem.createdAt)}</span>
            <span>· {poem.createdBy.fullName}</span>
          </span>
        </span>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label="She'rni tahrirlash"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="She'rni o'chirish"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
