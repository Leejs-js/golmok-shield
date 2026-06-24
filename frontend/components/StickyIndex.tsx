"use client";

import { FEATURE_LABELS, FEATURE_IDS } from "@/lib/districts";
import { STATUS_COLORS } from "@/lib/colors";
import { FeatureStatus } from "@/lib/types";

interface StickyIndexProps {
  activeId: string;
  statuses: Record<string, FeatureStatus>;
  onSelect: (id: string) => void;
}

export default function StickyIndex({
  activeId,
  statuses,
  onSelect,
}: StickyIndexProps) {
  return (
    <div className="sticky top-14 flex flex-col gap-1.5">
      <p className="text-[11px] font-bold text-muted mb-1 tracking-wide">
        상권 지표
      </p>
      {FEATURE_IDS.map((id) => {
        const isActive = id === activeId;
        const status = statuses[id] || "normal";
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex items-center gap-2 h-9 px-3 border-none rounded-[9px] cursor-pointer text-[12.5px] text-left transition-all duration-150"
            style={{
              fontWeight: isActive ? 800 : 500,
              background: isActive ? "#D9F0FA" : "transparent",
              color: isActive ? "#0099DD" : "#6B6B66",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: STATUS_COLORS[status] }}
            />
            {FEATURE_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
