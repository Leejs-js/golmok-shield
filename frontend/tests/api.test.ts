import assert from "node:assert/strict";
import test from "node:test";
import { isBalanceGameQuestions, isRecommendationResponse } from "../lib/api";
import { DISTRICTS, dongNameToDistrictId } from "../lib/districts";

test("백엔드 질문 계약은 두 선택지를 가진 문항 배열을 허용한다", () => {
  const questions = {
    questions: Array.from({ length: 5 }, (_, index) => ({
      id: `question_${index + 1}`,
      title: `질문 ${index + 1}`,
      options: [
        { id: `option_${index + 1}_a`, label: "선택 A" },
        { id: `option_${index + 1}_b`, label: "선택 B" },
      ],
    })),
  };

  assert.equal(isBalanceGameQuestions(questions), true);
  assert.equal(isBalanceGameQuestions({ questions: [] }), false);
  assert.equal(
    isBalanceGameQuestions({
      questions: [{ id: "invalid", title: "선택지가 하나인 질문", options: [] }],
    }),
    false,
  );
});

test("실제 백엔드 추천 응답 구조를 허용한다", () => {
  const ranked = (prefix: string, index: number) => ({
    rank: index + 1,
    dong_nm: `${prefix}${index + 1}동`,
    total_score: 90 - index,
    cluster_id: index,
    cluster_type: "생활권·로컬 상권",
    reason: `현재 데이터 기준, ${prefix}${index + 1}동 설명입니다.`,
    score_breakdown: { young_score: 80 - index },
  });
  const recommendations = Array.from({ length: 3 }, (_, index) => ranked("추천", index));
  const notRecommended = Array.from({ length: 3 }, (_, index) => ranked("비추천", index));
  const response = {
    model_info: {
      engine_id: "feature-score-v1",
      engine_version: "1.0.0",
      engine_kind: "feature-score",
      input_schema_version: "1.0",
      output_schema_version: "1.0",
      feature_names: ["young_score"],
    },
    explanation_source: "rule_based",
    user_profile: { type_name: "로컬형", preference_vector: { young: 0.8 } },
    recommendations,
    not_recommended: notRecommended,
    map_data: [...recommendations, ...notRecommended].map((item, index) => ({
      dong_nm: item.dong_nm,
      status: index < 3 ? "recommended" : "not_recommended",
      rank: item.rank,
      score: item.total_score,
      cluster_id: item.cluster_id,
    })),
    cluster_summary: [],
  };

  assert.equal(isRecommendationResponse(response), true);
  assert.equal(response.recommendations.length, 3);
  assert.equal(response.not_recommended.length, 3);
  assert.equal(response.map_data.length, 6);
  assert.equal("best" in response, false);
  assert.equal("worst" in response, false);
});

test("추천 응답 계약은 필수 배열 개수가 다르면 거부한다", () => {
  assert.equal(
    isRecommendationResponse({
      model_info: {
        engine_id: "test",
        engine_version: "1",
        engine_kind: "feature-score",
        input_schema_version: "1",
        output_schema_version: "1",
        feature_names: [],
      },
      explanation_source: "rule_based",
      user_profile: { type_name: "test", preference_vector: {} },
      recommendations: [],
      not_recommended: [],
      map_data: [],
      cluster_summary: [],
    }),
    false,
  );
});

test("백엔드의 16개 동 이름은 모두 상세 라우트 ID와 상세 데이터를 가진다", () => {
  const dongNames = [
    "공덕동",
    "아현동",
    "도화동",
    "용강동",
    "대흥동",
    "염리동",
    "신수동",
    "서강동",
    "서교동",
    "합정동",
    "망원1동",
    "망원2동",
    "연남동",
    "성산1동",
    "성산2동",
    "상암동",
  ];

  for (const dongName of dongNames) {
    const dongId = dongNameToDistrictId(dongName);

    assert.ok(dongId, `${dongName}의 상세 라우트 ID가 없습니다.`);
    assert.ok(DISTRICTS[dongId], `${dongName}/${dongId} 상세 데이터가 없습니다.`);
    assert.equal(DISTRICTS[dongId].dongName, dongName);
  }

  assert.equal(Object.keys(DISTRICTS).length, 16);
  assert.equal(dongNameToDistrictId("알 수 없는 동"), undefined);
});
