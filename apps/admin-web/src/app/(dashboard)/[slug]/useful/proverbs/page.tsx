"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Proverb } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteUseful } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BulbIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { UsefulTabs } from "@/features/useful/useful-tabs";
import { ProverbModal } from "@/features/useful/proverb-modal";
import { TeacherUsefulList } from "@/features/teacher/teacher-useful";
import { useTr } from "@/i18n/tr";

export default function ProverbsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteUseful(user?.role);
  const isTeacher = user?.role === "TEACHER";
  const { branchId: forcedBranchId, branchSlug } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const [groupFilter, setGroupFilter] = useState("");
  const [modal, setModal] = useState<{ open: boolean; proverb: Proverb | null }>({ open: false, proverb: null });
  const [deleting, setDeleting] = useState<Proverb | null>(null);
  const queryClient = useQueryClient();

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/useful/proverbs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-proverbs", slug] });
      setDeleting(null);
    },
  });

  const dialogs = (
    <>
      {canWrite && (
        <ProverbModal
          open={modal.open}
          onClose={() => setModal({ open: false, proverb: null })}
          slug={slug}
          groups={groups}
          isTeacher={isTeacher}
          proverb={modal.proverb}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={tr("Maqolni o'chirish")}
        confirmLabel={tr("O'chirish")}
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        description={<><b className="text-[var(--color-text)]">{tr(deleting?.text)}</b> {tr("o'chiriladi.")}</>}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  );

  // Tarbiyachi — telefon uchun iOS ro'yxati (rangli fonli ikonkalarsiz)
  if (isTeacher) {
    return (
      <TeacherUsefulList
        base={base}
        icon={BulbIcon}
        noun="maqol"
        items={(proverbsQuery.data ?? []).map((p) => ({
          id: p.id,
          title: p.text,
          detail: p.meaning,
          meta: [p.group?.name ?? tr("Barcha guruhlar"), formatDate(p.createdAt)].filter(Boolean).join(" · "),
          published: p.status === "PUBLISHED",
          canEdit: canWrite && p.createdById === user?.id,
        }))}
        loading={proverbsQuery.isLoading}
        error={proverbsQuery.isError ? (proverbsQuery.error instanceof ApiError ? proverbsQuery.error.message : tr("Xatolik yuz berdi")) : null}
        canWrite={canWrite}
        groups={groups}
        groupFilter={groupFilter}
        onGroupFilter={setGroupFilter}
        onAdd={() => setModal({ open: true, proverb: null })}
        onEdit={(id) => setModal({ open: true, proverb: proverbsQuery.data?.find((x) => x.id === id) ?? null })}
        onDelete={(id) => setDeleting(proverbsQuery.data?.find((x) => x.id === id) ?? null)}
      >
        {tr(dialogs)}
      </TeacherUsefulList>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 md:flex-wrap md:items-center">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Foydali")}</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            {tr("She'rlar, maqollar va ertaklar — ota-ona kabinetida shu yerdan ko'rinadi")}
          </p>
        </div>
        {canWrite && (
          <Button className="shrink-0 max-md:!h-auto max-md:!py-2" onClick={() => setModal({ open: true, proverb: null })}>
            <span className="max-md:text-center max-md:leading-tight">
              {tr("+ Yangi maqol")}
              <br className="md:hidden" /> {tr("qo'shish")}
            </span>
          </Button>
        )}
      </div>

      <UsefulTabs base={base} />

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="p-4">
        {groupsQuery.isLoading ? (
          <LoadingState rows={1} />
        ) : (
          <Select label={tr("Guruh")} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="sm:max-w-xs">
            <option value="">{tr("Barcha guruhlar")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {tr(group.name)}
              </option>
            ))}
          </Select>
        )}
      </Card>

      {proverbsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : proverbsQuery.isError ? (
        <ErrorState message={proverbsQuery.error instanceof ApiError ? proverbsQuery.error.message : tr("Xatolik yuz berdi")} />
      ) : !proverbsQuery.data || proverbsQuery.data.length === 0 ? (
        <EmptyState
          icon={<BulbIcon className="h-[26px] w-[26px]" />}
          title={tr("Hali maqol yo'q")}
          description={canWrite ? tr("\"+ Yangi maqol qo'shish\" tugmasi orqali birinchisini qo'shing") : undefined}
        />
      ) : (
        <div className="space-y-3">
          {proverbsQuery.data.map((proverb) => (
            <ProverbRow
              key={proverb.id}
              proverb={proverb}
              canEdit={canWrite && (!isTeacher || proverb.createdById === user?.id)}
              onEdit={() => setModal({ open: true, proverb })}
              onDelete={() => setDeleting(proverb)}
            />
          ))}
        </div>
      )}

      {tr(dialogs)}
    </div>
  );
}

function ProverbRow({
  proverb,
  canEdit,
  onEdit,
  onDelete,
}: {
  proverb: Proverb;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tr = useTr();
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <BulbIcon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text)]">{tr(proverb.text)}</span>
            <Badge tone={proverb.status === "PUBLISHED" ? "success" : "neutral"}>
              {proverb.status === "PUBLISHED" ? "Chop etilgan" : "Qoralama"}
            </Badge>
          </span>
          <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{tr(proverb.meaning)}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
            <span>{proverb.group?.name ?? tr("Barcha guruhlar")}</span>
            <span>· {formatDate(proverb.createdAt)}</span>
            <span>· {tr(proverb.createdBy.fullName)}</span>
          </span>
        </span>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={tr("Maqolni tahrirlash")}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={tr("Maqolni o'chirish")}
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
