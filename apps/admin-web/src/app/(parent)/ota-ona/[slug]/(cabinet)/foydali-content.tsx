"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IconProps } from "@/components/ui/icons";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { ArticleCommentItem, ArticleReactionKind } from "@/features/articles/comment-thread";

/**
 * Ota-onalar uchun «Maqolalar» va «Galereya» — umumiy turlar, so'rovlar va
 * menyu belgilari. Mazmunni bog'cha (admin, tarbiyachi) panelda qo'shadi.
 *
 *   GET  /app/parent/articles            → ParentArticleSummary[]
 *   GET  /app/parent/articles/:id        → ParentArticle
 *   GET  /app/parent/articles/:id/cover  → rasm
 *   PUT  /app/parent/articles/:id/reaction            → ArticleFeedback (anonim)
 *   GET  /app/parent/articles/:id/comments            → ArticleCommentItem[]
 *   POST /app/parent/articles/:id/comments            → ArticleCommentItem
 *   DELETE /app/parent/articles/:id/comments/:cid     → { id } (faqat o'ziniki)
 *   GET  /app/parent/gallery             → ParentGalleryItem[]
 *   POST /app/parent/gallery/:id/like    → { liked, likesCount }
 *   GET  /app/parent/gallery/:id/image   → rasm (`?n=1..4` — keyingi suratlari)
 */

export type ArticleCategory = "PSYCHOLOGY" | "DEVELOPMENT" | "HEALTH" | "NUTRITION" | "FAMILY" | "ADAPTATION" | "HOME_GAMES";

/** Mavzular — tartibi ota-ona sahifasidagi filtr tartibi */
export const ARTICLE_CATEGORIES: Array<{ id: ArticleCategory; label: string }> = [
  { id: "PSYCHOLOGY", label: "Psixolog maslahati" },
  { id: "DEVELOPMENT", label: "Bola rivojlanishi" },
  { id: "HEALTH", label: "Salomatlik va gigiyena" },
  { id: "NUTRITION", label: "To'g'ri ovqatlanish" },
  { id: "FAMILY", label: "Oilaviy tarbiya" },
  { id: "ADAPTATION", label: "Bog'chaga moslashish" },
  { id: "HOME_GAMES", label: "Uyda o'yinlar" },
];

export const categoryLabel = (id: ArticleCategory) => ARTICLE_CATEGORIES.find((item) => item.id === id)?.label ?? id;

export interface ParentArticleSummary {
  id: string;
  category: ArticleCategory;
  title: string;
  summary: string;
  hasCover: boolean;
  version: number;
  readMinutes: number;
  addedBy: string;
  groupName: string | null;
  addedAt: string;
}

/** Baho anonim: faqat sonlar va o'z bahosi keladi */
export interface ArticleFeedback {
  likes: number;
  dislikes: number;
  comments: number;
  myReaction: ArticleReactionKind | null;
}

export interface ParentArticle extends ParentArticleSummary {
  paragraphs: string[];
  tips: Array<{ title: string; text: string }>;
  memo: string | null;
  feedback?: ArticleFeedback;
}

export interface ParentGalleryItem {
  id: string;
  title: string | null;
  /** Tarbiyachining ixtiyoriy matni */
  description?: string | null;
  /** 1–5: suratlar soni (`/image?n=0..4`) */
  imageCount?: number;
  groupId: string;
  groupName: string;
  likesCount: number;
  liked: boolean;
  addedAt: string;
}

export const articleCoverUrl = (article: { id: string; version: number }) =>
  `${PARENT_API_URL}/app/parent/articles/${article.id}/cover?v=${article.version}`;
/** `n` — ishning nechanchi surati (0 — birinchisi, muqova) */
export const galleryImageUrl = (id: string, n = 0) => `${PARENT_API_URL}/app/parent/gallery/${id}/image${n > 0 ? `?n=${n}` : ""}`;

export function useParentArticles(enabled = true) {
  return useQuery({
    queryKey: ["parent-articles"],
    queryFn: () => parentApi.get<ParentArticleSummary[]>("/app/parent/articles"),
    enabled,
    staleTime: 60_000,
  });
}

export function useParentArticle(id: string) {
  return useQuery({
    queryKey: ["parent-article", id],
    queryFn: () => parentApi.get<ParentArticle>(`/app/parent/articles/${id}`),
    retry: false,
  });
}

export function useParentGallery(enabled = true) {
  return useQuery({
    queryKey: ["parent-gallery"],
    queryFn: () => parentApi.get<ParentGalleryItem[]>("/app/parent/gallery"),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * «Yoqdi» — darhol ekranda o'zgaradi (kutib turmaydi), server javobi bilan
 * tekshiriladi; xato bo'lsa avvalgi holatga qaytadi.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => parentApi.post<{ liked: boolean; likesCount: number }>(`/app/parent/gallery/${id}/like`, {}),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["parent-gallery"] });
      const previous = queryClient.getQueryData<ParentGalleryItem[]>(["parent-gallery"]);
      queryClient.setQueryData<ParentGalleryItem[]>(["parent-gallery"], (items) =>
        items?.map((item) =>
          item.id === id ? { ...item, liked: !item.liked, likesCount: Math.max(0, item.likesCount + (item.liked ? -1 : 1)) } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["parent-gallery"], context.previous);
    },
    onSuccess: (result, id) => {
      queryClient.setQueryData<ParentGalleryItem[]>(["parent-gallery"], (items) =>
        items?.map((item) => (item.id === id ? { ...item, ...result } : item)),
      );
    },
  });
}

