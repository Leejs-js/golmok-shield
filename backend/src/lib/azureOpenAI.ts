import type {
  PreferenceVector,
  RankedDong,
  RankedDongWithReason,
  ScoreInsight,
} from "./types";

const DEFAULT_API_VERSION = "2024-10-21";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 1;
const FORBIDDEN_CLAIMS = /매출|임대료|야간\s*유동|객단가|체류시간|성공.{0,5}(보장|확실)|반드시\s*성공/i;

const SCORE_LABELS: Record<string, string> = {
  young_score: "20·30대 적합도",
  middle_senior_score: "중장년 수요",
  office_score: "업무 수요",
  local_score: "생활권 수요",
  trend_score: "트렌드 적합도",
  access_score: "대중교통 접근성",
  scale_score: "상권 규모",
  low_competition_score: "낮은 경쟁 부담",
  growth_score: "점포 성장성",
};

type AzureConfig = {
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
  apiVersion: string;
  timeoutMs: number;
  maxRetries: number;
};

export type AzureOpenAIStatus = {
  configured: boolean;
  missing_env: string[];
  api_version: string;
  timeout_ms: number;
  max_retries: number;
};

type AzureReasonPayload = {
  recommendations?: string[];
  not_recommended?: string[];
  recommendation_score_insights?: AzureScoreInsightPayload[][];
  not_recommended_score_insights?: AzureScoreInsightPayload[][];
};

type AzureScoreInsightPayload = {
  key?: unknown;
  summary?: unknown;
  tip?: unknown;
};

type AzureChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

class AzureHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(`Azure OpenAI HTTP ${status}`);
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function readConfig(): AzureConfig {
  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, ""),
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION,
    timeoutMs: positiveInteger(process.env.AZURE_OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxRetries: positiveInteger(process.env.AZURE_OPENAI_MAX_RETRIES, DEFAULT_MAX_RETRIES),
  };
}

export function getAzureOpenAIStatus(): AzureOpenAIStatus {
  const config = readConfig();
  const environmentEntries: Array<[string, string | undefined]> = [
    ["AZURE_OPENAI_ENDPOINT", config.endpoint],
    ["AZURE_OPENAI_API_KEY", config.apiKey],
    ["AZURE_OPENAI_DEPLOYMENT", config.deployment],
  ];
  const missingEnv = environmentEntries
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return {
    configured: missingEnv.length === 0,
    missing_env: missingEnv,
    api_version: config.apiVersion,
    timeout_ms: config.timeoutMs,
    max_retries: config.maxRetries,
  };
}

function fallbackReason(item: RankedDong, recommended: boolean): string {
  const strongest = Object.entries(item.score_breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([key]) => SCORE_LABELS[key] ?? key.replace(/_score$/, "").replace(/_/g, " "))
    .join("·");

  if (recommended) {
    return `현재 데이터 기준, ${item.dong_nm}은 ${item.cluster_type}에 속하며 ${strongest} 특성이 사용자 선호와 비교적 잘 맞습니다.`;
  }
  return `현재 데이터 기준, ${item.dong_nm}은 ${item.cluster_type}에 속하지만 사용자가 선택한 조건과의 종합 적합도가 상대적으로 낮습니다.`;
}

function scoreLevel(score: number): ScoreInsight["level"] {
  if (score >= 75) return "normal";
  if (score >= 50) return "caution";
  return "risk";
}

function fallbackScoreInsights(item: RankedDong, recommended: boolean): ScoreInsight[] {
  return Object.entries(item.score_breakdown).map(([key, score]) => {
    const label = SCORE_LABELS[key] ?? key.replace(/_score$/, "").replace(/_/g, " ");
    const level = scoreLevel(score);
    const assessment = level === "normal" ? "높은 편" : level === "caution" ? "보통 수준" : "낮은 편";
    const tip = recommended
      ? level === "normal"
        ? `${label}가 강점인 만큼 이 특성을 살릴 수 있는 콘셉트와 메뉴 구성이 적합합니다.`
        : `${label}가 상대적으로 낮을 수 있어 고객 유입과 운영 전략을 함께 보완해 보세요.`
      : `${label}는 사용자의 선호와 상대적으로 맞지 않을 수 있어 보완 전략을 검토할 필요가 있습니다.`;

    return {
      key,
      label,
      score,
      level,
      summary: `현재 데이터 기준, ${item.dong_nm}의 ${label} 점수는 ${score.toFixed(1)}점으로 ${assessment}입니다.`,
      tip,
    };
  });
}

