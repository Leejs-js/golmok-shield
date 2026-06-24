import type { PreferenceVector } from "./types";

export type BalanceGameOption = {
  id: string;
  label: string;
  vector: Partial<PreferenceVector>;
};

export type BalanceGameQuestion = {
  id: string;
  title: string;
  options: readonly BalanceGameOption[];
};

export const balanceGameQuestions: readonly BalanceGameQuestion[] = [
  {
    id: "target_age",
    title: "어떤 손님을 더 중심으로 보고 싶으신가요?",
    options: [
      {
        id: "young_customer",
        label: "20·30대 젊은 손님이 많은 곳",
        vector: { young: 1.0, middle_senior: 0.1, local: 0.2, trend: 0.8 },
      },
      {
        id: "middle_senior_customer",
        label: "40대 이상 중장년·생활권 손님이 많은 곳",
        vector: { young: 0.1, middle_senior: 1.0, local: 0.8, trend: 0.2 },
      },
    ],
  },
  {
    id: "demand_type",
    title: "어떤 수요가 더 중요한가요?",
    options: [
      {
        id: "office_demand",
        label: "직장인·업무지구 수요",
        vector: { office: 1.0, local: 0.2, access: 0.5, scale: 0.5 },
      },
      {
        id: "local_demand",
        label: "거주민·생활권 수요",
        vector: { office: 0.2, local: 1.0, access: 0.3, low_competition: 0.6 },
      },
    ],
  },
  {
    id: "area_style",
    title: "어떤 동네 분위기가 좋으신가요?",
    options: [
      {
        id: "local_alley",
        label: "조용한 로컬·골목 상권",
        vector: { local: 1.0, low_competition: 0.8, scale: 0.2, access: 0.3 },
      },
      {
        id: "developed_area",
        label: "번화하고 규모가 큰 발달 상권",
        vector: { local: 0.2, low_competition: 0.2, scale: 1.0, access: 0.8, trend: 0.7 },
      },
    ],
  },
  {
    id: "competition_style",
    title: "주변에 비슷한 가게가 많은 건 어떠세요?",
    options: [
      {
        id: "verified_demand",
        label: "많아도 괜찮아요. 이미 수요가 검증된 곳이 좋아요.",
        vector: { scale: 0.8, growth: 0.6, low_competition: 0.1, trend: 0.6 },
      },
      {
        id: "avoid_competition",
        label: "적은 곳이 좋아요. 경쟁 부담이 낮은 곳이 좋아요.",
        vector: { scale: 0.2, growth: 0.3, low_competition: 1.0, local: 0.7 },
      },
    ],
  },
  {
    id: "business_strategy",
    title: "창업 전략은 어느 쪽에 가까우신가요?",
    options: [
      {
        id: "growth_area",
        label: "새 가게가 들어오는 성장 가능성 높은 곳",
        vector: { growth: 1.0, scale: 0.6, trend: 0.5, low_competition: 0.2 },
      },
      {
        id: "stable_area",
        label: "폐업·변동이 적은 안정적인 곳",
        vector: { growth: 0.2, scale: 0.3, trend: 0.2, low_competition: 1.0, local: 0.7 },
      },
    ],
  },
] as const;
