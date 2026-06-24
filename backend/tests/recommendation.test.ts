import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { corsHeaders, isOriginAllowed } from "../src/http/cors";
import {
  getPublicQuestions,
  handleDongReport,
  handleHealth,
  handleRecommendation,
  handleScoreInsight,
} from "../src/http/handlers";
import { makePreferenceVector } from "../src/lib/preference";
import { buildRecommendationResponse } from "../src/lib/service";
import type { Answer, DongScore, RecommendationResponse } from "../src/lib/types";
import { FinalModelEngineTemplate } from "../src/model/finalModelEngine.template";

const sampleAnswers: Answer[] = [
  { question_id: "target_age", selected: "young_customer" },
  { question_id: "demand_type", selected: "office_demand" },
  { question_id: "area_style", selected: "developed_area" },
  { question_id: "competition_style", selected: "verified_demand" },
  { question_id: "business_strategy", selected: "growth_area" },
];

test("취향 벡터는 다섯 문항 벡터의 차원별 평균이다", () => {
  assert.deepEqual(makePreferenceVector(sampleAnswers), {
    young: 0.2,
    middle_senior: 0.02,
    office: 0.2,
    local: 0.12,
    trend: 0.52,
    access: 0.26,
    scale: 0.58,
    low_competition: 0.1,
    growth: 0.32,
  });
});

test("생성 점수에는 16개 행정동이 있고 모든 점수는 0~100이다", () => {
  const filePath = join(__dirname, "..", "src", "data", "dong_score_table.json");
  const table = JSON.parse(readFileSync(filePath, "utf8")) as DongScore[];
  assert.equal(table.length, 16);
  assert.equal(new Set(table.map((dong) => dong.dong_nm)).size, 16);

  for (const dong of table) {
    for (const [key, value] of Object.entries(dong)) {
      if (key.endsWith("_score")) {
        assert.equal(typeof value, "number");
        const numericValue = Number(value);
        assert.ok(numericValue >= 0 && numericValue <= 100, `${dong.dong_nm}/${key}=${value}`);
      }
    }
  }
});

test("추천 핸들러는 추천·비추천·지도 데이터를 반환한다", async () => {
  for (const key of [
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT",
  ]) {
    delete process.env[key];
  }

  const response = await handleRecommendation({ answers: sampleAnswers });
  const body = response.body as RecommendationResponse;
  assert.equal(response.status, 200);
  assert.equal(body.model_info.engine_id, "current-feature-score-v1");
  assert.equal(body.explanation_source, "rule_based");
  assert.equal(body.recommendations.length, 3);
  assert.equal(body.not_recommended.length, 3);
  assert.equal(body.map_data.length, 6);
  assert.equal(body.cluster_summary.length, 4);
  assert.ok(body.recommendations.every((item) => item.reason.includes("현재 데이터 기준")));
});

test("추천 API는 Azure OpenAI를 기다리지 않고 규칙 기반 설명을 즉시 반환한다", async () => {
  const originalFetch = globalThis.fetch;
  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    throw new Error("추천 API에서 Azure를 호출하면 안 됩니다.");
  };

  try {
    const response = await handleRecommendation({ answers: sampleAnswers });
    assert.equal(response.status, 200);
    assert.equal((response.body as RecommendationResponse).explanation_source, "rule_based");
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
  }
});

test("점수 탭 설명 API는 요청한 한 항목만 반환한다", async () => {
  const recommendationResponse = await handleRecommendation({ answers: sampleAnswers });
  const item = (recommendationResponse.body as RecommendationResponse).recommendations[0];
  const key = Object.keys(item.score_breakdown)[0];

  const response = await handleScoreInsight({ item, key, recommended: true });
  const body = response.body as { source: string; insight: { key: string; score: number } };

  assert.equal(response.status, 200);
  assert.equal(body.source, "rule_based");
  assert.equal(body.insight.key, key);
  assert.equal(body.insight.score, item.score_breakdown[key]);
});

