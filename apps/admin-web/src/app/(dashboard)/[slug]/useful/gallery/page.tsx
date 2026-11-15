"use client";

import { use, useRef, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Images, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { GalleryItem, Group } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteUseful } from "@/lib/permissions";
import { BranchSectionTabs } from "@/features/nav/branch-section-tabs";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosButton } from "@/components/ios/button";
import { ChipRow, IosChip } from "@/components/ios/filters";
import { EmptyState, ErrorState } from "@/components/ios/states";
import { InfoIcon } from "@/components/ios/icons";
import { GROUP_BLOCK } from "@/components/ios/tokens";
import { GalleryAddSheet, GallerySkeleton, GalleryTile, GalleryViewSheet } from "@/features/gallery/gallery-sheets";
import { useTr } from "@/i18n/tr";

/**
 * Foydali → Galereya: bolalar ishlari muzeyi. Tarbiyachi bolalarning rasmi,
 * applikatsiyasi va loy ishlarini guruh bo'yicha suratga olib yuklaydi —
 * filialdagi barcha ota-onalar ko'radi va «yoqtiradi». Tarbiyachi faqat o'zi
 * yuklaganini, filial admini va administrator — hammasini o'zgartiradi.
 */
export default function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteUseful(user?.role);
  const isTeacher = user?.role === "TEACHER";
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const [groupFilter, setGroupFilter] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];

  const galleryQuery = useQuery({
    queryKey: ["gallery", slug, forcedBranchId, groupFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (groupFilter) qs.set("groupId", groupFilter);
      if (forcedBranchId) qs.set("branchId", forcedBranchId);
      const query = qs.toString();
      return api.get<GalleryItem[]>(`/app/gallery${query ? `?${query}` : ""}`);
    },
  });
  const items = galleryQuery.data ?? [];

  // Yopilish animatsiyasida (va o'chirilgach) varaq bo'shab qolmasin
  const lastViewed = useRef<GalleryItem | null>(null);
  const found = items.find((it) => it.id === viewId) ?? null;
  if (found) lastViewed.current = found;
  const viewing = found ?? lastViewed.current;
  const canEdit = (it: GalleryItem) => canWrite && (!isTeacher || it.createdById === user?.id);
  const likes = items.reduce((sum, it) => sum + it.likesCount, 0);

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <BranchSectionTabs slug={slug} section="useful" current="gallery" />
        <PageHeaderCard
          icon={Images}
          tint="pink"
          title={tr("Galereya")}
          count={galleryQuery.isLoading ? undefined : items.length}
          subtitle={items.length > 0 ? tr("Bolalar ishlari · {0} ta yoqtirish", likes) : tr("Bolalar ishlari · ota-onalar ko'radi")}
          actions={canWrite ? <IosButton label={tr("Rasm qo'shish")} icon={Plus} variant="primary" compact onClick={() => setAdding(true)} /> : undefined}
        />

        {groups.length > 1 && (
          <ChipRow label={tr("Guruh")}>
            <IosChip active={groupFilter === ""} onClick={() => setGroupFilter("")}>
              {tr("Barcha guruhlar")}
            </IosChip>
            {groups.map((g) => (
              <IosChip key={g.id} active={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>
                {tr(g.name)}
              </IosChip>
            ))}
          </ChipRow>
        )}

        {!canWrite && (
          <div className={clsx(GROUP_BLOCK, "flex items-start gap-3 px-4 py-3.5")}>
            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#8e8e93]" />
            <p className="text-[13.5px] leading-snug text-[#8e8e93]">{tr("Faqat ko'rish. Bolalar ishlarini tarbiyachilar va filial admini yuklaydi.")}</p>
          </div>
        )}

        {galleryQuery.isLoading ? (
          <GallerySkeleton />
        ) : galleryQuery.isError ? (
          <ErrorState
            message={galleryQuery.error instanceof ApiError ? galleryQuery.error.message : tr("Xatolik yuz berdi")}
            onRetry={() => galleryQuery.refetch()}
            retrying={galleryQuery.isFetching}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Images}
            title={groupFilter ? tr("Bu guruhda hali rasm yo'q") : tr("Hali rasm yo'q")}
            hint={canWrite ? tr("«Rasm qo'shish» tugmasi bilan bolalarning birinchi ishini yuklang — ota-onalar kabinetida darhol ko'radi.") : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => (
              <GalleryTile key={it.id} item={it} onOpen={() => setViewId(it.id)} />
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <GalleryViewSheet item={viewing} open={!!found} onClose={() => setViewId(null)} canEdit={canEdit(viewing)} slug={slug} />
      )}

      {canWrite && <GalleryAddSheet open={adding} onClose={() => setAdding(false)} slug={slug} groups={groups} defaultGroupId={groupFilter} />}
    </div>
  );
}
