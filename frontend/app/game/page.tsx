"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getBalanceGameQuestions, postRecommendation } from "@/lib/api";
import type { Answer, BalanceGameQuestion } from "@/lib/types";
import ProgressDots from "@/components/ProgressDots";
import BalanceCard from "@/components/BalanceCard";
import ErrorCard from "@/components/ErrorCard";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StepIndicator from "@/components/StepIndicator";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function GamePage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<BalanceGameQuestion[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    setQuestionError(null);
    try {
      const loaded = await getBalanceGameQuestions();
      setQuestions(loaded);
      setStep(0);
      setAnswers([]);
    } catch (error) {
      setQuestionError(errorMessage(error, "질문을 불러오지 못했습니다."));
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const submitRecommendation = useCallback(
    async (completedAnswers: Answer[]) => {
      setSubmitting(true);
      setRecommendationError(null);
      sessionStorage.setItem("answers", JSON.stringify(completedAnswers));
      try {
        const result = await postRecommendation(completedAnswers);
        sessionStorage.setItem("recommendation", JSON.stringify(result));
        router.push("/result");
      } catch (error) {
        setRecommendationError(errorMessage(error, "추천 결과를 만들지 못했습니다."));
      } finally {
        setSubmitting(false);
      }
    },
    [router],
  );

  const choose = useCallback(
    (selected: string) => {
      const question = questions[step];
      if (!question || transitioning || submitting) return;

      const next = [
        ...answers.filter((answer) => answer.question_id !== question.id),
        { question_id: question.id, selected },
      ];
      setAnswers(next);
      setRecommendationError(null);

      if (step < questions.length - 1) {
        setTransitioning(true);
        window.setTimeout(() => {
          setStep((current) => current + 1);
          setTransitioning(false);
        }, 300);
        return;
      }

      void submitRecommendation(next);
    },
    [answers, questions, step, submitting, submitRecommendation, transitioning],
  );

  const back = useCallback(() => {
    if (step > 0) {
      setRecommendationError(null);
      setStep((current) => current - 1);
    } else {
      router.push("/onboarding");
    }
  }, [step, router]);

  if (loadingQuestions) {
    return <LoadingState message="질문을 불러오고 있어요…" />;
  }

  if (questionError || questions.length === 0) {
    return (
      <PageFrame>
        <div className="flex-1 flex items-center justify-center p-6">
          <ErrorCard
            title="질문을 불러오지 못했어요"
            description={questionError || "표시할 질문이 없습니다."}
            actionLabel="다시 시도"
            onAction={() => void loadQuestions()}
          />
        </div>
      </PageFrame>
    );
  }

  if (recommendationError) {
    return (
      <PageFrame>
        <div className="flex-1 flex items-center justify-center p-6">
          <ErrorCard
            title="추천 결과를 만들지 못했어요"
            description={recommendationError}
            actionLabel="다시 시도"
            onAction={() => void submitRecommendation(answers)}
          />
        </div>
      </PageFrame>
    );
  }

  if (submitting) {
    return <LoadingState message="마포구 상권을 분석하고 있어요…" />;
  }

  const question = questions[step];
  const previousAnswer = answers.find((a) => a.question_id === question.id)?.selected;

  return (
    <PageFrame>
      <div className="flex-1 flex flex-col items-center px-6 py-4">
        <div key={step} className="w-full max-w-[580px] my-auto animate-fade-up">
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-0.5 bg-[#D9F0FA] text-navy text-xs font-extrabold rounded-pill mb-3 tracking-wide">
              질문 {step + 1}
            </span>
            <h2 className="text-[20px] sm:text-[22px] leading-snug font-extrabold text-[#34454D] tracking-tight text-balance">
              {question.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-[1fr_auto_1fr] items-center gap-4 xs:gap-6 w-full">
            <BalanceCard
              letter="A"
              title={question.options[0].label}
              subtitle=""
              selected={previousAnswer === question.options[0].id}
              onClick={() => choose(question.options[0].id)}
            />
            <div className="items-center justify-center xs:flex hidden">
              <span className="w-10 h-10 rounded-full bg-[#34454D] text-white flex items-center justify-center text-[13px] font-extrabold shadow-lg">
                VS
              </span>
            </div>
            <BalanceCard
              letter="B"
              title={question.options[1].label}
              subtitle=""
              selected={previousAnswer === question.options[1].id}
              onClick={() => choose(question.options[1].id)}
            />
          </div>

          {step === 0 && (
            <p className="text-center text-[12.5px] text-muted mt-4">
              카드를 선택하면 자동으로 다음 질문으로 넘어가요
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-col items-center gap-4 w-full max-w-[580px]">
          <ProgressDots total={questions.length} current={step} />
          <p className="text-[12.5px] font-bold text-muted tracking-wide">
            {step + 1} / {questions.length}
          </p>
          <div className="flex items-center justify-between w-full">
            <button
              onClick={back}
              className="inline-flex items-center gap-1 h-[34px] px-3 bg-transparent border-none cursor-pointer text-[13px] font-semibold text-[#6B6B66]"
            >
              <span aria-hidden="true">‹</span> 이전
            </button>
            <span className="text-[13px] font-semibold text-muted">카드를 선택해주세요</span>
            <div className="w-[60px]" />
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-white">
      <SiteHeader />
      <StepIndicator current={1} />
      {children}
      <SiteFooter />
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-white gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-navy/20 border-t-navy animate-spin" />
      <p className="text-sm font-bold text-subtle">{message}</p>
    </div>
  );
}
