import {
  PREFERENCE_DIMENSIONS,
  type DongScore,
  type PreferenceDimension,
  type PreferenceVector,
  type RankedDong,
  type ScoreBreakdown,
} from "./types";

type DongScoreKey = Exclude<keyof DongScore, "dong_nm" | "cluster_id" | "cluster_type">;
type Vector = Record<PreferenceDimension, number>;

type IdealProfile = {
  target: Vector;
  importance: Vector;
};

type ScoredDong = {
  dong: DongScore;
  totalScore: number;
  dongFitScore: number;
  clusterFitScore: number;
};

const SCORE_KEY: Record<PreferenceDimension, DongScoreKey> = {
  young: "young_score",
  middle_senior: "middle_senior_score",
  office: "office_score",
  local: "local_score",
  trend: "trend_score",
  access: "access_score",
  scale: "scale_score",
  low_competition: "low_competition_score",
  growth: "growth_score",
};

/**
 * 최종 점수 구성 비율
 *
 * 1. 동별 적합도 85%
 *    - 실제 행정동의 9개 점수와 사용자 이상 벡터의 거리
 *
 * 2. 군집 적합도 15%
 *    - 해당 동이 속한 cluster 평균 성향과 사용자 이상 벡터의 거리
 *
 * 클러스터링 결과는 추천을 지배하지 않고,
 * 상권 유형 일관성을 보정하는 역할만 한다.
 */
const DONG_FIT_WEIGHT = 0.85;
const CLUSTER_FIT_WEIGHT = 0.15;

/**
 * Top3가 모두 같은 cluster일 때,
 * 다른 cluster 후보가 3위와 이 점수 차이 이내면 교체한다.
 *
 * 너무 강제적으로 다양성을 넣지 않기 위해
 * 점수 차이가 작은 경우에만 보정한다.
 */
const DIVERSITY_REPLACEMENT_MARGIN = 3;

/**
 * 사용자 선호축 중 아주 약한 축도 완전히 무시하지 않기 위한 최소 중요도.
 *
 * 값이 너무 낮으면 특정 축만 보고,
 * 값이 너무 높으면 설문 선택 차이가 약해진다.
 */
const MIN_IMPORTANCE = 0.25;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const clamp01 = (value: number): number => clamp(value, 0, 1);

const emptyVector = (initialValue = 0): Vector =>
  Object.fromEntries(PREFERENCE_DIMENSIONS.map((dimension) => [dimension, initialValue])) as Vector;

const scoreBreakdown = (dong: DongScore): ScoreBreakdown => ({
  young_score: dong.young_score,
  middle_senior_score: dong.middle_senior_score,
  office_score: dong.office_score,
  local_score: dong.local_score,
  trend_score: dong.trend_score,
  access_score: dong.access_score,
  scale_score: dong.scale_score,
  low_competition_score: dong.low_competition_score,
  growth_score: dong.growth_score,
});

/**
 * 동별 0~100 점수를 0~1 벡터로 변환한다.
 */
function dongToVector(dong: DongScore): Vector {
  const vector = emptyVector();

  for (const dimension of PREFERENCE_DIMENSIONS) {
    const score = dong[SCORE_KEY[dimension]];
    vector[dimension] = clamp01(score / 100);
  }

  return vector;
}

/**
 * 기존 PreferenceVector는 "선택지 vector 평균값"이다.
 *
 * 이 값은 그대로 거리 계산 목표값으로 쓰기에는 약할 수 있다.
 * 예를 들어 5문항 평균이므로 가장 강한 축도 0.2~0.6 근처에 머무를 수 있다.
 *
 * 그래서 사용자 벡터 내부에서 min-max 정규화를 다시 적용해:
 *
 * - 사용자가 상대적으로 강하게 선택한 축 → target 1에 가까움
 * - 사용자가 거의 선택하지 않은 축 → target 0에 가까움
 * - 중간 성향 → target 0.5 근처
 *
 * 로 변환한다.
 *
 * importance는 target이 0 또는 1에 가까울수록 커진다.
 * 즉 "강하게 원함"과 "강하게 원하지 않음"을 모두 반영한다.
 */
