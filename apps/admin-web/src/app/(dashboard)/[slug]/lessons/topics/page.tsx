"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, LessonTopic, LessonTopicDetail, TopicQuestion } from "@/lib/types";
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
import { ChevronRightIcon, PencilIcon, PlusIcon, QuestionIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { TopicModal } from "@/features/lessons/topic-modal";
import { TopicQuestionModal } from "@/features/lessons/topic-question-modal";
import clsx from "clsx";

export default function LessonTopicsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [groupId, setGroupId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [topicModal, setTopicModal] = useState<{ open: boolean; topic: LessonTopic | null }>({
    open: false,
    topic: null,
  });
  const [deletingTopic, setDeletingTopic] = useState<LessonTopic | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];

  useEffect(() => {
    if (!groupId && groups.length > 0) {
      setGroupId(groups[0].id);
    }
  }, [groupId, groups]);

  const topicsQuery = useQuery({
    queryKey: ["lesson-topics", slug, groupId],
    queryFn: () => api.get<LessonTopic[]>(`/app/lesson-topics?groupId=${groupId}`),
    enabled: !!groupId,
  });

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/lesson-topics/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-topics", slug] });
      setDeletingTopic(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Savol-javob
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            Dars mavzulari va ularga tegishli test savollari banki
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setTopicModal({ open: true, topic: null })} disabled={!groupId}>
            + Yangi mavzu qo&apos;shish
          </Button>
        )}
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="p-4">
        {groupsQuery.isLoading ? (
          <LoadingState rows={1} />
        ) : groups.length === 0 ? (
          <p className="text-[14px] text-[var(--color-text-muted)]">Hali guruh yo&apos;q</p>
        ) : (
          <Select label="Guruh" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="sm:max-w-xs">
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        )}
      </Card>

      {!groupId ? (
        groupsQuery.isLoading ? (
          <LoadingState />
        ) : (
          <EmptyState title="Guruh tanlanmagan" description="Avval yuqoridan guruhni tanlang" />
        )
      ) : topicsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : topicsQuery.isError ? (
        <ErrorState message={(topicsQuery.error as Error).message} />
      ) : !topicsQuery.data || topicsQuery.data.length === 0 ? (
        <EmptyState
          icon={<QuestionIcon className="h-[26px] w-[26px]" />}
          title="Hali mavzu yo'q"
          description={canWrite ? "\"+ Yangi mavzu qo'shish\" tugmasi orqali birinchi mavzuni qo'shing" : undefined}
        />
      ) : (
        <div className="space-y-3">
          {topicsQuery.data.map((topic) => (
            <TopicRow
              key={topic.id}
              slug={slug}
              topic={topic}
              canWrite={canWrite}
              expanded={expandedId === topic.id}
              onToggle={() => setExpandedId((current) => (current === topic.id ? null : topic.id))}
              onEdit={() => setTopicModal({ open: true, topic })}
              onDelete={() => setDeletingTopic(topic)}
            />
          ))}
        </div>
      )}

      {canWrite && groupId && (
        <TopicModal
          open={topicModal.open}
          onClose={() => setTopicModal({ open: false, topic: null })}
          slug={slug}
          groupId={groupId}
          topic={topicModal.topic}
        />
      )}

      <ConfirmDialog
        open={!!deletingTopic}
        onClose={() => setDeletingTopic(null)}
        title="Mavzuni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        description={
          <>
            <b className="text-[var(--color-text)]">{deletingTopic?.title}</b> o&apos;chiriladi — unga tegishli
            barcha savollar ham yo&apos;qoladi.
          </>
        }
        onConfirm={() => deletingTopic && deleteMutation.mutate(deletingTopic.id)}
      />
    </div>
  );
}

function TopicRow({
  slug,
  topic,
  canWrite,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  slug: string;
  topic: LessonTopic;
  canWrite: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <QuestionIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-text)]">{topic.title}</span>
              {topic.reviewDue && <Badge tone="warning">Takrorlash vaqti</Badge>}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
              <span>{formatDate(topic.date)}</span>
              {topic.subject && <span>· {topic.subject}</span>}
              <span>· {topic._count.questions} ta savol</span>
            </span>
          </span>
          <ChevronRightIcon
            className={clsx(
              "h-4 w-4 shrink-0 text-[var(--color-text-muted)]/60 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Mavzuni tahrirlash"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Mavzuni o'chirish"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {expanded && <TopicQuestions slug={slug} topicId={topic.id} canWrite={canWrite} />}
    </Card>
  );
}

function TopicQuestions({ slug, topicId, canWrite }: { slug: string; topicId: string; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [questionModal, setQuestionModal] = useState<{ open: boolean; question: TopicQuestion | null }>({
    open: false,
    question: null,
  });
  const [deletingQuestion, setDeletingQuestion] = useState<TopicQuestion | null>(null);

  const detailQuery = useQuery({
    queryKey: ["lesson-topic", slug, topicId],
    queryFn: () => api.get<LessonTopicDetail>(`/app/lesson-topics/${topicId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/lesson-topics/questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-topic", slug, topicId] });
      queryClient.invalidateQueries({ queryKey: ["lesson-topics", slug] });
      setDeletingQuestion(null);
    },
  });

  return (
    <div className="border-t border-[var(--color-separator)] bg-[var(--color-surface-sunken)]/40 px-5 py-4">
      {detailQuery.isLoading ? (
        <LoadingState rows={2} />
      ) : detailQuery.isError ? (
        <ErrorState message={(detailQuery.error as Error).message} />
      ) : !detailQuery.data || detailQuery.data.questions.length === 0 ? (
        <p className="py-2 text-[13px] text-[var(--color-text-muted)]">Hali savol qo&apos;shilmagan</p>
      ) : (
        <ul className="space-y-3">
          {detailQuery.data.questions.map((question, index) => (
            <li key={question.id} className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-3.5 shadow-[var(--shadow-xs)]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-medium text-[var(--color-text)]">
                  {index + 1}. {question.question}
                </p>
                {canWrite && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuestionModal({ open: true, question })}
                      aria-label="Savolni tahrirlash"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingQuestion(question)}
                      aria-label="Savolni o'chirish"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {question.options.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {question.options.map((option, optionIndex) => (
                    <span
                      key={optionIndex}
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-[12.5px] font-medium",
                        question.answer && option === question.answer
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                          : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
                      )}
                    >
                      {option}
                    </span>
                  ))}
                </div>
              )}
              {question.answer && question.options.length === 0 && (
                <p className="mt-2 text-[12.5px] text-[var(--color-success)]">To&apos;g&apos;ri javob: {question.answer}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setQuestionModal({ open: true, question: null })}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Savol qo&apos;shish
        </Button>
      )}

      {canWrite && (
        <TopicQuestionModal
          open={questionModal.open}
          onClose={() => setQuestionModal({ open: false, question: null })}
          slug={slug}
          topicId={topicId}
          question={questionModal.question}
        />
      )}

      <ConfirmDialog
        open={!!deletingQuestion}
        onClose={() => setDeletingQuestion(null)}
        title="Savolni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        description="Bu savol banki'dan butunlay o'chiriladi."
        onConfirm={() => deletingQuestion && deleteMutation.mutate(deletingQuestion.id)}
      />
    </div>
  );
}
