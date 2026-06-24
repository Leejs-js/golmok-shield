import { generateDongReport, generateScoreInsight, getAzureOpenAIStatus } from "../lib/azureOpenAI";
import { balanceGameQuestions } from "../lib/balanceGameQuestions";
import { validateAnswers } from "../lib/preference";
import { buildRecommendationResponse } from "../lib/service";
import type { Answer, PreferenceVector, RankedDong } from "../lib/types";
import { getRecommendationEngine } from "../model/recommendationEngine";

export type JsonResult = {
  status: number;
  body: unknown;
};

export function getPublicQuestions(): unknown {
  return {
    questions: balanceGameQuestions.map((question) => ({
      id: question.id,
      title: question.title,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
    })),
  };
}

export async function handleRecommendation(body: unknown): Promise<JsonResult> {
  const answers =
    typeof body === "object" && body !== null && "answers" in body
      ? (body as { answers: unknown }).answers
      : undefined;
  const errors = validateAnswers(answers);
  if (errors.length > 0) {
    return {
      status: 400,
      body: { error: "답변 형식이 올바르지 않습니다.", details: errors },
    };
  }

  try {
    return {
      status: 200,
      body: await buildRecommendationResponse(answers as Answer[]),
    };
  } catch (error) {
    console.error("[recommend handler] 추천 처리 실패", error);
    return {
      status: 500,
      body: { error: "추천 결과를 생성하지 못했습니다." },
    };
  }
}

export async function handleScoreInsight(body: unknown): Promise<JsonResult> {
  if (typeof body !== "object" || body === null) {
    return { status: 400, body: { error: "요청 형식이 올바르지 않습니다." } };
  }
  const request = body as { item?: unknown; key?: unknown; recommended?: unknown };
  const item = request.item as Partial<RankedDong> | undefined;
  if (
    !item ||
    typeof item.dong_nm !== "string" ||
    typeof item.cluster_type !== "string" ||
    typeof item.score_breakdown !== "object" ||
    item.score_breakdown === null ||
    typeof request.key !== "string" ||
    typeof request.recommended !== "boolean" ||
    !Object.prototype.hasOwnProperty.call(item.score_breakdown, request.key) ||
    !Number.isFinite((item.score_breakdown as Record<string, unknown>)[request.key])
  ) {
    return { status: 400, body: { error: "점수 설명 요청 형식이 올바르지 않습니다." } };
  }

  try {
    return {
      status: 200,
      body: await generateScoreInsight(item as RankedDong, request.key, request.recommended),
    };
  } catch (error) {
    console.error("[score insight handler] 설명 생성 실패", error);
    return { status: 500, body: { error: "점수 설명을 생성하지 못했습니다." } };
  }
}

export async function handleDongReport(body: unknown): Promise<JsonResult> {
  if (typeof body !== "object" || body === null) {
    return { status: 400, body: { error: "요청 형식이 올바르지 않습니다." } };
  }
  const request = body as {
    item?: unknown;
    recommended?: unknown;
    preference_vector?: unknown;
  };
  const item = request.item as Partial<RankedDong> | undefined;
  const scoreValues = item?.score_breakdown && typeof item.score_breakdown === "object"
    ? Object.values(item.score_breakdown)
    : [];
  const preferenceVector = request.preference_vector;
  const validPreferenceVector = preferenceVector === undefined || (
    typeof preferenceVector === "object" &&
    preferenceVector !== null &&
    Object.values(preferenceVector).every((value) => typeof value === "number" && Number.isFinite(value))
  );
  if (
    !item ||
    typeof item.dong_nm !== "string" ||
    typeof item.cluster_type !== "string" ||
    scoreValues.length === 0 ||
    !scoreValues.every((value) => typeof value === "number" && Number.isFinite(value)) ||
    typeof request.recommended !== "boolean" ||
    !validPreferenceVector
  ) {
    return { status: 400, body: { error: "상권 리포트 요청 형식이 올바르지 않습니다." } };
  }

  try {
    return {
      status: 200,
      body: await generateDongReport(
        item as RankedDong,
        request.recommended,
        preferenceVector as PreferenceVector | undefined,
      ),
    };
  } catch (error) {
    console.error("[dong report handler] 리포트 생성 실패", error);
    return { status: 500, body: { error: "상권 리포트를 생성하지 못했습니다." } };
  }
}

export function handleHealth(): JsonResult {
  try {
    const engine = getRecommendationEngine();
    return {
      status: 200,
      body: {
        status: "ok",
        model: engine.info,
        data: engine.diagnostics(),
        azure_openai: getAzureOpenAIStatus(),
      },
    };
  } catch (error) {
    console.error("[recommend health] 상태 확인 실패", error);
    return {
      status: 500,
      body: { status: "error", error: "추천 엔진을 초기화하지 못했습니다." },
    };
  }
}
