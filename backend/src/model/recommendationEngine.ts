import clusterSummaryJson from "../data/cluster_summary.json";
import dongScoreTableJson from "../data/dong_score_table.json";
import { makePreferenceVector, makeProfileTypeName } from "../lib/preference";
import { recommendDongs } from "../lib/recommend";
import type {
  Answer,
  ClusterSummary,
  DongScore,
  ModelInfo,
  RecommendationEngineOutput,
} from "../lib/types";

export interface RecommendationEngine {
  readonly info: ModelInfo;
  recommend(answers: Answer[]): Promise<RecommendationEngineOutput>;
  diagnostics(): { record_count: number; cluster_count: number };
}

export class CurrentFeatureScoreEngine implements RecommendationEngine {
  readonly info: ModelInfo = {
    engine_id: "current-feature-score-v1",
    engine_version: "1.0.0",
    engine_kind: "feature-score",
    input_schema_version: "balance-answers-v1",
    output_schema_version: "recommendation-response-v1",
    feature_names: [
      "young_score",
      "middle_senior_score",
      "office_score",
      "local_score",
      "trend_score",
      "access_score",
      "scale_score",
      "low_competition_score",
      "growth_score",
    ],
  };

  private readonly scores = dongScoreTableJson as DongScore[];
  private readonly summaries = clusterSummaryJson as ClusterSummary[];

  async recommend(answers: Answer[]): Promise<RecommendationEngineOutput> {
    const preferenceVector = makePreferenceVector(answers);
    const ranked = recommendDongs(preferenceVector, this.scores);
    return {
      model_info: this.info,
      user_profile: {
        type_name: makeProfileTypeName(preferenceVector),
        preference_vector: preferenceVector,
      },
      recommendations: ranked.recommendations,
      not_recommended: ranked.not_recommended,
      cluster_summary: this.summaries,
    };
  }

  diagnostics(): { record_count: number; cluster_count: number } {
    return { record_count: this.scores.length, cluster_count: this.summaries.length };
  }
}

const currentEngine = new CurrentFeatureScoreEngine();
type EngineFactory = () => RecommendationEngine;
const engineRegistry = new Map<string, EngineFactory>([
  [currentEngine.info.engine_id, () => currentEngine],
]);

export function registerRecommendationEngine(engineId: string, factory: EngineFactory): void {
  if (engineRegistry.has(engineId)) {
    throw new Error(`이미 등록된 추천 엔진입니다: ${engineId}`);
  }
  engineRegistry.set(engineId, factory);
}

export function getRecommendationEngine(): RecommendationEngine {
  const selected = process.env.RECOMMENDATION_ENGINE || currentEngine.info.engine_id;
  const factory = engineRegistry.get(selected);
  if (!factory) {
    throw new Error(
      `지원하지 않는 RECOMMENDATION_ENGINE=${selected}. 최종 모델 엔진을 registry에 등록해야 합니다.`,
    );
  }
  return factory();
}