function normalizeInsightText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 220 || FORBIDDEN_CLAIMS.test(trimmed)) return fallback;
  const normalized = trimmed.includes("현재 데이터 기준")
    ? trimmed
    : `현재 데이터 기준, ${trimmed}`;
  return normalized.length <= 220 ? normalized : fallback;
}

function mergeScoreInsights(
  item: RankedDong,
  payload: AzureScoreInsightPayload[] | undefined,
  recommended: boolean,
): ScoreInsight[] {
  const base = fallbackScoreInsights(item, recommended);
  if (!Array.isArray(payload)) return base;

  const byKey = new Map<string, AzureScoreInsightPayload>();
  for (const candidate of payload) {
    if (candidate && typeof candidate === "object" && typeof candidate.key === "string") {
      if (Object.prototype.hasOwnProperty.call(item.score_breakdown, candidate.key)) {
        byKey.set(candidate.key, candidate);
      }
    }
  }

  return base.map((insight) => {
    const generated = byKey.get(insight.key);
    if (!generated) return insight;
    return {
      ...insight,
      summary: normalizeInsightText(generated.summary, insight.summary),
      tip: normalizeInsightText(generated.tip, insight.tip),
    };
  });
}

function withFallback(items: RankedDong[], recommended: boolean): RankedDongWithReason[] {
  return items.map((item) => ({
    ...item,
    reason: fallbackReason(item, recommended),
    score_insights: fallbackScoreInsights(item, recommended),
  }));
}

export function addFallbackReasons(
  items: RankedDong[],
  recommended: boolean,
): RankedDongWithReason[] {
  return withFallback(items, recommended);
}

