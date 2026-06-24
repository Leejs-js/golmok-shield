"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { DISTRICTS, FEATURE_IDS } from "@/lib/districts";
import { isRecommendationResponse, postDongReport } from "@/lib/api";
import type {
  Feature,
  FeatureStatus,
  RankedDongWithReason,
  RecommendationResponse,
} from "@/lib/types";
import { STATUS_LABELS } from "@/lib/colors";
import LlmReportBox from "@/components/LlmReportBox";
import MapPlaceholder from "@/components/MapPlaceholder";
import ErrorCard from "@/components/ErrorCard";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StepIndicator from "@/components/StepIndicator";

type RankedDetail = {
  ranked: RankedDongWithReason;
  tier: "best" | "worst";
  preferenceVector: Record<string, number>;
};

type DisplayDetail = {
  score: number;
  clusterId: number;
  clusterLabel: string;
  tier: "best" | "worst";
  llmLines: string[];
  features: Record<string, Feature>;
  featureIds: string[];
  sourceLabel: string;
};

const SCORE_FEATURE_ORDER = [
  "young_score",
  "middle_senior_score",
  "office_score",
  "local_score",
  "trend_score",
  "access_score",
  "scale_score",
  "low_competition_score",
  "growth_score",
];

const SCORE_FEATURE_LABELS: Record<string, string> = {
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

export default function ReportClient() {
  const router = useRouter();
  const params = useParams();
  const dongId = params.dongId as string;
  const district = DISTRICTS[dongId];

  const [rankedDetail, setRankedDetail] = useState<RankedDetail | null>(null);
  const [recommendationChecked, setRecommendationChecked] = useState(false);
  const [activeFeature, setActiveFeature] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const requestedReport = useRef<string | null>(null);

  useEffect(() => {
    if (!district) return;

    const cached = sessionStorage.getItem("recommendation");

    if (!cached) {
      setRankedDetail(null);
      setRecommendationChecked(true);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(cached);

      if (isRecommendationResponse(parsed)) {
        const detail = findRankedDetail(parsed, district.dongName);
        setRankedDetail(detail);
        setReportLoading(Boolean(detail));
      } else {
        setRankedDetail(null);
      }
    } catch {
      setRankedDetail(null);
    } finally {
      setRecommendationChecked(true);
    }
  }, [district]);

  useEffect(() => {
    if (!rankedDetail || requestedReport.current === rankedDetail.ranked.dong_nm) return;
    requestedReport.current = rankedDetail.ranked.dong_nm;
    let cancelled = false;

    void postDongReport(
      rankedDetail.ranked,
      rankedDetail.tier === "best",
      rankedDetail.preferenceVector,
    ).then((result) => {
      if (cancelled) return;
      setRankedDetail((current) => current ? {
        ...current,
        ranked: {
          ...current.ranked,
          reason: result.reason,
          score_insights: result.score_insights,
        },
      } : current);
    }).catch((error) => {
      console.warn("상권 리포트를 불러오지 못해 기본 설명을 유지합니다.", error);
    }).finally(() => {
      if (!cancelled) setReportLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [rankedDetail]);

  const displayDetail = useMemo<DisplayDetail | null>(() => {
    if (!district) return null;

    if (rankedDetail) {
      const scoreFeatures = createScoreFeatures(
        rankedDetail.ranked.score_breakdown,
        rankedDetail.ranked.score_insights,
      );
      const scoreFeatureIds = Object.keys(scoreFeatures);

      return {
        score: rankedDetail.ranked.total_score,
        clusterId: rankedDetail.ranked.cluster_id,
        clusterLabel: rankedDetail.ranked.cluster_type,
        tier: rankedDetail.tier,
        llmLines: [rankedDetail.ranked.reason],
        features: scoreFeatureIds.length > 0 ? scoreFeatures : district.features,
        featureIds: scoreFeatureIds.length > 0 ? scoreFeatureIds : FEATURE_IDS,
        sourceLabel: "추천 결과 기반",
      };
    }

    return {
      score: district.score,
      clusterId: district.clusterId,
      clusterLabel: district.clusterLabel,
      tier: district.tier,
      llmLines: district.llmLines,
      features: district.features,
      featureIds: FEATURE_IDS,
      sourceLabel: "기본 상세 정보",
    };
  }, [district, rankedDetail]);

  const toggleFeature = useCallback((id: string) => {
    setActiveFeature((prev) => (prev === id ? "" : id));
  }, []);

  useEffect(() => {
    if (displayDetail && !activeFeature) {
      const sorted = sortedFeatureIds(displayDetail.features, displayDetail.featureIds);
      if (sorted.length > 0) setActiveFeature(sorted[0]);
    }
  }, [displayDetail, activeFeature]);

  if (!district || !displayDetail) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white p-6">
        <ErrorCard
          title="데이터 없음"
          description="해당 동의 데이터를 찾을 수 없습니다."
          actionLabel="결과로 돌아가기"
          onAction={() => router.push("/result")}
        />
      </div>
    );
  }

  const isBest = displayDetail.tier === "best";
  const accentColor = isBest ? "#0099DD" : "#F05A66";
  const scoreBg = isBest ? "#0099DD" : "#F05A66";
  const selectedFeature = activeFeature;

  return (
    <div className="min-h-dvh flex flex-col bg-white">
      <SiteHeader />
      <StepIndicator current={3} />

      <div className="flex-1 overflow-y-auto px-6 sm:px-13 md:px-16 py-6 max-w-[900px] mx-auto w-full">
        {/* Sub Header */}
        <div className="mb-4">
          <button
            onClick={() => router.push("/result")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F7F8FA] border border-[#E4E2DC] rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md mb-6"
            aria-label="결과 페이지로 돌아가기"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6B6B66"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-[13px] font-bold text-[#6B6B66]">분석결과로</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[17px] font-extrabold text-[#34454D]">
              {district.dongName}
            </span>

            <span
              className="text-xs font-bold text-white px-2.5 py-0.5 rounded-pill"
              style={{ background: scoreBg }}
            >
              적합도 {formatScore(displayDetail.score)}%
            </span>

            <span className="text-[12.5px] text-muted">
              {displayDetail.clusterLabel}
            </span>
          </div>
        </div>

        <div className="mb-2 relative inline-block group">
          <span className="text-[11.5px] font-bold text-muted cursor-help border-b border-dashed border-[#B0B0B0]">
            {displayDetail.sourceLabel}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#B0B0B0"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="inline-block ml-1 -mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute left-0 top-full mt-1.5 z-20 w-[380px] bg-white border border-[#E4E2DC] rounded-xl shadow-lg p-4">
            <p className="text-[13px] font-extrabold text-[#34454D] mb-2">추천 기준 안내</p>
            <div className="text-[12px] leading-[1.7] text-[#34454D] space-y-1.5">
              <p>골목방패는 사용자의 밸런스게임 답변을 바탕으로 마포구 행정동별 상권 데이터를 비교해 추천 지역을 계산합니다.</p>
              <p>사용자의 답변은 청년층 수요, 생활권 수요, 업무 수요, 접근성, 상권 규모, 경쟁 부담, 성장 가능성 등 <b>9개 기준</b>으로 변환됩니다.</p>
              <p>각 행정동도 같은 9개 기준으로 점수화되어 있으며, 사용자의 선호와 동별 상권 점수가 가까울수록 높은 추천 점수를 받습니다.</p>
              <p>추천 결과는 다음 기준으로 계산됩니다.</p>
              <p className="font-bold pl-2">최종 점수 = 동별 적합도 85% + 상권 유형 적합도 15%</p>
              <p>여기서 상권 유형은 사전에 K-Means 군집화로 분류한 결과를 사용합니다.</p>
              <p>추천 TOP 3는 사용자 성향과 가장 가까운 지역이고, 비추천 TOP 3는 나쁜 지역이 아니라 현재 선택 기준과 가장 덜 맞는 지역입니다.</p>
            </div>
            <p className="text-[11px] text-muted mt-2">본 결과는 공개 상권 데이터를 기반으로 한 참고용 분석이며, 실제 창업 성공을 보장하지 않습니다.</p>
          </div>
        </div>

        {/* LLM Report */}
        <LlmReportBox
          lines={displayDetail.llmLines}
          loading={!recommendationChecked || reportLoading}
        />

        {/* Map */}
        <MapPlaceholder
          dongName={district.dongName}
          variant="detail"
          accentColor={accentColor}
        />

        {/* ── 상세 지표 ── */}
        <div className="mt-2 bg-[#F7F8FA] rounded-2xl border border-[#ECECEC] shadow-md p-5 sm:p-6">
          <h3 className="text-[18px] font-extrabold text-[#34454D] tracking-tight mb-3.5">
            상세 지표
          </h3>

          {/* 요약 바 */}
          <MetricsSummaryBar features={displayDetail.features} featureIds={displayDetail.featureIds} />

          {/* 리스트 */}
          <div className="flex flex-col">
            {sortedFeatureIds(displayDetail.features, displayDetail.featureIds).map((id) => {
              const feature = displayDetail.features[id];
              if (!feature) return null;
              const isOpen = selectedFeature === id;
              const statusColor = WANTED_STATUS_COLORS[feature.status] ?? "#00BF40";
              const statusText = STATUS_LABELS[feature.status];
              const scoreNum = parseFloat(feature.value);

              return (
                <div key={id} className="border-t border-[#E4E2DC]/60">
                  {/* Row */}
                  <div
                    onClick={() => toggleFeature(id)}
                    className="flex items-center gap-3.5 py-4 px-2 cursor-pointer rounded-lg transition-all duration-150 hover:bg-[#D5D5D5]/40"
                  >
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full shadow-sm"
                      style={{ background: statusColor }}
                    />
                    <span className="flex-1 text-[15px] font-extrabold text-[#34454D]">
                      {feature.label}
                    </span>
                    <span
                      className="text-[12px] font-bold"
                      style={{ color: statusColor }}
                    >
                      {statusText}
                    </span>
                    <span className="w-[54px] text-right text-[16px] font-extrabold text-[#34454D]">
                      {scoreNum.toFixed(1)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9A9A94"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 transition-transform duration-200"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="pb-5 pl-8 pr-2 animate-fade-up">
                      <p className="text-[14.5px] leading-[1.75] text-[#34454D] mb-3.5">
                        {feature.description}
                      </p>
                      {feature.tip && (
                        <div className="flex gap-2.5 bg-white/80 border border-[#E4E2DC] rounded-xl p-3.5 shadow-sm">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#3366FF"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="shrink-0 mt-0.5"
                          >
                            <path d="M9 18h6" />
                            <path d="M10 22h4" />
                            <path d="M12 2a7 7 0 015 11.9V17a1 1 0 01-1 1H8a1 1 0 01-1-1v-3.1A7 7 0 0112 2z" />
                          </svg>
                          <div>
                            <span className="text-[11.5px] font-extrabold text-[#3366FF] tracking-wide">TIP</span>
                            <p className="text-[13px] leading-[1.65] text-muted mt-0.5">{feature.tip}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function findRankedDetail(
  result: RecommendationResponse,
  dongName: string,
): RankedDetail | null {
  const recommended = result.recommendations.find(
    (item) => item.dong_nm === dongName,
  );

  if (recommended) {
    return {
      ranked: recommended,
      tier: "best",
      preferenceVector: result.user_profile.preference_vector,
    };
  }

  const notRecommended = result.not_recommended.find(
    (item) => item.dong_nm === dongName,
  );

  if (notRecommended) {
    return {
      ranked: notRecommended,
      tier: "worst",
      preferenceVector: result.user_profile.preference_vector,
    };
  }

  return null;
}

function createScoreFeatures(
  scoreBreakdown: Record<string, number>,
  scoreInsights: RankedDongWithReason["score_insights"],
): Record<string, Feature> {
  const orderedKeys = [
    ...SCORE_FEATURE_ORDER.filter((key) => key in scoreBreakdown),
    ...Object.keys(scoreBreakdown).filter(
      (key) => !SCORE_FEATURE_ORDER.includes(key),
    ),
  ];

  return Object.fromEntries(
    orderedKeys.map((key) => {
      const score = scoreBreakdown[key];
      const insight = scoreInsights?.find((candidate) => candidate.key === key);
      const label = insight?.label ?? SCORE_FEATURE_LABELS[key] ?? humanizeScoreKey(key);

      return [
        key,
        {
          label,
          value: `${formatScore(score)}점`,
          status: insight ? insightLevelToStatus(insight.level) : scoreToStatus(score),
          description: insight?.summary ?? `현재 추천 모델에서 ${label}은 ${formatScore(score)}점으로 계산되었습니다.`,
          tip: insight?.tip,
        },
      ];
    }),
  );
}

function scoreToStatus(score: number): FeatureStatus {
  if (score >= 70) return "normal";
  if (score >= 40) return "warn";
  return "danger";
}

function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "0.0";
  return score.toFixed(1);
}

function humanizeScoreKey(key: string): string {
  return key
    .replace(/_score$/, "")
    .replace(/_/g, " ")
    .trim();
}

function insightLevelToStatus(level: "normal" | "caution" | "risk"): FeatureStatus {
  if (level === "normal") return "normal";
  if (level === "caution") return "warn";
  return "danger";
}

const WANTED_STATUS_COLORS: Record<FeatureStatus, string> = {
  danger: "#F05A66",
  warn: "#F2A53C",
  normal: "#11B584",
};

const STATUS_RANK: Record<FeatureStatus, number> = { danger: 0, warn: 1, normal: 2 };

function sortedFeatureIds(
  features: Record<string, Feature>,
  ids: string[],
): string[] {
  return [...ids].sort((a, b) => {
    const fa = features[a];
    const fb = features[b];
    if (!fa || !fb) return 0;
    const rankDiff = STATUS_RANK[fa.status] - STATUS_RANK[fb.status];
    if (rankDiff !== 0) return rankDiff;
    return parseFloat(fa.value) - parseFloat(fb.value);
  });
}

function MetricsSummaryBar({
  features,
  featureIds,
}: {
  features: Record<string, Feature>;
  featureIds: string[];
}) {
  let danger = 0;
  let warn = 0;
  let normal = 0;
  for (const id of featureIds) {
    const f = features[id];
    if (!f) continue;
    if (f.status === "danger") danger++;
    else if (f.status === "warn") warn++;
    else normal++;
  }

  const blocks = [
    { count: danger, label: "위험 · 우선 점검", color: "#F05A66", bg: "rgba(240,90,102,.07)" },
    { count: warn, label: "주의 · 보완 권장", color: "#F2A53C", bg: "rgba(242,165,60,.08)" },
    { count: normal, label: "정상 · 강점", color: "#11B584", bg: "rgba(17,181,132,.08)" },
  ];

  return (
    <div className="flex gap-2.5 mb-5">
      {blocks.map((b) => (
        <div
          key={b.label}
          className="flex-1 rounded-xl p-3.5 border shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
          style={{ background: b.bg, borderColor: `${b.color}20` }}
        >
          <div className="text-[20px] font-extrabold" style={{ color: b.color }}>
            {b.count}<span className="text-[13px]">개</span>
          </div>
          <div className="text-[12px] font-bold text-muted mt-0.5">
            {b.label}
          </div>
        </div>
      ))}
    </div>
  );
}
