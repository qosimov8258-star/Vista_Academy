"use client";

import { useState } from "react";
import clsx from "clsx";
import { Lock, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { ApiError } from "@/lib/api";
import { CommentComposer, CommentThread, type ArticleCommentItem, type ArticleReactionKind } from "@/features/articles/comment-thread";
import { useTr } from "@/i18n/tr";
import { HomeSheet } from "../../home-sheet";
import { useArticleCommentActions, useArticleComments, useArticleReaction, type ParentArticle } from "../../foydali-content";

const CARD = "rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]";

/**
 * Maqola ostida: «Foydali bo'ldimi?» (anonim baho) va izohlar.
 * Izoh ota-onaning ismi bilan chiqadi; uni shu maqolani ko'ra oladigan hamma
 * ko'radi — maqola bitta guruhga yozilgan bo'lsa, faqat o'sha guruh.
 */
export function ArticleFeedbackSection({ article }: { article: ParentArticle }) {
  return (
    <>
      <ReactionCard article={article} />
      <CommentsSection article={article} />
    </>
  );
}

function ReactionCard({ article }: { article: ParentArticle }) {
  const tr = useTr();
  const reaction = useArticleReaction(article.id);
  const feedback = article.feedback ?? { likes: 0, dislikes: 0, comments: 0, myReaction: null };
  const toggle = (kind: ArticleReactionKind) => reaction.mutate(feedback.myReaction === kind ? null : kind);

  const options = [
    { kind: "LIKE" as const, label: tr("Yoqdi"), icon: ThumbsUp, count: feedback.likes, color: "var(--p-mint)" },
    { kind: "DISLIKE" as const, label: tr("Yoqmadi"), icon: ThumbsDown, count: feedback.dislikes, color: "var(--p-red)" },
  ];

  return (
    <section className={`${CARD} mt-4 p-4`}>
      <h2 className="text-[16px] font-semibold text-[var(--p-ink)]">{tr("Maqola foydali bo'ldimi?")}</h2>
      <div className="mt-3 flex gap-2.5">
        {options.map((option) => {
          const active = feedback.myReaction === option.kind;
          const Icon = option.icon;
          return (
            <button
              key={option.kind}
              type="button"
              onClick={() => toggle(option.kind)}
              aria-pressed={active}
              className={clsx(
                "flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-[transform,background-color] active:scale-[0.97]",
                !active && "bg-[var(--p-sunken)] text-[var(--p-ink)]",
              )}
              style={active ? { background: `color-mix(in srgb, ${option.color} 14%, transparent)`, color: option.color } : undefined}
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
              {option.label}
              <span className={clsx("tabular-nums", !active && "text-[var(--p-muted)]")}>{option.count}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 px-1 text-[12.5px] text-[var(--p-muted)]">
        <Lock className="h-3 w-3 shrink-0" strokeWidth={2.4} />
        {tr("Baho anonim — kim bosgani hech kimga ko'rinmaydi")}
      </p>
      {reaction.isError && <p className="mt-1.5 px-1 text-[13px] text-[var(--p-red)]">{tr("Bahoni saqlab bo'lmadi. Qayta urinib ko'ring.")}</p>}
    </section>
  );
}

function CommentsSection({ article }: { article: ParentArticle }) {
  const tr = useTr();
  const query = useArticleComments(article.id);
  const { create, remove } = useArticleCommentActions(article.id);
  const [replyTo, setReplyTo] = useState<ArticleCommentItem | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ArticleCommentItem | null>(null);
  const items = query.data ?? [];
  const total = items.reduce((sum, item) => sum + 1 + (item.replies?.length ?? 0), 0);

  const reply = (item: ArticleCommentItem) => {
    setReplyTo(item);
    setFocusKey(`${item.id}-${Date.now()}`);
  };

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

  const hint = article.groupName
    ? tr("Izoh ismingiz bilan chiqadi — uni «{0}» guruhi ota-onalari ko'radi.", article.groupName)
    : tr("Izoh ismingiz bilan chiqadi — uni bog'chadagi boshqa ota-onalar ham ko'radi.");

  return (
    <section className="mt-8">
      <h2 className="px-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">
        {tr("Fikrlar")}
        {total > 0 && <span className="ml-1.5 font-semibold text-[var(--p-muted)]">{total}</span>}
      </h2>
      <div className={`${CARD} mt-3 p-4`}>
        {query.isLoading ? (
          <div className="space-y-4" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--p-sunken)] motion-reduce:animate-none" />
                <span className="h-10 flex-1 animate-pulse rounded-[12px] bg-[var(--p-sunken)] motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : query.isError && !query.data ? (
          <div className="py-2 text-center">
            <p className="text-[14px] text-[var(--p-red)]">{tr("Izohlarni yuklab bo'lmadi")}</p>
            <button type="button" onClick={() => query.refetch()} className="mt-2 text-[14px] font-semibold text-[var(--p-accent)]">
              {tr("Qayta urinish")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--p-sunken)] text-[var(--p-muted)]">
              <MessageCircle className="h-6 w-6" strokeWidth={2} />
            </span>
            <p className="mt-2.5 text-[15px] font-semibold text-[var(--p-ink)]">{tr("Hali izoh yo'q")}</p>
            <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">{tr("Birinchi bo'lib fikringizni yozing.")}</p>
          </div>
        ) : (
          <CommentThread items={items} onReply={reply} onDelete={setConfirm} openThreads={openThreads} />
        )}

        <div className={clsx(!query.isLoading && "mt-5 border-t border-[var(--p-line)] pt-4")}>
          <CommentComposer
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSubmit={submit}
            pending={create.isPending}
            error={create.isError ? (create.error instanceof ApiError ? create.error.message : tr("Yuborib bo'lmadi. Qayta urinib ko'ring.")) : null}
            hint={hint}
            focusKey={focusKey}
          />
        </div>
      </div>

      {confirm && (
        <HomeSheet title={tr("Izohni o'chirasizmi?")} onClose={() => !remove.isPending && setConfirm(null)}>
          <p className="text-[14.5px] leading-relaxed text-[var(--p-muted)]">
            {confirm.replies?.length ? tr("Izoh va unga yozilgan javoblar hamma uchun o'chadi.") : tr("Izoh hamma uchun o'chadi.")}
          </p>
          {remove.isError && <p className="mt-2 text-[13px] text-[var(--p-red)]">{tr("O'chirib bo'lmadi. Qayta urinib ko'ring.")}</p>}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              disabled={remove.isPending}
              className="h-12 flex-1 rounded-full bg-[var(--p-sunken)] text-[15px] font-semibold text-[var(--p-ink)] active:scale-[0.98]"
            >
              {tr("Qoldirish")}
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(confirm.id, {
                  onSuccess: () => {
                    if (replyTo && (replyTo.id === confirm.id || replyTo.parentId === confirm.id)) setReplyTo(null);
                    setConfirm(null);
                  },
                })
              }
              className="h-12 flex-1 rounded-full bg-[var(--p-red)] text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-60"
            >
              {remove.isPending ? tr("O'chirilmoqda…") : tr("O'chirish")}
            </button>
          </div>
        </HomeSheet>
      )}
    </section>
  );
}