function buildIdealProfile(userVector: PreferenceVector): IdealProfile {
  const rawValues = PREFERENCE_DIMENSIONS.map((dimension) => {
    const value = userVector[dimension];
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });

  const minValue = Math.min(...rawValues);
  const maxValue = Math.max(...rawValues);
  const range = maxValue - minValue;

  const target = emptyVector(0.5);
  const importance = emptyVector(MIN_IMPORTANCE);

  if (maxValue <= 0 || range <= 1e-9) {
    return { target, importance };
  }

  for (const dimension of PREFERENCE_DIMENSIONS) {
    const rawValue = Math.max(0, userVector[dimension] ?? 0);
    const normalizedTarget = clamp01((rawValue - minValue) / range);

    target[dimension] = normalizedTarget;

    /**
     * target이 0.5에서 멀수록 중요도가 높다.
     *
     * target 1.0 → 강하게 원하는 축
     * target 0.0 → 강하게 원하지 않는 축
     * target 0.5 → 중립에 가까운 축
     */
    importance[dimension] = clamp(
      MIN_IMPORTANCE + Math.abs(normalizedTarget - 0.5) * 1.5,
      MIN_IMPORTANCE,
      1,
    );
  }

  return { target, importance };
}

/**
 * 사용자 이상 벡터와 후보 벡터 사이의 Weighted Euclidean Distance를 계산한다.
 *
 * 거리 0에 가까움:
 * - 사용자가 원하는 성향과 동의 실제 점수가 거의 일치
 *
 * 거리 1에 가까움:
 * - 사용자가 원하는 성향과 동의 실제 점수가 많이 다름
 *
 * 최종 fit score는 100 * (1 - distance)로 변환한다.
 */
function calculateVectorFitScore(profile: IdealProfile, candidate: Vector): number {
  let weightedSquaredDistance = 0;
  let weightSum = 0;

  for (const dimension of PREFERENCE_DIMENSIONS) {
    const weight = profile.importance[dimension];

    if (!Number.isFinite(weight) || weight <= 0) continue;

    const diff = candidate[dimension] - profile.target[dimension];
    weightedSquaredDistance += weight * diff * diff;
    weightSum += weight;
  }

  if (weightSum <= 0) return 0;

  const distance = Math.sqrt(weightedSquaredDistance / weightSum);
  const fitScore = 100 * (1 - distance);

  return clamp(fitScore, 0, 100);
}

/**
 * cluster별 평균 점수 벡터를 계산한다.
 *
 * 각 동의 cluster_id를 기준으로 묶고,
 * 해당 cluster 안에 있는 동들의 9개 점수 평균을 구한다.
 */
function buildClusterCentroids(dongScoreTable: DongScore[]): Map<number, Vector> {
  const clusterMap = new Map<number, { sum: Vector; count: number }>();

  for (const dong of dongScoreTable) {
    const dongVector = dongToVector(dong);
    const current = clusterMap.get(dong.cluster_id) ?? {
      sum: emptyVector(),
      count: 0,
    };

    for (const dimension of PREFERENCE_DIMENSIONS) {
      current.sum[dimension] += dongVector[dimension];
    }

    current.count += 1;
    clusterMap.set(dong.cluster_id, current);
  }

  const centroids = new Map<number, Vector>();

  for (const [clusterId, item] of clusterMap.entries()) {
    const centroid = emptyVector();

    for (const dimension of PREFERENCE_DIMENSIONS) {
      centroid[dimension] = item.count > 0 ? item.sum[dimension] / item.count : 0;
    }

    centroids.set(clusterId, centroid);
  }

  return centroids;
}

