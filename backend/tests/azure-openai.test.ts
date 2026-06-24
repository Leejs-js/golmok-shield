import assert from "node:assert/strict";
import test from "node:test";
import {
  addRecommendationReasons,
  generateDongReport,
  getAzureOpenAIStatus,
} from "../src/lib/azureOpenAI";
import type { PreferenceVector, RankedDong } from "../src/lib/types";

const vector: PreferenceVector = {
  young: 0.2,
  middle_senior: 0.02,
  office: 0.2,
  local: 0.12,
  trend: 0.52,
  access: 0.26,
  scale: 0.58,
  low_competition: 0.1,
  growth: 0.32,
};

const recommendation: RankedDong = {
  rank: 1,
  dong_nm: "서교동",
  total_score: 84.9,
  cluster_id: 1,
  cluster_type: "독립 핵심 상권",
  score_breakdown: { trend_score: 95, access_score: 88 },
};

const notRecommended: RankedDong = {
  rank: 1,
  dong_nm: "염리동",
  total_score: 17.3,
  cluster_id: 0,
  cluster_type: "생활권·로컬 상권",
  score_breakdown: { trend_score: 12, access_score: 8 },
};

const ENV_KEYS = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_OPENAI_MAX_RETRIES",
] as const;

function configureAzure(): void {
  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  process.env.AZURE_OPENAI_MAX_RETRIES = "0";
}

test("Azure OpenAI 응답이 안전성 검사를 통과하면 설명에 사용한다", async () => {
  const originalFetch = globalThis.fetch;
  configureAzure();
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          recommendations: ["현재 데이터 기준, 서교동은 트렌드와 접근성 특성이 선호와 잘 맞습니다."],
          not_recommended: ["현재 데이터 기준, 염리동은 선택 조건과의 종합 적합도가 상대적으로 낮습니다."],
          recommendation_score_insights: [[{
            key: "trend_score",
            score: 0,
            level: "risk",
            summary: "트렌드 특성이 선호 방향과 잘 맞는 높은 점수입니다.",
            tip: "트렌드 강점을 살리는 콘셉트를 구체화해 보세요.",
          }]],
          not_recommended_score_insights: [[{
            key: "unknown_score",
            summary: "존재하지 않는 점수입니다.",
            tip: "이 설명은 무시되어야 합니다.",
          }]],
        }),
      },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    assert.equal(getAzureOpenAIStatus().configured, true);
    const result = await addRecommendationReasons([recommendation], [notRecommended], vector);
    assert.equal(result.source, "azure_openai");
    assert.match(result.recommendations[0].reason, /서교동/);
    assert.equal(result.recommendations[0].score_insights[0].score, 95);
    assert.equal(result.recommendations[0].score_insights[0].level, "normal");
    assert.match(result.recommendations[0].score_insights[0].summary, /^현재 데이터 기준/);
    assert.equal(result.not_recommended[0].score_insights.length, 2);
    assert.doesNotMatch(result.not_recommended[0].score_insights[0].summary, /존재하지 않는/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ENV_KEYS) delete process.env[key];
  }
});

test("Azure OpenAI가 미설정이어도 모든 점수 항목에 규칙 기반 설명을 제공한다", async () => {
  for (const key of ENV_KEYS) delete process.env[key];

  const result = await addRecommendationReasons([recommendation], [notRecommended], vector);

  assert.equal(result.source, "rule_based");
  assert.equal(result.recommendations[0].score_insights.length, 2);
  assert.deepEqual(
    result.recommendations[0].score_insights.map(({ key, score, level }) => ({ key, score, level })),
    [
      { key: "trend_score", score: 95, level: "normal" },
      { key: "access_score", score: 88, level: "normal" },
    ],
  );
});

test("동 상세 진입용 LLM 응답은 종합 리포트와 모든 점수 설명을 함께 반환한다", async () => {
  const originalFetch = globalThis.fetch;
  configureAzure();
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          reason: "현재 데이터 기준, 서교동은 트렌드와 접근성이 함께 강한 지역입니다. 다만 다른 수요 특성도 함께 점검하는 전략이 필요합니다.",
          score_insights: [{
            key: "trend_score",
            summary: "현재 데이터 기준, 트렌드 적합도가 높은 편입니다. 새로운 콘셉트를 받아들일 가능성을 강점으로 볼 수 있습니다.",
            tip: "현재 데이터 기준, 차별화된 콘셉트를 고객에게 명확히 전달해 보세요.",
          }],
        }),
      },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await generateDongReport(recommendation, true, vector);
    assert.equal(result.source, "azure_openai");
    assert.match(result.reason, /서교동/);
    assert.equal(result.score_insights.length, 2);
    assert.equal(result.score_insights[0].score, 95);
    assert.equal(result.score_insights[0].level, "normal");
    assert.match(result.score_insights[0].summary, /새로운 콘셉트/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ENV_KEYS) delete process.env[key];
  }
});

test("Azure 설명이 없는 근거를 언급하면 규칙 기반 설명으로 되돌린다", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  configureAzure();
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          recommendations: ["현재 데이터 기준, 서교동은 높은 매출이 보장됩니다."],
          not_recommended: ["현재 데이터 기준, 염리동은 임대료가 비쌉니다."],
        }),
      },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  console.warn = () => undefined;

  try {
    const result = await addRecommendationReasons([recommendation], [notRecommended], vector);
    assert.equal(result.source, "rule_based");
    assert.doesNotMatch(result.recommendations[0].reason, /매출|임대료/);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    for (const key of ENV_KEYS) delete process.env[key];
  }
});

test("인증·요청 형식 계열 4xx 오류는 재시도하지 않는다", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  configureAzure();
  process.env.AZURE_OPENAI_MAX_RETRIES = "2";
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response("bad request", { status: 400 });
  };
  console.warn = () => undefined;

  try {
    const result = await addRecommendationReasons([recommendation], [notRecommended], vector);
    assert.equal(result.source, "rule_based");
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    for (const key of ENV_KEYS) delete process.env[key];
  }
});
