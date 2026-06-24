"use client";

import { FeatureStatus } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS, STATUS_TINT_BG } from "@/lib/colors";

interface FeatureItemProps {
  id: string;
  label: string;
  value: string;
  status: FeatureStatus;
  description: string;
  tip?: string;
}

export default function FeatureItem({
  id,
  label,
  value,
  status,
  description,
  tip,
}: FeatureItemProps) {
  const color = STATUS_COLORS[status];
  const tintBg = STATUS_TINT_BG[status];
  const statusLabel = STATUS_LABELS[status];

  return (
    <div
      id={`feat-${id}`}
      className="bg-[#F7F8FA] rounded-2xl border border-[#ECECEC] p-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[13.5px] font-extrabold text-[#34454D]">
          {label}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1 h-[22px] px-2.5 rounded-pill text-xs font-extrabold"
          style={{ background: tintBg, color }}
        >
          {value}
        </span>
        <span
          className="inline-flex items-center h-5 px-2 rounded-md text-white text-[10.5px] font-bold"
          style={{ background: color }}
        >
          {statusLabel}
        </span>
      </div>
      <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-subtle">{description}</p>
      {tip && (
        <p className="mt-2 text-[12px] leading-relaxed text-[#5C6570]">
          <span className="font-extrabold text-[#34454D]">TIP </span>{tip}
        </p>
      )}
    </div>
  );
}
