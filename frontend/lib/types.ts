export type Answer = {
  question_id: string;
  selected: string;
};

export type BalanceGameQuestion = {
  id: string;
  title: string;
  options: Array<{
    id: string;
    label: string;
  }>;
};

export type RankedDongWithReason = {
  rank: number;
  dong_nm: string;
  total_score: number;
  cluster_id: number;
  cluster_type: string;
  reason: string;
  score_breakdown: Record<string, number>;
  score_insights?: ScoreInsight[];
};

export type ScoreInsight = {
  key: string;
  label: string;
  score: number;
  level: "normal" | "caution" | "risk";
  summary: string;
  tip: string;
};

export type RecommendationResponse = {
  model_info: {
    engine_id: string;
    engine_version: string;
    engine_kind: string;
    input_schema_version: string;
    output_schema_version: string;
    feature_names: string[];
  };
  explanation_source: "azure_openai" | "rule_based";
  user_profile: {
    type_name: string;
    preference_vector: Record<string, number>;
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
  cluster_summary: unknown[];
};

export type FeatureStatus = "normal" | "warn" | "danger";

export interface Feature {
  label: string;
  value: string;
  status: FeatureStatus;
  description: string;
  tip?: string;
}

export interface District {
  dongId: string;
  dongName: string;
  score: number;
  clusterId: number;
  clusterLabel: string;
  tier: "best" | "worst";
  lat: number;
  lng: number;
  features: Record<string, Feature>;
  llmLines: string[];
}
