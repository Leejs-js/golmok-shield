"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import type { Answer, RecommendationResponse } from "@/lib/types";
import { DISTRICTS, dongNameToDistrictId } from "@/lib/districts";
import { isRecommendationResponse, postRecommendation } from "@/lib/api";
import MapPlaceholder from "@/components/MapPlaceholder";
import ErrorCard from "@/components/ErrorCard";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StepIndicator from "@/components/StepIndicator";

interface RankedDong {
  dongId?: string;
  hasDetail: boolean;
  name: string;
  cluster: string;
  score: number;
  rank: number;
  tier: "best" | "worst";
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [worstRevealed, setWorstRevealed] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("worstRevealed") === "true";
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let loaded: RecommendationResponse | null = null;
    const cached = sessionStorage.getItem("recommendation");
    if (cached) {
      try {
        const parsed: unknown = JSON.parse(cached);
        if (isRecommendationResponse(parsed)) loaded = parsed;
      } catch {
        sessionStorage.removeItem("recommendation");
      }
    }

    if (!loaded) {
      const answersRaw = sessionStorage.getItem("answers");
      if (!answersRaw) {
        setError("저장된 답변이 없습니다. 게임을 다시 진행해 주세요.");
        setLoading(false);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(answersRaw);
        if (!isAnswers(parsed)) {
          throw new Error("저장된 답변 형식이 올바르지 않습니다.");
        }
        loaded = await postRecommendation(parsed);
        sessionStorage.setItem("recommendation", JSON.stringify(loaded));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "추천 결과를 불러오지 못했습니다.",
        );
        setLoading(false);
        return;
      }
    }

    setResult(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-navy/20 border-t-navy animate-spin" />
        <p className="text-sm font-bold text-subtle">
          마포구 상권을 분석하고 있어요…
        </p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-dvh flex flex-col bg-white">
        <SiteHeader />
        <StepIndicator current={2} />
        <div className="flex-1 flex items-center justify-center p-6">
          <ErrorCard
            title="추천 결과를 불러오지 못했어요"
            description={error || "추천 결과가 없습니다."}
            actionLabel="다시 시도"
            onAction={() => void load()}
          />
        </div>
        <SiteFooter />
      </div>
    );
  }

  const best3 = result.recommendations.map((item) => toRankedDong(item, "best"));
  const worst3 = result.not_recommended.map((item) => toRankedDong(item, "worst"));

  return (
    <div className="min-h-dvh flex flex-col bg-white">
      <SiteHeader />
      <StepIndicator current={2} />
      <div className="flex-1 px-6 sm:px-12 md:px-16 py-6">
        {/* Title */}
        <div className="text-center my-4 sm:my-5">
          <p className="text-[13px] font-bold text-teal mb-1.5 tracking-wide">
            분석 완료 · {result.user_profile.type_name}
          </p>
          <h2 className="text-[22px] sm:text-[24px] font-extrabold text-[#34454D] tracking-tight">
            당신에게 맞는 골목을 찾았어요
          </h2>
        </div>

        {/* Map */}
        <div className="max-w-[840px] w-full mx-auto">
          <MapPlaceholder
            variant="overview"
            overviewRegions={[...best3, ...worst3].map(({ name, rank, tier }) => ({
              name,
              rank,
              tier,
            }))}
          />
        </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-[840px] w-full mx-auto">
        {/* BEST */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-0.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0099DD"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-sm font-extrabold text-navy">
              추천 지역 TOP 3
            </span>
            <span className="ml-auto text-[10.5px] font-bold text-white bg-navy px-2 py-0.5 rounded-pill">
              BEST
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {best3.map((d) => (
              <DongCard
                key={`best-${d.name}`}
                dong={d}
                onClick={() => d.dongId && router.push(`/market/${d.dongId}`)}
              />
            ))}
          </div>
        </div>

        {/* WORST */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-0.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F05A66"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm font-extrabold text-status-danger">
              비추천 지역 TOP 3
            </span>
            <span className="ml-auto text-[10.5px] font-bold text-white bg-status-danger px-2 py-0.5 rounded-pill">
              WORST
            </span>
          </div>
          <div
            className="relative cursor-pointer"
            onClick={() => {
              if (!worstRevealed) {
                setWorstRevealed(true);
                sessionStorage.setItem("worstRevealed", "true");
              }
            }}
          >
            <div
              className="flex flex-col gap-2.5 transition-all duration-500"
              style={{
                filter: worstRevealed ? "none" : "blur(1.5px)",
                opacity: worstRevealed ? 1 : 0.55,
              }}
            >
              {worst3.map((d) => (
                <DongCard
                  key={`worst-${d.name}`}
                  dong={d}
                  onClick={() =>
                    worstRevealed && d.dongId && router.push(`/market/${d.dongId}`)
                  }
                />
              ))}
            </div>
            {!worstRevealed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                <span className="flex items-center justify-center w-[46px] h-[46px] rounded-full bg-navy shadow-lg">
                  <svg
                    width="23"
                    height="23"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <span className="text-[13px] font-bold text-navy bg-white/95 px-3.5 py-1.5 rounded-pill shadow-md">
                  클릭해서 확인하기
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

        <p className="text-center text-[12.5px] text-muted mt-5">
          마포구 전체 동 중 적합도 <b className="text-navy">상위 3곳</b>과{" "}
          <b className="text-status-danger">하위 3곳</b>을 순위로 보여드려요
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}

function DongCard({
  dong,
  onClick,
}: {
  dong: RankedDong;
  onClick: () => void;
}) {
  const isBest = dong.tier === "best";
  const rankOpacity = dong.rank === 1 ? 1 : dong.rank === 2 ? 0.7 : 0.45;
  const rankBg = isBest
    ? `rgba(0,153,221,${rankOpacity})`
    : `rgba(240,90,102,${rankOpacity})`;
  const barBg = isBest ? "#D9F0FA" : "#FDE8EA";
  const barColor = isBest ? "#0099DD" : "#F05A66";
  const scoreColor = isBest ? "#0099DD" : "#F05A66";

  return (
    <button
      onClick={onClick}
      disabled={!dong.hasDetail}
      title={dong.hasDetail ? undefined : "상세 데이터가 아직 준비되지 않은 지역입니다."}
      className="flex items-center gap-3 w-full bg-[#F7F8FA] border border-[#ECECEC] rounded-2xl px-3.5 py-3 cursor-pointer text-left transition-all duration-150 hover:translate-x-0.5 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-x-0"
    >
      <span
        className="shrink-0 w-[34px] h-[34px] rounded-full text-white flex items-center justify-center text-[15px] font-extrabold"
        style={{ background: rankBg }}
      >
        {dong.rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span className="text-[15px] font-extrabold text-[#34454D]">
            {dong.name}
          </span>
          <span className="text-[11px] text-muted">{dong.cluster}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-[7px] rounded-pill overflow-hidden"
            style={{ background: barBg }}
          >
            <div
              className="h-full rounded-pill"
              style={{ width: `${Math.max(0, Math.min(100, dong.score))}%`, background: barColor }}
            />
          </div>
          <span
            className="text-[13px] font-extrabold"
            style={{ color: scoreColor }}
          >
            {dong.score.toFixed(1)}%
          </span>
        </div>
      </div>
      {dong.hasDetail ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B8C2CC"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : (
        <span className="shrink-0 text-[10px] font-bold text-muted">상세 준비 중</span>
      )}
    </button>
  );
}

function isAnswers(value: unknown): value is Answer[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (answer) =>
        typeof answer === "object" &&
        answer !== null &&
        typeof (answer as Answer).question_id === "string" &&
        typeof (answer as Answer).selected === "string",
    )
  );
}

function toRankedDong(
  item: RecommendationResponse["recommendations"][number],
  tier: "best" | "worst",
): RankedDong {
  const dongId = dongNameToDistrictId(item.dong_nm);
  return {
    dongId,
    hasDetail: Boolean(dongId && DISTRICTS[dongId]),
    name: item.dong_nm,
    cluster: item.cluster_type,
    score: item.total_score,
    rank: item.rank,
    tier,
  };
}