test("동 상세 리포트 API는 종합 설명과 모든 점수 항목을 반환한다", async () => {
  const recommendationResponse = await handleRecommendation({ answers: sampleAnswers });
  const recommendationBody = recommendationResponse.body as RecommendationResponse;
  const item = recommendationBody.recommendations[0];

  const response = await handleDongReport({
    item,
    recommended: true,
    preference_vector: recommendationBody.user_profile.preference_vector,
  });
  const body = response.body as {
    source: string;
    reason: string;
    score_insights: Array<{ key: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.source, "rule_based");
  assert.match(body.reason, new RegExp(item.dong_nm));
  assert.deepEqual(
    body.score_insights.map(({ key }) => key),
    Object.keys(item.score_breakdown),
  );
});

test("질문 API 데이터에는 프론트 표시 계약만 있고 추천 벡터는 없다", () => {
  const body = getPublicQuestions() as {
    questions: Array<{ options: Array<Record<string, unknown>> }>;
  };
  assert.equal(body.questions.length, 5);
  assert.ok(body.questions.every((question) => question.options.length === 2));
  assert.ok(body.questions.every((question) =>
    question.options.every((option) => !("vector" in option)),
  ));
});

test("누락·중복·알 수 없는 선택지는 400으로 거부한다", async () => {
  const invalidCases = [
    sampleAnswers.slice(0, 1),
    [...sampleAnswers, sampleAnswers[0]],
    sampleAnswers.map((answer, index) =>
      index === 0 ? { ...answer, selected: "unknown_option" } : answer,
    ),
  ];
  for (const answers of invalidCases) {
    const response = await handleRecommendation({ answers });
    assert.equal(response.status, 400);
  }
});

test("health는 엔진 상태를 반환하고 비밀값을 노출하지 않는다", () => {
  const response = handleHealth();
  const body = response.body as {
    status: string;
    data: { record_count: number };
    azure_openai: { configured: boolean; api_key?: string };
  };
  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.data.record_count, 16);
  assert.equal("api_key" in body.azure_openai, false);
});

test("CORS는 로컬·설정 origin과 Azure Static Web Apps 배포 origin을 허용한다", () => {
  process.env.CORS_ALLOWED_ORIGINS =
    "http://localhost:3000,https://happy-bay-088ed8800.7.azurestaticapps.net";

  assert.equal(isOriginAllowed("http://localhost:3000"), true);
  assert.equal(
    isOriginAllowed("https://happy-bay-088ed8800.7.azurestaticapps.net"),
    true,
  );

  assert.equal(isOriginAllowed("https://evil.example"), false);

  assert.equal(
    isOriginAllowed("https://unknown-bay-000000000.7.azurestaticapps.net"),
    true,
  );

  assert.equal(isOriginAllowed("http://unknown-bay-000000000.7.azurestaticapps.net"), false);
  assert.equal(isOriginAllowed("https://azurestaticapps.net.evil.example"), false);

  // 환경변수가 있어도 기본 프로덕션 origin과 로컬 개발 origin을 제거하지 않는다.
  assert.equal(isOriginAllowed("https://mango-bay-08358bc00.7.azurestaticapps.net"), true);
  assert.equal(isOriginAllowed("http://127.0.0.1:3000"), true);

  assert.equal(
    corsHeaders("https://happy-bay-088ed8800.7.azurestaticapps.net")[
      "Access-Control-Allow-Origin"
    ],
    "https://happy-bay-088ed8800.7.azurestaticapps.net",
  );

  assert.equal(
    corsHeaders("https://unknown-bay-000000000.7.azurestaticapps.net")[
      "Access-Control-Allow-Origin"
    ],
    "https://unknown-bay-000000000.7.azurestaticapps.net",
  );

  delete process.env.CORS_ALLOWED_ORIGINS;
});

test("다른 피처의 최종 모델도 RecommendationEngine 계약으로 교체할 수 있다", async () => {
  const predictions = Array.from({ length: 6 }, (_, index) => ({
    dong_nm: `새모델${index + 1}동`,
    total_score: 90 - index * 10,
    cluster_id: index % 2,
    cluster_type: "최종 모델 군집",
    feature_contributions: { future_feature_score: 100 - index },
  }));
  const engine = new FinalModelEngineTemplate(
    async () => predictions,
    [],
    ["future_feature_score"],
    6,
  );
  const result = await buildRecommendationResponse(sampleAnswers, engine);

  assert.equal(result.model_info.engine_id, "final-model-v1");
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.not_recommended.length, 3);
  assert.equal(result.recommendations[0].score_breakdown.future_feature_score, 100);
});
