import { FeatureStatus } from "./types";

export const STATUS_COLORS: Record<FeatureStatus, string> = {
  normal: "#11B584",
  warn: "#F2A53C",
  danger: "#F05A66",
};

export const STATUS_LABELS: Record<FeatureStatus, string> = {
  normal: "정상",
  warn: "주의",
  danger: "위험",
};

export const STATUS_TINT_BG: Record<FeatureStatus, string> = {
  normal: "#E6F7F1",
  warn: "#FEF4E6",
  danger: "#FDECEE",
};
