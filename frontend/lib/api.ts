import type {
  Answer,
  BalanceGameQuestion,
  RankedDongWithReason,
  RecommendationResponse,
  ScoreInsight,
} from "./types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;

function apiUrl(path: string): string {
  return `${BASE_URL}/api${path}`;
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("서버 응답 시간이 초과되었습니다. 다시 시도해 주세요.");
    }
    throw new Error("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    clearTimeout(timer);
  }
}

async function throwApiError(response: Response): Promise<never> {
  let message = `API 요청에 실패했습니다. (${response.status})`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") message = body.error;
  } catch {
    // JSON 오류 응답이 아니면 상태 코드 기반 메시지를 사용한다.
  }
  throw new Error(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string";
}

function hasNumber(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "number" && Number.isFinite(value[key]);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isObject(value) && Object.values(value).every(
    (item) => typeof item === "number" && Number.isFinite(item),
  );
}

function isScoreInsight(value: unknown): boolean {
  return isObject(value) &&
    hasString(value, "key") &&
    hasString(value, "label") &&
    hasNumber(value, "score") &&
    (value.level === "normal" || value.level === "caution" || value.level === "risk") &&
    hasString(value, "summary") &&
    hasString(value, "tip");
}

function isRankedDong(value: unknown): value is RankedDongWithReason {
  if (!isObject(value)) return false;
  return (
    hasNumber(value, "rank") &&
    hasString(value, "dong_nm") &&
    hasNumber(value, "total_score") &&
    hasNumber(value, "cluster_id") &&
    hasString(value, "cluster_type") &&
    hasString(value, "reason") &&
    isNumberRecord(value.score_breakdown) &&
    (value.score_insights === undefined ||
      (Array.isArray(value.score_insights) && value.score_insights.every(isScoreInsight)))
  );
}

export function isBalanceGameQuestions(
  value: unknown,
): value is { questions: BalanceGameQuestion[] } {
  if (!isObject(value) || !Array.isArray(value.questions) || value.questions.length === 0) {
    return false;
  }
  return value.questions.every((question) => {
    if (!isObject(question) || !hasString(question, "id") || !hasString(question, "title")) {
      return false;
    }
    return (
      Array.isArray(question.options) &&
      question.options.length === 2 &&
      question.options.every(
        (option) => isObject(option) && hasString(option, "id") && hasString(option, "label"),
      )
    );
  });
}

export function isRecommendationResponse(value: unknown): value is RecommendationResponse {
  if (!isObject(value)) return false;
  const modelInfo = value.model_info;
  const userProfile = value.user_profile;
  if (!isObject(modelInfo) || !isObject(userProfile)) return false;

  const validModelInfo =
    hasString(modelInfo, "engine_id") &&
    hasString(modelInfo, "engine_version") &&
    hasString(modelInfo, "engine_kind") &&
    hasString(modelInfo, "input_schema_version") &&
    hasString(modelInfo, "output_schema_version") &&
    isStringArray(modelInfo.feature_names);
  const validProfile =
    hasString(userProfile, "type_name") && isNumberRecord(userProfile.preference_vector);
  const validExplanationSource =
    value.explanation_source === "azure_openai" || value.explanation_source === "rule_based";
  const validRankings =
    Array.isArray(value.recommendations) &&
    value.recommendations.length === 3 &&
    value.recommendations.every(isRankedDong) &&
    Array.isArray(value.not_recommended) &&
    value.not_recommended.length === 3 &&
    value.not_recommended.every(isRankedDong);
  const validMapData =
    Array.isArray(value.map_data) &&
    value.map_data.length === 6 &&
    value.map_data.every(
      (item) =>
        isObject(item) &&
        hasString(item, "dong_nm") &&
        (item.status === "recommended" || item.status === "not_recommended") &&
        hasNumber(item, "rank") &&
        hasNumber(item, "score") &&
        hasNumber(item, "cluster_id"),
    );

  return (
    validModelInfo &&
    validProfile &&
    validExplanationSource &&
    validRankings &&
    validMapData &&
    Array.isArray(value.cluster_summary)
  );
}

export async function getBalanceGameQuestions(): Promise<BalanceGameQuestion[]> {
  const response = await fetchWithTimeout(apiUrl("/recommend/questions"));
  if (!response.ok) return throwApiError(response);
  const body: unknown = await response.json();
  if (!isBalanceGameQuestions(body)) {
    throw new Error("질문 API 응답 형식이 올바르지 않습니다.");
  }
  return body.questions;
}

export async function postRecommendation(answers: Answer[]): Promise<RecommendationResponse> {
  const response = await fetchWithTimeout(apiUrl("/recommend"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) return throwApiError(response);
  const body: unknown = await response.json();
  if (!isRecommendationResponse(body)) {
    throw new Error("추천 API 응답 형식이 올바르지 않습니다.");
  }
  return body;
}

export async function postScoreInsight(
  item: RankedDongWithReason,
  key: string,
  recommended: boolean,
): Promise<{ source: "azure_openai" | "rule_based"; insight: ScoreInsight }> {
  const response = await fetchWithTimeout(apiUrl("/recommend/score-insight"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, key, recommended }),
  });
  if (!response.ok) return throwApiError(response);
  const body: unknown = await response.json();
  if (
    !isObject(body) ||
    (body.source !== "azure_openai" && body.source !== "rule_based") ||
    !isScoreInsight(body.insight)
  ) {
    throw new Error("점수 설명 API 응답 형식이 올바르지 않습니다.");
  }
  return body as { source: "azure_openai" | "rule_based"; insight: ScoreInsight };
}

export async function postDongReport(
  item: RankedDongWithReason,
  recommended: boolean,
  preferenceVector: Record<string, number>,
): Promise<{
  source: "azure_openai" | "rule_based";
  reason: string;
  score_insights: ScoreInsight[];
}> {
  const response = await fetchWithTimeout(apiUrl("/recommend/dong-report"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item,
      recommended,
      preference_vector: preferenceVector,
    }),
  }, 25_000);
  if (!response.ok) return throwApiError(response);
  const body: unknown = await response.json();
  if (
    !isObject(body) ||
    (body.source !== "azure_openai" && body.source !== "rule_based") ||
    !hasString(body, "reason") ||
    !Array.isArray(body.score_insights) ||
    !body.score_insights.every(isScoreInsight)
  ) {
    throw new Error("상권 리포트 API 응답 형식이 올바르지 않습니다.");
  }
  return body as {
    source: "azure_openai" | "rule_based";
    reason: string;
    score_insights: ScoreInsight[];
  };
}