/**
 * 단일 동의 최종 적합도 계산.
 *
 * 외부에서 테스트가 깨지지 않도록 기존 함수명은 유지한다.
 * 단, 이제는 단순 가중합이 아니라 거리 기반 적합도이다.
 */
export function calculateFitScore(userVector: PreferenceVector, dong: DongScore): number {
  const profile = buildIdealProfile(userVector);
  const dongFitScore = calculateVectorFitScore(profile, dongToVector(dong));

  return round1(dongFitScore);
}

function calculateTotalScore(
  profile: IdealProfile,
  dong: DongScore,
  clusterCentroids: Map<number, Vector>,
): ScoredDong {
  const dongFitScore = calculateVectorFitScore(profile, dongToVector(dong));
  const clusterVector = clusterCentroids.get(dong.cluster_id);

  const clusterFitScore = clusterVector
    ? calculateVectorFitScore(profile, clusterVector)
    : dongFitScore;

  const totalScore =
    DONG_FIT_WEIGHT * dongFitScore +
    CLUSTER_FIT_WEIGHT * clusterFitScore;

  return {
    dong,
    totalScore: round1(clamp(totalScore, 0, 100)),
    dongFitScore: round1(dongFitScore),
    clusterFitScore: round1(clusterFitScore),
  };
}

function sortByScoreDesc(a: ScoredDong, b: ScoredDong): number {
  return b.totalScore - a.totalScore || a.dong.dong_nm.localeCompare(b.dong.dong_nm, "ko");
}

/**
 * Top3가 같은 cluster로만 묶이는 경우,
 * 점수 차이가 작은 범위 안에서 다른 cluster 후보를 하나 포함한다.
 *
 * 추천 다양성은 "무조건" 넣지 않고,
 * 3위와 점수 차이가 DIVERSITY_REPLACEMENT_MARGIN 이하일 때만 적용한다.
 */
function applyConditionalClusterDiversity(scored: ScoredDong[]): ScoredDong[] {
  const top3 = scored.slice(0, 3);

  if (top3.length < 3) return top3;

  const clusterIds = new Set(top3.map((item) => item.dong.cluster_id));

  if (clusterIds.size > 1) {
    return top3;
  }

  const dominantClusterId = top3[0].dong.cluster_id;
  const thirdScore = top3[2].totalScore;

  const replacement = scored.find((item) => {
    const alreadySelected = top3.some((selected) => selected.dong.dong_nm === item.dong.dong_nm);
    return !alreadySelected && item.dong.cluster_id !== dominantClusterId;
  });

  if (!replacement) {
    return top3;
  }

  const isCloseEnough = replacement.totalScore >= thirdScore - DIVERSITY_REPLACEMENT_MARGIN;

  if (!isCloseEnough) {
    return top3;
  }

  return [top3[0], top3[1], replacement].sort(sortByScoreDesc);
}

function toRanked(item: ScoredDong, index: number): RankedDong {
  return {
    rank: index + 1,
    dong_nm: item.dong.dong_nm,
    total_score: item.totalScore,
    cluster_id: item.dong.cluster_id,
    cluster_type: item.dong.cluster_type,
    score_breakdown: scoreBreakdown(item.dong),
  };
}

export function recommendDongs(
  userVector: PreferenceVector,
  dongScoreTable: DongScore[],
): { recommendations: RankedDong[]; not_recommended: RankedDong[] } {
  const profile = buildIdealProfile(userVector);
  const clusterCentroids = buildClusterCentroids(dongScoreTable);

  const scored = dongScoreTable
    .map((dong) => calculateTotalScore(profile, dong, clusterCentroids))
    .sort(sortByScoreDesc);

  const diversifiedTop3 = applyConditionalClusterDiversity(scored);

  const recommendations = diversifiedTop3.map(toRanked);

  const notRecommended = scored
    .slice(-3)
    .reverse()
    .map(toRanked);

  return {
    recommendations,
    not_recommended: notRecommended,
  };
}