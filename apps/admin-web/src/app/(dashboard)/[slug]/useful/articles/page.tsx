"use client";

import { use, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Article, ArticleCategory, Group } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteUseful } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { useAuthedImage } from "@/components/ui/child-photo";
import { ChipRow, IosChip } from "@/components/ios/filters";
import { UsefulScreen, UsefulViewSheet } from "@/features/useful/useful-parts";
import { ArticleReading, ArticleSheet, ArticleThumb, articleCoverUrl, articleParagraphs } from "@/features/articles/article-sheet";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_ORDER } from "@/features/articles/categories";
import { StaffArticleFeedback } from "@/features/articles/staff-feedback";
import { useTr } from "@/i18n/tr";

/**
 * Foydali → Maqolalar («Ota-onalarga eslatma»). Xodimlar ota-onalar uchun
 * qisqa maqola yozadi; qator bosilsa ota-onalar ko'radigan ko'rinish
 * ochiladi, tahrirlash va o'chirish o'sha varaqda (tarbiyachi — faqat o'zi
 * yozganini, filial admini va administrator — hammasini). Varaqda —
 * ota-onalar fikri: anonim baho soni va izohlar (javob, o'chirish).
 */
export default function ArticlesPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteUseful(user?.role);
  const isTeacher = user?.role === "TEACHER";
  const { branchId: forcedBranchId, branchSlug } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const queryClient = useQueryClient();

  const [groupFilter, setGroupFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory | "">("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; article: Article | null }>({ open: false, article: null });

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];

  const articlesQuery = useQuery({
    queryKey: ["articles", slug, forcedBranchId, groupFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (groupFilter) qs.set("groupId", groupFilter);
      if (forcedBranchId) qs.set("branchId", forcedBranchId);
      const query = qs.toString();
      return api.get<Article[]>(`/app/articles${query ? `?${query}` : ""}`);
    },
  });
  const articles = useMemo(() => articlesQuery.data ?? [], [articlesQuery.data]);

  // Mavzu filtri mijozda — chiplarda har mavzudagi son ko'rinadi
  const categoryCounts = useMemo(() => {
    const counts = new Map<ArticleCategory, number>();
    for (const a of articles) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return counts;
  }, [articles]);
  const usedCategories = ARTICLE_CATEGORY_ORDER.filter((c) => categoryCounts.has(c) || c === categoryFilter);

  // Yopilish animatsiyasida (va o'chirilgach) varaq bo'shab qolmasin
  const lastViewed = useRef<Article | null>(null);
  const found = articles.find((a) => a.id === viewId) ?? null;
  if (found) lastViewed.current = found;
  const viewing = found ?? lastViewed.current;
  const cover = useAuthedImage(viewing ? articleCoverUrl(viewing) : null);
  // Tarbiyachi faqat o'zi yozganini, admin — hammasini o'zgartiradi
  const canEdit = (a: Article) => canWrite && (!isTeacher || a.createdById === user?.id);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", slug] });
      setViewId(null);
    },
  });

  return (
    <UsefulScreen
      kind="articles"
      base={base}
      canWrite={canWrite}
      onAdd={() => setEditor({ open: true, article: null })}
      groups={groups}
      groupFilter={groupFilter}
      onGroupFilter={setGroupFilter}
      filters={
        usedCategories.length > 1 ? (
          <ChipRow label={tr("Mavzu")}>
            <IosChip active={categoryFilter === ""} onClick={() => setCategoryFilter("")}>
              {tr("Barcha mavzular")}
            </IosChip>
            {usedCategories.map((c) => (
              <IosChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} count={categoryCounts.get(c) ?? 0}>
                {tr(ARTICLE_CATEGORIES[c].label)}
              </IosChip>
            ))}
          </ChipRow>
        ) : undefined
      }
      items={articles.map((a) => ({
        id: a.id,
        title: a.title,
        meta: [
          tr(ARTICLE_CATEGORIES[a.category].label),
          tr("{0} daqiqa", a.readMinutes),
          tr(a.group?.name ?? "Butun filial"),
          ...(a.feedback?.comments ? [tr("{0} izoh", a.feedback.comments)] : []),
        ].join(" · "),
        draft: a.status === "DRAFT",
        searchText: `${a.summary} ${a.body} ${a.tips.map((t) => `${t.title} ${t.text}`).join(" ")}`,
        leading: <ArticleThumb article={a} />,
        hidden: !!categoryFilter && a.category !== categoryFilter,
      }))}
      loading={articlesQuery.isLoading}
      error={articlesQuery.isError ? (articlesQuery.error instanceof ApiError ? articlesQuery.error.message : tr("Xatolik yuz berdi")) : null}
      onRetry={() => articlesQuery.refetch()}
      retrying={articlesQuery.isFetching}
      onOpen={(id) => {
        deleteMutation.reset();
        setViewId(id);
      }}
    >
      {viewing && (
        <UsefulViewSheet
          open={!!found && !editor.open}
          onClose={() => setViewId(null)}
          title="Maqola"
          noun="maqola"
          info={[
            { label: "Guruh", value: tr(viewing.group?.name ?? "Butun filial") },
            { label: "Holat", value: tr(viewing.status === "PUBLISHED" ? "Ota-onalarga ko'rinadi" : "Qoralama") },
            { label: "Yozgan", value: `${tr(viewing.createdBy.fullName)} · ${formatDate(viewing.createdAt)}` },
          ]}
          canEdit={canEdit(viewing)}
          onEdit={() => setEditor({ open: true, article: viewing })}
          onDelete={() => deleteMutation.mutate(viewing.id)}
          deleting={deleteMutation.isPending}
          deleteError={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        >
          <ArticleReading
            title={viewing.title}
            category={viewing.category}
            readMinutes={viewing.readMinutes}
            coverSrc={cover.failed ? null : cover.src}
            summary={viewing.summary}
            paragraphs={articleParagraphs(viewing.body)}
            tips={viewing.tips}
            memo={viewing.memo}
          />
          {viewing.status === "PUBLISHED" && <StaffArticleFeedback key={viewing.id} articleId={viewing.id} slug={slug} />}
        </UsefulViewSheet>
      )}

      {canWrite && (
        <ArticleSheet
          open={editor.open}
          onClose={() => setEditor((e) => ({ ...e, open: false }))}
          slug={slug}
          groups={groups}
          isTeacher={isTeacher}
          article={editor.article}
        />
      )}
    </UsefulScreen>
  );
}
