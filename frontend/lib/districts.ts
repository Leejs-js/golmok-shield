import { District } from "./types";

export const FEATURE_LABELS: Record<string, string> = {
  market_type: "상권 유형",
  weekday_pattern: "요일 매출",
  floating_pop: "유동인구",
  target_age: "타깃 연령",
  time_slot: "시간대 매출",
  rent_level: "임대료",
};

export const FEATURE_IDS = Object.keys(FEATURE_LABELS);

const DONG_NAME_TO_DISTRICT_ID: Record<string, string> = {
  공덕동: "gongdeok",
  아현동: "ahyeon",
  도화동: "dohwa",
  용강동: "yonggang",
  대흥동: "daeheung",
  염리동: "yeomri",
  신수동: "sinsu",
  서강동: "seogang",
  서교동: "seogyo",
  합정동: "hapjeong",
  망원1동: "mangwon1",
  망원2동: "mangwon2",
  연남동: "yeonnam",
  성산1동: "seongsan1",
  성산2동: "seongsan2",
  상암동: "sangam",
};

export function dongNameToDistrictId(dongName: string): string | undefined {
  return DONG_NAME_TO_DISTRICT_ID[dongName];
}

type DistrictSeed = {
  dongId: string;
  dongName: string;
  clusterId: number;
  clusterLabel: string;
  lat: number;
  lng: number;
};

function createDistrict(seed: DistrictSeed): District {
  return {
    dongId: seed.dongId,
    dongName: seed.dongName,

    // 주의:
    // 이 score/tier는 상세 페이지 404 방지를 위한 임시 기본값입니다.
    // 실제 추천 점수와 추천/비추천 여부는 result 페이지의 API 응답을 기준으로 표시됩니다.
    // 다음 단계에서 상세 페이지도 sessionStorage.recommendation 값을 우선 사용하도록 바꾸면 됩니다.
    score: 0,
    tier: "best",

    clusterId: seed.clusterId,
    clusterLabel: seed.clusterLabel,
    lat: seed.lat,
    lng: seed.lng,
    features: {
      market_type: {
        label: FEATURE_LABELS.market_type,
        value: seed.clusterLabel,
        status: "normal",
        description: `${seed.dongName}은 현재 모델 기준 '${seed.clusterLabel}' 군집에 속합니다.`,
      },
      weekday_pattern: {
        label: FEATURE_LABELS.weekday_pattern,
        value: "분석 준비 중",
        status: "normal",
        description: "요일별 매출 상세 데이터는 추후 연결 예정입니다.",
      },
      floating_pop: {
        label: FEATURE_LABELS.floating_pop,
        value: "분석 준비 중",
        status: "normal",
        description: "유동인구 상세 데이터는 추후 연결 예정입니다.",
      },
      target_age: {
        label: FEATURE_LABELS.target_age,
        value: "분석 준비 중",
        status: "normal",
        description: "타깃 연령 상세 데이터는 추후 연결 예정입니다.",
      },
      time_slot: {
        label: FEATURE_LABELS.time_slot,
        value: "분석 준비 중",
        status: "normal",
        description: "시간대별 매출 상세 데이터는 추후 연결 예정입니다.",
      },
      rent_level: {
        label: FEATURE_LABELS.rent_level,
        value: "분석 준비 중",
        status: "normal",
        description: "임대료 상세 데이터는 추후 연결 예정입니다.",
      },
    },
    llmLines: [
      `${seed.dongName} 상세 리포트는 추천 결과 데이터를 기준으로 표시됩니다.`,
      `현재 기본 상세 정보는 '${seed.clusterLabel}' 군집 정보를 기반으로 구성되어 있습니다.`,
    ],
  };
}

export const DISTRICTS: Record<string, District> = {
  gongdeok: createDistrict({
    dongId: "gongdeok",
    dongName: "공덕동",
    clusterId: 2,
    clusterLabel: "소규모 분리형 상권",
    lat: 37.5443,
    lng: 126.9518,
  }),
  ahyeon: createDistrict({
    dongId: "ahyeon",
    dongName: "아현동",
    clusterId: 3,
    clusterLabel: "업무·상업 복합형 상권",
    lat: 37.5574,
    lng: 126.9560,
  }),
  dohwa: createDistrict({
    dongId: "dohwa",
    dongName: "도화동",
    clusterId: 3,
    clusterLabel: "업무·상업 복합형 상권",
    lat: 37.5416,
    lng: 126.9496,
  }),
  yonggang: createDistrict({
    dongId: "yonggang",
    dongName: "용강동",
    clusterId: 3,
    clusterLabel: "업무·상업 복합형 상권",
    lat: 37.5426,
    lng: 126.9430,
  }),
  daeheung: createDistrict({
    dongId: "daeheung",
    dongName: "대흥동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5486,
    lng: 126.9428,
  }),
  yeomri: createDistrict({
    dongId: "yeomri",
    dongName: "염리동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5471,
    lng: 126.9460,
  }),
  sinsu: createDistrict({
    dongId: "sinsu",
    dongName: "신수동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5477,
    lng: 126.9352,
  }),
  seogang: createDistrict({
    dongId: "seogang",
    dongName: "서강동",
    clusterId: 3,
    clusterLabel: "업무·상업 복합형 상권",
    lat: 37.5478,
    lng: 126.9286,
  }),
  seogyo: createDistrict({
    dongId: "seogyo",
    dongName: "서교동",
    clusterId: 1,
    clusterLabel: "독립 핵심 상권",
    lat: 37.5553,
    lng: 126.9180,
  }),
  hapjeong: createDistrict({
    dongId: "hapjeong",
    dongName: "합정동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5496,
    lng: 126.9130,
  }),
  mangwon1: createDistrict({
    dongId: "mangwon1",
    dongName: "망원1동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5552,
    lng: 126.9056,
  }),
  mangwon2: createDistrict({
    dongId: "mangwon2",
    dongName: "망원2동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5609,
    lng: 126.9029,
  }),
  yeonnam: createDistrict({
    dongId: "yeonnam",
    dongName: "연남동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5663,
    lng: 126.9239,
  }),
  seongsan1: createDistrict({
    dongId: "seongsan1",
    dongName: "성산1동",
    clusterId: 0,
    clusterLabel: "생활권·로컬 상권",
    lat: 37.5633,
    lng: 126.9088,
  }),
  seongsan2: createDistrict({
    dongId: "seongsan2",
    dongName: "성산2동",
    clusterId: 2,
    clusterLabel: "소규모 분리형 상권",
    lat: 37.5680,
    lng: 126.9084,
  }),
  sangam: createDistrict({
    dongId: "sangam",
    dongName: "상암동",
    clusterId: 3,
    clusterLabel: "업무·상업 복합형 상권",
    lat: 37.5780,
    lng: 126.8925,
  }),
};