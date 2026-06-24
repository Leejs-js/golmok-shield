export const PREFERENCE_DIMENSIONS = [
  "young",
  "middle_senior",
  "office",
  "local",
  "trend",
  "access",
  "scale",
  "low_competition",
  "growth",
] as const;

export type PreferenceDimension = (typeof PREFERENCE_DIMENSIONS)[number];
export type PreferenceVector = Record<PreferenceDimension, number>;

export type Answer = {
  question_id: string;
  selected: string;
};

export type DongScore = {
  dong_nm: string;
  cluster_id: number;
  cluster_type: string;
  young_score: number;
  middle_senior_score: number;
  office_score: number;
  local_score: number;
  trend_score: number;
  access_score: number;
  scale_score: number;
  low_competition_score: number;
  growth_score: number;
};

// 현재 엔진은 9개 점수를 넣지만, 최종 모델의 다른 피처도 API 계약을
// 깨지 않고 전달할 수 있도록 동적 점수 키를 허용한다.
export type ScoreBreakdown = Record<string, number>;

export type RankedDong = {
  rank: number;
  dong_nm: string;
  total_score: number;
  cluster_id: number;
  cluster_type: string;
  score_breakdown: ScoreBreakdown;
};

export type ScoreInsightLevel = "normal" | "caution" | "risk";

export type ScoreInsight = {
  key: string;
  label: string;
  score: number;
  level: ScoreInsightLevel;
  summary: string;
  tip: string;
};

export type RankedDongWithReason = RankedDong & {
  reason: string;
  score_insights: ScoreInsight[];
};

export type ClusterSummary = {
  cluster_id: number;
  cluster_type: string;
  description: string;
  dong_list: string;
  dong_count: number;
};

export type ModelInfo = {
  engine_id: string;
  engine_version: string;
  engine_kind: "feature-score" | "trained-model" | "remote-model";
  input_schema_version: string;
  output_schema_version: string;
  feature_names: string[];
};

export type RecommendationEngineOutput = {
  model_info: ModelInfo;
  user_profile: {
    type_name: string;
    preference_vector: PreferenceVector;
  };
  recommendations: RankedDong[];
  not_recommended: RankedDong[];
  cluster_summary: ClusterSummary[];
};

export type RecommendationResponse = {
  model_info: ModelInfo;
  explanation_source: "azure_openai" | "rule_based";
  user_profile: {
    type_name: string;
    preference_vector: PreferenceVector;
  };
  recommendations: RankedDongWithReason[];
  not_recommended: RankedDongWithReason[];
  map_data: Array<{
    dong_nm: string;
    status: "recommended" | "not_recommended";
    rank: number;
    score: number;
    cluster_id: number;
  }>;
  cluster_summary: ClusterSummary[];
};
