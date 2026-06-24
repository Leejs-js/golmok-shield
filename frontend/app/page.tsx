"use client";

import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-[#ffffff] text-[#111827] flex flex-col">
      {/* HEADER */}
      <SiteHeader />

      {/* HERO */}
      <section className="relative h-[500px] sm:h-[700px] overflow-hidden flex justify-center items-center shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover z-[1]"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-black/60 z-[2]" />

        <div className="relative z-[3] text-center text-white px-5">
          <span className="inline-block px-4 py-1.5 bg-[#0099DD] rounded-pill text-[14px] sm:text-[16px] font-bold text-white mb-5">
            골목을 지키는 방패
          </span>
          <h1 className="text-[36px] sm:text-[56px] md:text-[72px] font-extrabold leading-[1.2] mb-5">
            내 창업 스타일에 맞는
            <br />
            골목을 찾아드립니다
          </h1>
          <p className="text-[16px] sm:text-[20px] md:text-[24px] leading-[1.8] mb-8 sm:mb-10">
            AI 기반 상권 분석으로
            <br />
            최적의 창업 입지를 추천합니다.
          </p>
          <button
            onClick={() => { sessionStorage.removeItem("answers"); sessionStorage.removeItem("recommendation"); sessionStorage.removeItem("onboardingDone"); sessionStorage.removeItem("worstRevealed"); router.push("/onboarding"); }}
            className="px-8 sm:px-10 py-4 sm:py-[18px] border-none rounded-2xl bg-white text-[#0099DD] text-base sm:text-lg font-bold cursor-pointer transition-transform duration-300 hover:-translate-y-1 shadow-lg"
          >
            분석 시작하기
          </button>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-16 sm:py-[100px] px-5 sm:px-10">
        <div className="max-w-[1400px] mx-auto flex justify-center gap-6 sm:gap-10 flex-wrap">
          {[
            {
              title: "상권 데이터 분석",
              desc: "유동인구, 매출,\n경쟁도 데이터를 분석합니다.",
              icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0099DD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12V7H5a2 2 0 010-4h14v4" />
                  <path d="M3 5v14a2 2 0 002 2h16v-5" />
                  <path d="M18 12a2 2 0 000 4h4v-4h-4z" />
                </svg>
              ),
            },
            {
              title: "맞춤 골목 추천",
              desc: "창업 성향에 맞는\n입지를 추천합니다.",
              icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0099DD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              ),
            },
            {
              title: "AI 리포트 제공",
              desc: "분석 결과를\n리포트 형태로 제공합니다.",
              icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0099DD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              ),
            },
          ].map((card) => (
            <div
              key={card.title}
              className="w-full sm:w-[360px] bg-white rounded-3xl p-8 sm:p-10 text-center shadow-[0_10px_25px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)]"
            >
              <div className="w-[80px] sm:w-[100px] h-[80px] sm:h-[100px] mx-auto mb-6 sm:mb-8 bg-[#E8F6FD] rounded-[20px] flex justify-center items-center">
                {card.icon}
              </div>
              <h2 className="text-xl sm:text-[28px] font-bold mb-4 sm:mb-5">
                {card.title}
              </h2>
              <p className="text-base sm:text-lg text-[#6B7280] leading-[1.8] whitespace-pre-line">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  );
}
