"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { IOS } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";
import { CommentComposer, CommentThread, authorName, type ArticleCommentItem } from "./comment-thread";

interface StaffArticleFeedback {
  likes: number;
  dislikes: number;
  comments: number;
  /** Filial xodimi: javob yozadi va istalgan izohni o'chiradi. Tashkilot rahbari faqat o'qiydi. */
  canModerate: boolean;
  items: ArticleCommentItem[];
}

/**
 * Maqola ko'rish varag'ida — «Ota-onalar fikri»: baho soni (kim bosgani
 * ko'rinmaydi), izohlar, «Bog'cha» nomidan javob va izohni o'chirish
 * (varaq ichida ikkinchi bosqich bilan).
 */
export function StaffArticleFeedback({ articleId, slug }: { articleId: string; slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const key = ["article-comments", slug, articleId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<StaffArticleFeedback>(`/app/articles/${articleId}/comments`),
    refetchInterval: 30_000,
  });
  const [replyTo, setReplyTo] = useState<ArticleCommentItem | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ArticleCommentItem | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["articles", slug] });
  };
  const create = useMutation({
    mutationFn: (input: { body: string; parentId?: string }) => api.post<ArticleCommentItem>(`/app/articles/${articleId}/comments`, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => api.delete(`/app/articles/${articleId}/comments/${commentId}`),
    onSuccess: () => {
      refresh();
      if (replyTo && confirm && (replyTo.id === confirm.id || replyTo.parentId === confirm.id)) setReplyTo(null);
      setConfirm(null);
    },
  });

  const data = query.data;
  const canModerate = !!data?.canModerate;

  const submit = async (body: string) => {
    try {
      const created = await create.mutateAsync({ body, parentId: replyTo?.id });
      if (created.parentId) setOpenThreads((list) => [...list, created.parentId as string]);
      setReplyTo(null);
      return true;
    } catch {
      return false;
    }
  };

  const stats = [
    { icon: ThumbsUp, color: IOS.green, value: data?.likes ?? 0, label: tr("Yoqdi") },
    { icon: ThumbsDown, color: IOS.red, value: data?.dislikes ?? 0, label: tr("Yoqmadi") },
    { icon: MessageCircle, color: IOS.blue, value: data?.comments ?? 0, label: tr("Fikrlar") },
  ];

  return (
    <SheetSection title={tr("Ota-onalar fikri")} footer={canModerate ? tr("Javobingiz «Bog'cha» belgisi bilan chiqadi.") : undefined}>
      {/* Baho — faqat son */}
      <div className="grid grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex flex-col items-center gap-1 py-3.5">
              <span className="flex items-center gap-1.5 text-[20px] font-bold tabular-nums text-[var(--color-text)]">
                <Icon className="h-[18px] w-[18px]" style={{ color: stat.color }} strokeWidth={2.3} />
                {query.isLoading ? "–" : stat.value}
              </span>
              <span className="text-[12.5px] text-[#8e8e93]">{stat.label}</span>
            </div>
          );
        })}
      </div>
      <p className="flex items-center justify-center gap-1.5 px-4 pb-3 text-[12.5px] text-[#8e8e93]">
        <Lock className="h-3 w-3" strokeWidth={2.4} />
        {tr("Baho anonim — kim bosgani ko'rinmaydi")}
      </p>

      <div className="border-t border-black/[0.08] px-4 py-4">
        {query.isLoading ? (
          <div className="flex justify-center py-3">
            <Spinner className="h-5 w-5 text-[#8e8e93]" />
          </div>
        ) : query.isError && !data ? (
          <div className="py-2 text-center">
            <p className="text-[14px] text-[#ff3b30]">{query.error instanceof ApiError ? query.error.message : tr("Izohlarni yuklab bo'lmadi")}</p>
            <button type="button" onClick={() => query.refetch()} className="mt-2 text-[14px] font-semibold text-[var(--color-primary)]">
              {tr("Qayta urinish")}
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <p className="py-2 text-center text-[14px] text-[#8e8e93]">{tr("Hali izoh yo'q")}</p>
        ) : (
          <CommentThread
            items={data.items}
            onReply={
              canModerate
                ? (item) => {
                    setReplyTo(item);
                    setFocusKey(`${item.id}-${Date.now()}`);
                  }
                : undefined
            }
            onDelete={canModerate ? (item) => (remove.reset(), setConfirm(item)) : undefined}
            openThreads={openThreads}
          />
        )}
      </div>

      {/* O'chirish — ikkinchi bosqich */}
      {confirm && (
        <div className="space-y-3 bg-[#ff3b30]/[0.06] px-4 py-3.5">
          <p className="text-[14px] leading-snug text-[#ff3b30]">
            {tr("{0} izohi o'chiriladi va ota-onalarga ko'rinmay qoladi.", authorName(confirm, tr))}
            {confirm.replies?.length ? ` ${tr("Unga yozilgan javoblar ham o'chadi.")}` : ""}
          </p>
          <p className="line-clamp-2 text-[13px] text-[#8e8e93]">«{confirm.body}»</p>
          {remove.isError && <p className="text-[13px] text-[#ff3b30]">{(remove.error as Error)?.message ?? tr("Xatolik yuz berdi")}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => setConfirm(null)}
              className="h-11 flex-1 rounded-full bg-white text-[15px] font-semibold text-[var(--color-text)] transition-transform active:scale-[0.97]"
            >
              {tr("Qoldirish")}
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate(confirm.id)}
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#ff3b30] text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              {remove.isPending ? <Spinner className="h-4 w-4 text-white" /> : tr("O'chirish")}
            </button>
          </div>
        </div>
      )}

      {canModerate && (
        <div className="border-t border-black/[0.08] px-4 py-3">
          <CommentComposer
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSubmit={submit}
            pending={create.isPending}
            error={create.isError ? (create.error instanceof ApiError ? create.error.message : tr("Yuborib bo'lmadi. Qayta urinib ko'ring.")) : null}
            focusKey={focusKey}
          />
        </div>
      )}
    </SheetSection>
  );
}
