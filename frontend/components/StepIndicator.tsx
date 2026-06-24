"use client";

import { useRouter } from "next/navigation";

const STEPS = [
  { label: "시작하기", path: "/onboarding" },
  { label: "게임", path: "/game" },
  { label: "분석결과", path: "/result" },
  { label: "상세페이지", path: null },
];

export default function StepIndicator({ current }: { current: number }) {
  const router = useRouter();

  return (
    <div className="flex justify-center px-6 pt-5 pb-3 bg-white">
      <div className="flex items-center w-full max-w-[580px]">
        {STEPS.map((step, i) => {
          const isDone = i < current;
          const isActive = i === current;
          const canClick = isDone && step.path !== null;

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && router.push(step.path!)}
                className={`flex flex-col items-center gap-1 bg-transparent border-none p-0 transition-transform duration-200 ${canClick ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"}`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold transition-all duration-300 ${canClick ? "hover:shadow-md hover:ring-2 hover:ring-navy/20" : ""}`}
                  style={{
                    background: isActive ? "#0099DD" : isDone ? "#0099DD" : "#EAEAEA",
                    color: isActive || isDone ? "#fff" : "#B0B0B0",
                    transform: isActive ? "scale(1.12)" : "scale(1)",
                    boxShadow: isActive ? "0 3px 10px rgba(0,153,221,0.3)" : "none",
                  }}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span
                  className={`text-[11px] font-bold whitespace-nowrap transition-all duration-300 ${canClick ? "group-hover:underline" : ""}`}
                  style={{
                    color: isActive ? "#0099DD" : isDone ? "#0099DD" : "#B0B0B0",
                  }}
                >
                  {step.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-[2px] mx-2 mb-5 rounded-pill transition-all duration-500"
                  style={{
                    background: isDone ? "#0099DD" : "#EAEAEA",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
