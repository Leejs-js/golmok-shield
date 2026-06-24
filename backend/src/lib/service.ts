import { addFallbackReasons } from "./azureOpenAI";
import type { Answer, RecommendationResponse } from "./types";
import {
  getRecommendationEngine,
  type RecommendationEngine,
} from "../model/recommendationEngine";

export async function buildRecommendationResponse(
  answers: Answer[],
  engine: RecommendationEngine = getRecommendationEngine(),
): Promise<RecommendationResponse> {
  const ranked = await engine.recommend(answers);
  const recommendations = addFallbackReasons(ranked.recommendations, true);
  const notRecommended = addFallbackReasons(ranked.not_recommended, false);

  return {
    model_info: ranked.model_info,
    explanation_source: "rule_based",
    user_profile: ranked.user_profile,
    recommendations,
    not_recommended: notRecommended,
    map_data: [
      ...recommendations.map((item) => ({
        dong_nm: item.dong_nm,
        status: "recommended" as const,
        rank: item.rank,
        score: item.total_score,
        cluster_id: item.cluster_id,
      })),
      ...notRecommended.map((item) => ({
        dong_nm: item.dong_nm,
        status: "not_recommended" as const,
        rank: item.rank,
        score: item.total_score,
        cluster_id: item.cluster_id,
      })),
    ],
    cluster_summary: ranked.cluster_summary,
  };
}
