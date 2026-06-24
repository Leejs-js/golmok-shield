"use client";

interface LlmReportBoxProps {
  lines: string[];
  loading: boolean;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className="w-6 h-6 rounded-full bg-[#E8E6E0] shrink-0 animate-skeleton" />
          <div className="flex-1 flex flex-col gap-2">
            <span className="h-[11px] w-full bg-[#E8E6E0] rounded-md animate-skeleton" />
            <span
              className="h-[11px] bg-[#E8E6E0] rounded-md animate-skeleton"
              style={{ width: i === 0 ? "72%" : "60%" }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted text-center mt-1">
        AI가 상권 데이터를 해석하고 있어요…
      </p>
    </div>
  );
}

export default function LlmReportBox({ lines, loading }: LlmReportBoxProps) {
  return (
    <div className="bg-[#F7F8FA] rounded-2xl border border-[#ECECEC] p-5 sm:p-6 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0099DD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
        </svg>
        <span className="text-sm font-extrabold text-navy">AI 상권 리포트</span>
        <span className="text-[11px] text-muted font-semibold">gpt-5.4-mini</span>
      </div>
      {loading ? (
        <Skeleton />
      ) : (
        <div className="flex flex-col gap-3.5">
          {lines.map((text, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-navy text-white shrink-0 flex items-center justify-center text-xs font-extrabold">
                {i + 1}
              </span>
              <p className="flex-1 whitespace-pre-line text-sm leading-relaxed text-[#34454D]">
                {text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
