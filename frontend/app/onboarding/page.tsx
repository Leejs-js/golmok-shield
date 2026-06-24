"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StepIndicator from "@/components/StepIndicator";

export default function OnboardingPage() {
  const router = useRouter();
  const [card, setCard] = useState(0);

  const goGame = useCallback(() => {
    sessionStorage.setItem("onboardingDone", "true");
    router.push("/game");
  }, [router]);

  const isFirst = card === 0;

  return (
    <div className="min-h-dvh flex flex-col bg-white">
      <SiteHeader />
      <StepIndicator current={0} />
      <div className="flex-1 flex flex-col items-center px-6 py-4">

      <div className="flex items-center justify-center my-auto w-full max-w-[580px]">
        {/* Card */}
        <div
          key={card}
          className="flex-1 flex flex-col bg-[#F7F8FA] rounded-2xl border border-[#ECECEC] p-8 sm:p-10 text-center animate-fade-up min-h-[420px] sm:min-h-[460px]"
        >
          {isFirst ? (
            <>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="h-[140px] sm:h-[160px] flex items-center justify-center mb-5">
                  <img
                    src="/golmok-shield.png"
                    alt="골목 방패"
                    className="h-[120px] sm:h-[152px] w-auto block"
                  />
                </div>
                <h2 className="text-[21px] sm:text-[23px] leading-tight font-extrabold text-[#34454D] mb-3 tracking-tight text-balance">
                  내 창업 스타일에 맞는
                  <br />
                  골목을 찾아드려요
                </h2>
                <p className="text-[14px] sm:text-[14.5px] leading-relaxed text-subtle">
                  마포구 카페 상권 데이터를 AI가 분석해,
                  <br />
                  나에게 <b className="text-navy">Best · Worst 지역</b>을
                  알려드려요.
                </p>
              </div>
              <button
                onClick={() => setCard(1)}
                className="w-full h-12 bg-navy text-white rounded-xl text-[15px] font-bold cursor-pointer border-none hover:bg-navy-hover transition-colors mt-6"
              >
                시작하기
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="flex gap-2.5 justify-center mb-6">
                  <div className="w-[120px] h-[128px] rounded-[14px] bg-[#F0F2F5] border-2 border-[#D8DBE0] shadow-sm flex flex-col items-center justify-center gap-2">
                    <span className="w-[30px] h-[30px] rounded-full bg-navy text-white flex items-center justify-center font-extrabold text-sm">
                      A
                    </span>
                    <span className="text-xs font-bold text-[#274867]">
                      주거 골목
                    </span>
                  </div>
                  <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-navy text-white text-[11px] font-extrabold self-center">
                    VS
                  </div>
                  <div className="w-[120px] h-[128px] rounded-[14px] bg-[#F0F2F5] border-2 border-[#D8DBE0] shadow-sm flex flex-col items-center justify-center gap-2">
                    <span className="w-[30px] h-[30px] rounded-full bg-[#E07A5F] text-white flex items-center justify-center font-extrabold text-sm">
                      B
                    </span>
                    <span className="text-xs font-bold text-[#C0604A]">
                      관광 핫플
                    </span>
                  </div>
                </div>
                <h2 className="text-[21px] sm:text-[23px] leading-tight font-extrabold text-[#34454D] mb-3 tracking-tight">
                  5가지 질문으로 끝나요
                </h2>
                <p className="text-[14px] sm:text-[14.5px] leading-relaxed text-subtle">
                  주거 골목 vs 관광 핫플? 평일 단골 vs 주말 유동인구?
                  <br />
                  <b className="text-navy">선택만 하면</b> AI가 딱 맞는 골목을 찾아드려요.
                </p>
              </div>
              <button
                onClick={goGame}
                className="w-full h-12 bg-navy text-white rounded-xl text-[15px] font-bold cursor-pointer border-none hover:bg-navy-hover transition-colors mt-6"
              >
                게임 시작
              </button>
            </>
          )}
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}
