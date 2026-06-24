"use client";

/* eslint-disable @next/next/no-img-element */

export default function SiteFooter() {
  return (
    <footer className="bg-[#0099DD] text-white px-5 sm:px-10 py-3">
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <img
            src="/golmok-lockup.png"
            alt="골목방패"
            className="h-6 brightness-0 invert"
          />
          <span className="text-white/60 text-xs">AI 기반 상권 분석 서비스</span>
        </div>
        <p className="text-white/50 text-xs">
          &copy; 2026 골목방패 &middot; SeSAC Microsoft AI Engineer 4기 &middot; 1팀
        </p>
      </div>
    </footer>
  );
}
