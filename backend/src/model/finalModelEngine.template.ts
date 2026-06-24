import { makePreferenceVector, makeProfileTypeName } from "../lib/preference";
import type {
  Answer,
  ClusterSummary,
  ModelInfo,
  RankedDong,
  RecommendationEngineOutput,
} from "../lib/types";
import type { RecommendationEngine } from "./recommendationEngine";

/**
 * 최종 모델의 원시 출력이 이 계약으로만 변환되면 내부 피처 이름과 개수는 자유롭다.
 * feature_contributions에는 새 모델이 실제로 사용한 피처의 설명 가능한 기여도만 넣는다.
 */
export type FinalModelPrediction = {
  dong_nm: string;
  total_score: number;
  cluster_id: number;
  cluster_type: string;
  feature_contributions: Record<string, number>;
};

export type FinalModelPredictor = (answers: Answer[]) => Promise<FinalModelPrediction[]>;

export class FinalModelEngineTemplate implements RecommendationEngine {
  readonly info: ModelInfo;

  constructor(
    private readonly predictor: FinalModelPredictor,
    private readonly summaries: ClusterSummary[],
    featureNames: string[],
    private readonly expectedDongCount: number,
  ) {
    this.info = {
      engine_id: "final-model-v1",
      engine_version: "1.0.0",
      engine_kind: "trained-model",
      input_schema_version: "balance-answers-v1",
      output_schema_version: "recommendation-response-v1",
      feature_names: featureNames,
    };
  }

  async recommend(answers: Answer[]): Promise<RecommendationEngineOutput> {
    const predictions = await this.predictor(answers);
    if (predictions.length < 6) throw new Error("최종 모델은 최소 6개 동의 예측을 반환해야 합니다.");
    if (new Set(predictions.map((prediction) => prediction.dong_nm)).size !== predictions.length) {
      throw new Error("최종 모델 출력에 중복 dong_nm이 있습니다.");
    }
    for (const prediction of predictions) {
      if (!prediction.dong_nm || !Number.isFinite(prediction.total_score)) {
        throw new Error("최종 모델 출력의 dong_nm 또는 total_score가 올바르지 않습니다.");
      }
      if (!Object.values(prediction.feature_contributions).every(Number.isFinite)) {
        throw new Error(`${prediction.dong_nm}의 feature_contributions에 유효하지 않은 값이 있습니다.`);
      }
    }

    const sorted = predictions
      .map((prediction) => ({
        ...prediction,
        total_score: Math.max(0, Math.min(100, prediction.total_score)),
      }))
      .sort((a, b) => b.total_score - a.total_score || a.dong_nm.localeCompare(b.dong_nm, "ko"));
    const toRanked = (prediction: FinalModelPrediction, index: number): RankedDong => ({
      rank: index + 1,
      dong_nm: prediction.dong_nm,
      total_score: Math.round(prediction.total_score * 10) / 10,
      cluster_id: prediction.cluster_id,
      cluster_type: prediction.cluster_type,
      score_breakdown: prediction.feature_contributions,
    });
    const preferenceVector = makePreferenceVector(answers);

    return {
      model_info: this.info,
      user_profile: {
        type_name: makeProfileTypeName(preferenceVector),
        preference_vector: preferenceVector,
      },
      recommendations: sorted.slice(0, 3).map(toRanked),
      not_recommended: sorted.slice(-3).reverse().map(toRanked),
      cluster_summary: this.summaries,
    };
  }

  diagnostics(): { record_count: number; cluster_count: number } {
    return { record_count: this.expectedDongCount, cluster_count: this.summaries.length };
  }
}
