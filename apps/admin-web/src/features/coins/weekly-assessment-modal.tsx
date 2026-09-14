"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { CoinChildBalance, WeeklyAssessmentQuestionGroup } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";

type AnswerState = "unasked" | "correct" | "incorrect";

const QA_POOL = 40;
const POEM_POOL = 10;

/**
 * Tarbiyachi shu haftada o'tilgan mavzulardan qaysi savollarni so'raganini
 * va har biriga bola to'g'ri javob berdimi-yo'qmi belgilaydi, she'r
 * yodlaganini belgilaydi. Coin qo'lda kiritilmaydi — server formula bo'yicha
 * o'zi hisoblaydi: savol-javob max 40, she'r max 10, jami max 50/hafta.
 */
export function WeeklyAssessmentModal({
  open,
  onClose,
  slug,
  branchId,
  child,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string;
  child: CoinChildBalance;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [poemRecited, setPoemRecited] = useState(false);

  const questionsQuery = useQuery({
    queryKey: ["weekly-assessment-questions", child.childId],
    queryFn: () =>
      api.get<WeeklyAssessmentQuestionGroup[]>(`/app/coins/weekly-assessments/questions?childId=${child.childId}`),
    enabled: open,
  });

  const askedEntries = useMemo(() => Object.entries(answers).filter(([, state]) => state !== "unasked"), [answers]);
  const correctCount = askedEntries.filter(([, state]) => state === "correct").length;
  const qaCoins = askedEntries.length > 0 ? Math.round((correctCount / askedEntries.length) * QA_POOL) : 0;
  const poemCoins = poemRecited ? POEM_POOL : 0;
  const totalCoins = qaCoins + poemCoins;

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/app/coins/weekly-assessments`, {
        childId: child.childId,
        poemRecited,
        answers: askedEntries.map(([questionId, state]) => ({ questionId, correct: state === "correct" })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coin-children", slug, branchId] });
      queryClient.invalidateQueries({ queryKey: ["coin-weekly-assessments", child.childId] });
      queryClient.invalidateQueries({ queryKey: ["coin-transactions", child.childId] });
      handleClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const handleClose = () => {
    setServerError(null);
    setAnswers({});
    setPoemRecited(false);
    onClose();
  };

  const setAnswer = (questionId: string, state: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [questionId]: prev[questionId] === state ? "unasked" : state }));
  };

  const groups = questionsQuery.data ?? [];

  return (
    <Modal open={open} onClose={handleClose} title={`${child.fullName} — haftalik baholash`} widthClassName="max-w-2xl">
      <div className="space-y-4">
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <p className="text-sm text-[var(--color-text-muted)]">
          O&apos;tilgan mavzulardan savol so&apos;rang va har birini belgilang. Coin avtomatik hisoblanadi: savol-javob
          uchun max {QA_POOL}, she&apos;r yodlash uchun {POEM_POOL} — jami max {QA_POOL + POEM_POOL} coin/hafta.
        </p>

        {questionsQuery.isLoading ? (
          <LoadingState />
        ) : questionsQuery.isError ? (
          <ErrorState message={(questionsQuery.error as Error).message} />
        ) : groups.length === 0 ? (
          <EmptyState title="Bu guruh uchun hali savollar banki yo'q" />
        ) : (
          <div className="max-h-[45vh] space-y-4 overflow-y-auto scrollbar-thin pr-1">
            {groups.map((group) => (
              <div key={group.topicId} className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
                  {group.topicTitle}
                </p>
                <ul className="space-y-1.5">
                  {group.questions.map((q) => {
                    const state = answers[q.id] ?? "unasked";
                    return (
                      <li
                        key={q.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--color-separator)] px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 text-sm text-[var(--color-text)]">{q.question}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAnswer(q.id, "correct")}
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                              state === "correct"
                                ? "bg-[var(--color-success)] text-white"
                                : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]",
                            )}
                          >
                            To&apos;g&apos;ri
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnswer(q.id, "incorrect")}
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                              state === "incorrect"
                                ? "bg-[var(--color-danger)] text-white"
                                : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]",
                            )}
                          >
                            Noto&apos;g&apos;ri
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-3 py-2.5">
          <span className="text-sm font-medium text-[var(--color-text)]">She&apos;r yodladi</span>
          <Switch checked={poemRecited} onChange={() => setPoemRecited((v) => !v)} aria-label="She'r yodladi" />
        </div>

        <p className="text-sm text-[var(--color-text)]">
          Hisoblangan coin: <span className="font-semibold">{totalCoins}</span>
          <span className="text-[var(--color-text-muted)]">
            {" "}
            ({correctCount}/{askedEntries.length} to&apos;g&apos;ri javob{poemRecited ? " · she'r bilan" : ""})
          </span>
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            loading={mutation.isPending}
            disabled={askedEntries.length === 0 && !poemRecited}
            onClick={() => {
              setServerError(null);
              mutation.mutate();
            }}
          >
            Saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