/* ------------------------------------------------------------------------ */
/* Pastki menyu belgilari — components/ui/icons bilan bir xil to'r (24, 1.6) */
/* ------------------------------------------------------------------------ */

function svgProps({ filled: _filled, ...props }: IconProps) {
  return { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false, ...props } as const;
}

export function ArticlesIcon(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...svgProps(props)} fill="currentColor" stroke="none">
        <path d="M5.4 3.4h9.1c.5 0 1 .2 1.4.6l3.5 3.5c.4.4.6.9.6 1.4v10.3a1.9 1.9 0 0 1-1.9 1.9H5.4a1.9 1.9 0 0 1-1.9-1.9V5.3c0-1 .9-1.9 1.9-1.9Zm2.4 8a.8.8 0 0 0 0 1.6h8.4a.8.8 0 0 0 0-1.6Zm0 3.6a.8.8 0 0 0 0 1.6h5.6a.8.8 0 0 0 0-1.6Zm0-7.2a.8.8 0 0 0 0 1.6h3.4a.8.8 0 0 0 0-1.6Z" />
      </svg>
    );
  }
  return (
    <svg {...svgProps(props)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.4 4.2H5.6a1.6 1.6 0 0 0-1.6 1.6v12.4a1.6 1.6 0 0 0 1.6 1.6h12.8a1.6 1.6 0 0 0 1.6-1.6V9.6Z" />
      <path d="M14.2 4.4v3.8c0 .8.6 1.4 1.4 1.4h4.2" />
      <path d="M7.8 8.6h3.4M7.8 12.2h8.4M7.8 15.8h5.6" />
    </svg>
  );
}

export function GalleryIcon(props: IconProps) {
  if (props.filled) {
    return (
      <svg {...svgProps(props)} fill="currentColor" stroke="none">
        <path d="M5.6 3.6h12.8a2 2 0 0 1 2 2v12.8a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2V5.6a2 2 0 0 1 2-2Zm3.2 3.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm5.9 5.3a1 1 0 0 0-1.5 0l-4.1 4.7-1.5-1.5a1 1 0 0 0-1.5.1l-1.4 1.8v.6c0 .5.4.9.9.9h12.8c.5 0 .9-.4.9-.9v-1.4Z" />
      </svg>
    );
  }
  return (
    <svg {...svgProps(props)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="2.2" />
      <circle cx="9" cy="9" r="1.7" />
      <path d="m4.4 17.6 3.9-4 2.6 2.6 4.4-4.9 4.6 5" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Maqolaga fikr: layk/dizlayk (anonim) va izohlar (ism bilan)
// ---------------------------------------------------------------------

const EMPTY_FEEDBACK: ArticleFeedback = { likes: 0, dislikes: 0, comments: 0, myReaction: null };

/** Baho darhol ekranda o'zgaradi; server javobi bilan tekshiriladi, xato bo'lsa qaytadi */
export function useArticleReaction(articleId: string) {
  const queryClient = useQueryClient();
  const key = ["parent-article", articleId];
  return useMutation({
    mutationFn: (kind: ArticleReactionKind | null) =>
      parentApi.put<ArticleFeedback>(`/app/parent/articles/${articleId}/reaction`, { kind }),
    onMutate: async (kind) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ParentArticle>(key);
      queryClient.setQueryData<ParentArticle>(key, (article) => {
        if (!article) return article;
        const feedback = { ...(article.feedback ?? EMPTY_FEEDBACK) };
        if (feedback.myReaction === "LIKE") feedback.likes = Math.max(0, feedback.likes - 1);
        if (feedback.myReaction === "DISLIKE") feedback.dislikes = Math.max(0, feedback.dislikes - 1);
        if (kind === "LIKE") feedback.likes += 1;
        if (kind === "DISLIKE") feedback.dislikes += 1;
        feedback.myReaction = kind;
        return { ...article, feedback };
      });
      return { previous };
    },
    onError: (_error, _kind, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (feedback) => {
      queryClient.setQueryData<ParentArticle>(key, (article) => (article ? { ...article, feedback } : article));
    },
  });
}

/** Izohlar — sahifa ochiq turganda boshqalarning yangi izohlari ham kelib turadi */
export function useArticleComments(articleId: string) {
  return useQuery({
    queryKey: ["parent-article-comments", articleId],
    queryFn: () => parentApi.get<ArticleCommentItem[]>(`/app/parent/articles/${articleId}/comments`),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useArticleCommentActions(articleId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["parent-article-comments", articleId] });
    void queryClient.invalidateQueries({ queryKey: ["parent-article", articleId] });
  };
  const create = useMutation({
    mutationFn: (input: { body: string; parentId?: string }) =>
      parentApi.post<ArticleCommentItem>(`/app/parent/articles/${articleId}/comments`, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => parentApi.delete<{ id: string }>(`/app/parent/articles/${articleId}/comments/${commentId}`),
    onSuccess: refresh,
  });
  return { create, remove };
}
