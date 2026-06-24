import { balanceGameQuestions } from "./balanceGameQuestions";
import {
  PREFERENCE_DIMENSIONS,
  type Answer,
  type PreferenceVector,
} from "./types";

const round3 = (value: number): number => Math.round(value * 1_000) / 1_000;

const emptyVector = (): PreferenceVector => ({
  young: 0,
  middle_senior: 0,
  office: 0,
  local: 0,
  trend: 0,
  access: 0,
  scale: 0,
  low_competition: 0,
  growth: 0,
});

export function validateAnswers(value: unknown): string[] {
  if (!Array.isArray(value)) return ["answers는 배열이어야 합니다."];

  const errors: string[] = [];
  const answers = value as Array<Partial<Answer>>;
  const answerMap = new Map<string, string>();

  for (const answer of answers) {
    if (typeof answer.question_id !== "string" || typeof answer.selected !== "string") {
      errors.push("각 답변에는 문자열 question_id와 selected가 필요합니다.");
      continue;
    }
    if (answerMap.has(answer.question_id)) {
      errors.push(`중복 답변입니다: ${answer.question_id}`);
    }
    answerMap.set(answer.question_id, answer.selected);
  }

  for (const question of balanceGameQuestions) {
    const selected = answerMap.get(question.id);
    if (!selected) {
      errors.push(`필수 문항이 누락되었습니다: ${question.id}`);
    } else if (!question.options.some((option) => option.id === selected)) {
      errors.push(`유효하지 않은 선택지입니다: ${question.id}/${selected}`);
    }
  }

  for (const questionId of answerMap.keys()) {
    if (!balanceGameQuestions.some((question) => question.id === questionId)) {
      errors.push(`알 수 없는 문항입니다: ${questionId}`);
    }
  }

  return errors;
}

export function makePreferenceVector(answers: Answer[]): PreferenceVector {
  const result = emptyVector();
  let validSelectionCount = 0;

  for (const answer of answers) {
    const question = balanceGameQuestions.find((item) => item.id === answer.question_id);
    const option = question?.options.find((item) => item.id === answer.selected);
    if (!option) continue;

    validSelectionCount += 1;
    for (const dimension of PREFERENCE_DIMENSIONS) {
      result[dimension] += option.vector[dimension] ?? 0;
    }
  }

  if (validSelectionCount === 0) return result;
  for (const dimension of PREFERENCE_DIMENSIONS) {
    result[dimension] = round3(result[dimension] / validSelectionCount);
  }
  return result;
}

export function makeProfileTypeName(vector: PreferenceVector): string {
  const audience = vector.young >= vector.middle_senior ? "청년" : "생활권";
  const area = vector.trend + vector.scale >= vector.local + vector.low_competition
    ? "발달상권"
    : "로컬상권";
  const strategy = vector.growth >= vector.low_competition ? "성장형" : "안정형";
  return `${audience}·${area}·${strategy} 창업자`;
}
