"use client";

export default function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <span
            key={i}
            className="h-[7px] rounded-pill transition-all duration-300"
            style={{
              width: isActive ? 16 : 5,
              background: isDone
                ? "#0099DD"
                : isActive
                  ? "#0099DD"
                  : "#D8D6D0",
            }}
          />
        );
      })}
    </div>
  );
}