export async function generateScoreInsight(
  item: RankedDong,
  key: string,
  recommended: boolean,
): Promise<{ source: "azure_openai" | "rule_based"; insight: ScoreInsight }> {
  const fallback = fallbackScoreInsights(item, recommended).find((candidate) => candidate.key === key);
  if (!fallback) throw new Error("존재하지 않는 점수 항목입니다.");
  if (!getAzureOpenAIStatus().configured) return { source: "rule_based", insight: fallback };

  try {
    const data = await requestChatCompletion({
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `입지 점수 한 항목을 설명하세요. 입력의 동 이름, key, score를 바꾸지 말고 summary와 tip만 작성하세요. 각 문장은 120자 이내의 한국어로 쓰고 "현재 데이터 기준"을 포함하세요. 매출, 임대료, 야간 유동인구, 객단가, 체류시간, 성공 보장 표현은 금지합니다. {"key":"입력 key","summary":"점수 해석","tip":"실행 조언"} JSON만 반환하세요.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            dong_nm: item.dong_nm,
            cluster_type: item.cluster_type,
            recommended,
            key,
            label: fallback.label,
            score: fallback.score,
          }),
        },
      ],
    });
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Azure OpenAI 응답에 content가 없습니다.");
    const parsed = parseJsonContent(content) as AzureScoreInsightPayload;
    if (parsed.key !== key) throw new Error("Azure OpenAI가 다른 점수 key를 반환했습니다.");
    return {
      source: "azure_openai",
      insight: {
        ...fallback,
        summary: normalizeInsightText(parsed.summary, fallback.summary),
        tip: normalizeInsightText(parsed.tip, fallback.tip),
      },
    };
  } catch (error) {
    console.warn("[azureOpenAI] 점수 설명 생성 실패, 규칙 기반 설명을 사용합니다.", error);
    return { source: "rule_based", insight: fallback };
  }
}

export async function generateDongReport(
  item: RankedDong,
  recommended: boolean,
  userVector?: PreferenceVector,
): Promise<{
  source: "azure_openai" | "rule_based";
  reason: string;
  score_insights: ScoreInsight[];
}> {
  const fallbackReasonText = fallbackReason(item, recommended);
  const fallbackInsights = fallbackScoreInsights(item, recommended);
  if (!getAzureOpenAIStatus().configured) {
    return { source: "rule_based", reason: fallbackReasonText, score_insights: fallbackInsights };
  }

  try {
    const data = await requestChatCompletion({
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 소상공인 입지 컨설턴트입니다. 제공된 추천 결과와 점수를 바꾸거나 새로운 수치를 만들지 마세요. reason은 반드시 입력 동 이름을 포함해 종합적인 상권 해석을 2~3개의 구체적인 한국어 문장으로 작성하세요. score_insights는 입력 score_breakdown의 모든 key에 대해 작성하세요. 각 summary는 점수가 의미하는 강점·한계를 2문장으로 해석하고, tip은 실제 콘셉트·고객 접근·운영 방향에 도움이 되는 1문장으로 작성하세요. 추천 지역은 강점을 활용하면서 보완점도 짚고, 비추천 지역은 신중하게 위험과 보완 전략을 설명하세요. 모든 문구에는 과장 없이 "현재 데이터 기준"이라는 표현을 포함하세요. 매출, 임대료, 야간 유동인구, 객단가, 체류시간, 성공 보장 표현은 금지합니다. {"reason":"종합 리포트","score_insights":[{"key":"입력 key","summary":"2문장 해석","tip":"1문장 조언"}]} JSON만 반환하세요. score, label, level은 생성하지 마세요.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            recommended,
            preference_vector: userVector,
            dong: item,
          }),
        },
      ],
    });
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Azure OpenAI 응답에 content가 없습니다.");
    const parsed = parseJsonContent(content) as {
      reason?: unknown;
      score_insights?: AzureScoreInsightPayload[];
    };
    const reason = typeof parsed.reason === "string"
      ? normalizeReason(parsed.reason, item) ?? fallbackReasonText
      : fallbackReasonText;
    return {
      source: "azure_openai",
      reason,
      score_insights: mergeScoreInsights(item, parsed.score_insights, recommended),
    };
  } catch (error) {
    console.warn("[azureOpenAI] 동 상권 리포트 생성 실패, 규칙 기반 설명을 사용합니다.", error);
    return { source: "rule_based", reason: fallbackReasonText, score_insights: fallbackInsights };
  }
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function requestChatCompletion(body: Record<string, unknown>): Promise<AzureChatResponse> {
  const config = readConfig();
  if (!config.endpoint || !config.apiKey || !config.deployment) {
    throw new Error(`Azure OpenAI 환경변수 누락: ${getAzureOpenAIStatus().missing_env.join(", ")}`);
  }

  const url = `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": config.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) return (await response.json()) as AzureChatResponse;
      const retryable = response.status === 429 || response.status >= 500;
      const error = new AzureHttpError(response.status, retryable);
      if (!retryable || attempt === config.maxRetries) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (error instanceof AzureHttpError && !error.retryable) throw error;
      if (attempt === config.maxRetries) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(Math.min(1_000 * (attempt + 1), 3_000));
  }

  throw lastError instanceof Error ? lastError : new Error("Azure OpenAI 요청 실패");
}

function parseJsonContent(content: string): AzureReasonPayload {
  const withoutFence = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(withoutFence) as AzureReasonPayload;
}

function normalizeReason(reason: string, item: RankedDong): string | undefined {
  const trimmed = reason.trim();
  if (
    trimmed.length < 10 ||
    trimmed.length > 400 ||
    !trimmed.includes(item.dong_nm) ||
    FORBIDDEN_CLAIMS.test(trimmed)
  ) {
    return undefined;
  }
  const normalized = trimmed.includes("현재 데이터 기준") ? trimmed : `현재 데이터 기준, ${trimmed}`;
  return normalized.length <= 400 ? normalized : undefined;
}

const SYSTEM_PROMPT = `
당신은 입지 데이터 설명 도우미입니다.
추천 계산이나 순위를 바꾸지 마세요.
제공된 점수, 군집, 사용자 선호 벡터만 근거로 설명하세요.

각 추천 동과 비추천 동에 대해 다음을 작성하세요.
1. 전체 설명 reason 한 문장
2. score_breakdown의 각 항목에 대한 summary
3. 사용자가 이해하기 쉬운 tip

반드시 아래 JSON 형식만 반환하세요.
{
  "recommendations": ["추천 동 전체 설명 문장"],
  "not_recommended": ["비추천 동 전체 설명 문장"],
  "recommendation_score_insights": [[{"key":"young_score","summary":"점수 해석 문장","tip":"실행 조언 문장"}]],
  "not_recommended_score_insights": [[{"key":"young_score","summary":"점수 해석 문장","tip":"실행 조언 문장"}]]
}

recommendation_score_insights는 recommendations와 같은 순서로 작성하세요.
not_recommended_score_insights는 not_recommended와 같은 순서로 작성하세요.
각 score insight의 key는 입력 score_breakdown에 있는 key만 사용하세요.
점수 값, 동 이름, score key, 추천 순위를 바꾸지 마세요.
score, label, level은 생성하지 마세요. summary와 tip만 각각 120자 이내의 한국어 문장으로 작성하세요.
각 문장에는 과장 없이 "현재 데이터 기준"이라는 표현을 포함하세요.
매출, 임대료, 야간 유동인구, 객단가, 체류시간, 성공 보장 표현은 사용하지 마세요.
`.trim();

export async function addRecommendationReasons(
  recommendations: RankedDong[],
  notRecommended: RankedDong[],
  userVector: PreferenceVector,
): Promise<{
  source: "azure_openai" | "rule_based";
  recommendations: RankedDongWithReason[];
  not_recommended: RankedDongWithReason[];
}> {
  const fallback = {
    source: "rule_based" as const,
    recommendations: withFallback(recommendations, true),
    not_recommended: withFallback(notRecommended, false),
  };
  if (!getAzureOpenAIStatus().configured) return fallback;

  try {
    const data = await requestChatCompletion({
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            preference_vector: userVector,
            recommendations,
            not_recommended: notRecommended,
          }),
        },
      ],
    });

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Azure OpenAI 응답에 content가 없습니다.");
    const parsed = parseJsonContent(content);
    if (
      parsed.recommendations?.length !== recommendations.length ||
      parsed.not_recommended?.length !== notRecommended.length
    ) {
      throw new Error("Azure OpenAI 설명 배열 길이가 올바르지 않습니다.");
    }

    const recommendationReasons = parsed.recommendations.map((reason, index) =>
      typeof reason === "string" ? normalizeReason(reason, recommendations[index]) : undefined,
    );
    const notRecommendedReasons = parsed.not_recommended.map((reason, index) =>
      typeof reason === "string" ? normalizeReason(reason, notRecommended[index]) : undefined,
    );
    if ([...recommendationReasons, ...notRecommendedReasons].some((reason) => !reason)) {
      throw new Error("Azure OpenAI 설명이 근거 안전성 검사를 통과하지 못했습니다.");
    }

    return {
      source: "azure_openai",
      recommendations: recommendations.map((item, index) => ({
        ...item,
        reason: recommendationReasons[index]!,
        score_insights: mergeScoreInsights(
          item,
          parsed.recommendation_score_insights?.[index],
          true,
        ),
      })),
      not_recommended: notRecommended.map((item, index) => ({
        ...item,
        reason: notRecommendedReasons[index]!,
        score_insights: mergeScoreInsights(
          item,
          parsed.not_recommended_score_insights?.[index],
          false,
        ),
      })),
    };
  } catch (error) {
    console.warn("[azureOpenAI] 설명 생성 실패, 규칙 기반 설명을 사용합니다.", error);
    return fallback;
  }
}

export async function probeAzureOpenAI(): Promise<{ ok: true; message: string }> {
  const data = await requestChatCompletion({
    temperature: 0,
    messages: [
      { role: "system", content: "연결 확인 요청에는 OK만 답하세요." },
      { role: "user", content: "연결 확인" },
    ],
  });
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Azure OpenAI 연결 응답에 content가 없습니다.");
  return { ok: true, message: content };
}
