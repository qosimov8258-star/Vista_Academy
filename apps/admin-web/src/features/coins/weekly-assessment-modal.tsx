"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Star } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { CoinChildBalance, WeeklyAssessmentQuestionGroup } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { IosSwitch } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

type AnswerState = "unasked" | "correct" | "incorrect";

const QA_POOL = 40;
const POEM_POOL = 10;

/**
 * Tarbiyachi shu haftada o'tilgan mavzulardan qaysi savollarni so'raganini
 * va har biriga bola to'g'ri javob berdimi-yo'qmi belgilaydi, she'r
 * yodlaganini belgilaydi. Yulduzcha qo'lda kiritilmaydi — server formula
 * bo'yicha o'zi hisoblaydi: savol-javob max 40, she'r max 10, jami max 50/hafta.
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
  const tr = useTr();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [poemRecited, setPoemRecited] = useState(false);

  const questionsQuery = useQuery({
    queryKey: ["weekly-assessment-questions", child.childId],
    queryFn: () => api.get<WeeklyAssessmentQuestionGroup[]>(`/app/coins/weekly-assessments/questions?childId=${child.childId}`),
    enabled: open,
  });

  const askedEntries = useMemo(() => Object.entries(answers).filter(([, state]) => state !== "unasked"), [answers]);
  const correctCount = askedEntries.filter(([, state]) => state === "correct").length;
  const qaCoins = askedEntries.length > 0 ? Math.round((correctCount / askedEntries.length) * QA_POOL) : 0;
  const poemCoins = poemRecited ? POEM_POOL : 0;
  const totalCoins = qaCoins + poemCoins;
  const empty = askedEntries.length === 0 && !poemRecited;

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
      onClose();
    },
  });
  const { reset } = mutation;

  // Har ochilishda toza belgilar
  useEffect(() => {
    if (!open) return;
    setAnswers({});
    setPoemRecited(false);
    reset();
  }, [open, child.childId, reset]);

  const setAnswer = (questionId: string, state: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [questionId]: prev[questionId] === state ? "unasked" : state }));
  };

  const groups = questionsQuery.data ?? [];
  const close = () => !mutation.isPending && onClose();

  return (
    <IosSheet
      open={open}
      onClose={close}
      title={tr("Haftalik baholash")}
      footer={
        <SheetPrimaryButton onClick={() => !empty && mutation.mutate()} loading={mutation.isPending} dim={empty}>
          {empty ? tr("Savol yoki she'rni belgilang") : tr("{0} ta yulduzcha bilan saqlash", totalCoins)}
        </SheetPrimaryButton>
      }
    >
      <div className="px-4 text-center">
        <p className="text-[17px] font-semibold text-[var(--color-text)]">{tr(child.fullName)}</p>
        <p className="mt-1 text-[13px] leading-snug text-[#8e8e93]">
          {tr("O'tilgan mavzulardan savol so'rang va har birini belgilang. Yulduzcha avtomatik hisoblanadi: savol-javob uchun max")} {QA_POOL}
          {tr(", she'r yodlash uchun")} {POEM_POOL} {tr("— jami max")} {QA_POOL + POEM_POOL} {tr("yulduzcha/hafta.")}
        </p>
      </div>

      {questionsQuery.isLoading ? (
        <SkeletonRows rows={4} avatar={false} />
      ) : questionsQuery.isError ? (
        <SheetSection>
          <Row title={<span className="text-[#ff3b30]">{tr((questionsQuery.error as Error).message)}</span>} />
        </SheetSection>
      ) : groups.length === 0 ? (
        <SheetSection>
          <Row title={<span className="text-[#8e8e93]">{tr("Bu guruh uchun hali savollar banki yo'q")}</span>} />
        </SheetSection>
      ) : (
        groups.map((group) => (
          <SheetSection key={group.topicId} title={tr(group.topicTitle)}>
            {group.questions.map((q) => {
              const state = answers[q.id] ?? "unasked";
              return (
                <div key={q.id} className="group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 text-[15px] leading-snug text-[var(--color-text)]">{tr(q.question)}</span>
                  <div className="flex shrink-0 rounded-full bg-[#767680]/[0.12] p-[3px]" role="radiogroup" aria-label={tr(q.question)}>
                    <AnswerButton active={state === "correct"} color={IOS.green} onClick={() => setAnswer(q.id, "correct")}>
                      {tr("To'g'ri")}
                    </AnswerButton>
                    <AnswerButton active={state === "incorrect"} color={IOS.red} onClick={() => setAnswer(q.id, "incorrect")}>
                      {tr("Noto'g'ri")}
                    </AnswerButton>
                  </div>
                  <span className={ROW_SEPARATOR} aria-hidden="true" />
                </div>
              );
            })}
          </SheetSection>
        ))
      )}

      <SheetSection>
        <div className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="flex-1 text-[15px] text-[var(--color-text)]">{tr("She'r yodladi")}</span>
          <IosSwitch checked={poemRecited} onChange={setPoemRecited} label={tr("She'r yodladi")} />
        </div>
      </SheetSection>

      {/* Hisoblangan natija */}
      <div className={clsx(GROUP_BLOCK, "flex items-center gap-3 px-4 py-3.5")}>
        <Star className="h-7 w-7 shrink-0" fill={IOS.orange} stroke={IOS.orange} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[#8e8e93]">{tr("Hisoblangan yulduzcha:")}</p>
          <p className="text-[13px] text-[#8e8e93]">
            {correctCount}/{askedEntries.length} {tr("to'g'ri javob")}
            {poemRecited ? tr(" · she'r bilan") : ""}
          </p>
        </div>
        <span className="text-[28px] font-bold tabular-nums text-[var(--color-text)]">{totalCoins}</span>
      </div>

      {mutation.error && (
        <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
          {mutation.error instanceof ApiError ? tr(mutation.error.message) : tr("Kutilmagan xatolik yuz berdi")}
        </p>
      )}
    </IosSheet>
  );
}

function AnswerButton({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={clsx("h-8 rounded-full px-3 text-[13px] font-semibold transition-colors", active ? "text-white shadow-sm" : "text-[#8e8e93]")}
      style={active ? { backgroundColor: color } : undefined}
    >
      {children}
    </button>
  );
}
