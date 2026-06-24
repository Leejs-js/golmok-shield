import json
import os
import urllib.request
from abc import ABC, abstractmethod
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


COORDINATES = {
    "공덕동": (37.5502, 126.9600), "아현동": (37.5537, 126.9560),
    "도화동": (37.5417, 126.9495), "용강동": (37.5423, 126.9430),
    "대흥동": (37.5552, 126.9460), "염리동": (37.5471, 126.9460),
    "신수동": (37.5470, 126.9350), "서강동": (37.5477, 126.9320),
    "서교동": (37.5553, 126.9180), "합정동": (37.5496, 126.9130),
    "망원1동": (37.5556, 126.9100), "망원2동": (37.5600, 126.9020),
    "연남동": (37.5645, 126.9220), "성산1동": (37.5633, 126.9070),
    "성산2동": (37.5687, 126.9060), "상암동": (37.5783, 126.8890),
}

TRAIT_LABELS = {
    "trend": "트렌디한 상권 성향", "alley": "골목·생활형 분위기", "day": "낮 시간대 수요",
    "night": "저녁 소비 활력", "office": "직장인 반복 수요", "young": "청년층 친화도",
    "weekday": "주중 안정성", "weekend": "주말 방문 수요", "traffic": "교통·유입 접근성",
    "lowCompetition": "상대적으로 낮은 경쟁", "premium": "프리미엄 소비 여력",
    "turnover": "회전 가능성", "takeout": "테이크아웃 동선", "stay": "체류형 공간 수요",
}


def _minmax(series: pd.Series) -> pd.Series:
    span = series.max() - series.min()
    return pd.Series(0.5, index=series.index) if span == 0 else (series - series.min()) / span


class ModelProvider(ABC):
    @abstractmethod
    def recommend(self, answers: dict) -> dict:
        raise NotImplementedError


class LocalKMeansProvider(ModelProvider):
    def __init__(self) -> None:
        base = Path(__file__).resolve().parent / "models"
        self.pipeline = joblib.load(base / "kmeans_pipeline.pkl")
        self.df = pd.read_csv(base / "dong_cluster_result.csv", encoding="utf-8-sig")
        self.feature_cols = self.pipeline["feature_cols"]
        missing = [column for column in self.feature_cols if column not in self.df.columns]
        if missing:
            raise ValueError(f"모델 입력 컬럼이 데이터에 없습니다: {missing}")
        self._prepare_scores()

    def _prepare_scores(self) -> None:
        frame = self.df
        n = {column: _minmax(frame[column].astype(float)) for column in self.feature_cols}
        frame["trend"] = .35*n["young_pop_ratio"] + .2*n["store_count"] + .2*n["subway_total_psngr_co"] + .15*n["food_biz_ratio"] + .1*n["store_turnover_ratio"]
        frame["alley"] = .3*(1-n["store_count"]) + .25*n["middle_old_pop_ratio"] + .25*(1-n["franchise_ratio"]) + .2*(1-n["store_turnover_ratio"])
        frame["day"] = .45*n["office_worker_ratio"] + .3*n["middle_old_pop_ratio"] + .25*n["subway_total_psngr_co"]
        frame["night"] = .35*n["food_biz_ratio"] + .3*n["young_pop_ratio"] + .2*n["store_turnover_ratio"] + .15*n["subway_total_psngr_co"]
        frame["office"] = .55*n["office_worker_ratio"] + .25*n["subway_total_psngr_co"] + .2*n["store_count"]
        frame["young"] = .55*n["young_pop_ratio"] + .25*n["education_biz_ratio"] + .2*n["food_biz_ratio"]
        frame["weekday"] = .5*frame["office"] + .3*n["middle_old_pop_ratio"] + .2*(1-n["store_turnover_ratio"])
        frame["weekend"] = .4*frame["young"] + .3*n["food_biz_ratio"] + .2*n["store_turnover_ratio"] + .1*n["subway_total_psngr_co"]
        frame["traffic"] = .5*n["subway_total_psngr_co"] + .25*n["subway_station_count"] + .25*n["store_count"]
        frame["lowCompetition"] = 1-(.45*n["store_count"] + .3*n["store_turnover_ratio"] + .25*n["franchise_ratio"])
        frame["premium"] = .4*n["office_worker_ratio"] + .35*n["young_pop_ratio"] + .25*n["food_biz_ratio"]
        frame["turnover"] = .4*n["store_turnover_ratio"] + .35*n["subway_total_psngr_co"] + .25*n["open_store_ratio"]
        frame["takeout"] = .45*frame["traffic"] + .35*frame["office"] + .2*n["subway_station_count"]
        frame["stay"] = .35*frame["alley"] + .3*frame["young"] + .2*n["education_biz_ratio"] + .15*n["middle_old_pop_ratio"]
        feature_matrix = frame[self.feature_cols].astype(float)
        scaled = self.pipeline["scaler"].transform(feature_matrix)
        frame["cluster_id_live"] = self.pipeline["kmeans"].predict(scaled)

    def recommend(self, answers: dict) -> dict:
        selected = list(answers.values())
        unknown = [key for key in selected if key not in TRAIT_LABELS]
        if unknown or len(selected) != 7:
            raise ValueError("7개 밸런스 질문의 유효한 답변이 필요합니다.")
        frame = self.df.copy()
        frame["preference_match"] = frame[selected].mean(axis=1)
        frame["business_potential"] = .35*frame["traffic"] + .25*frame["day"] + .2*frame["lowCompetition"] + .2*frame["weekday"]
        frame["risk"] = 1-(.55*frame["lowCompetition"] + .45*(1-_minmax(frame["close_store_ratio"].astype(float))))
        frame["final_score"] = .62*frame["preference_match"] + .28*frame["business_potential"] + .1*(1-frame["risk"])
        frame["bad_fit_score"] = .65*(1-frame["preference_match"]) + .25*frame["risk"] + .1*(1-frame["business_potential"])
        best = frame.nlargest(3, "final_score")
        worst = frame[~frame.index.isin(best.index)].nlargest(3, "bad_fit_score")
        return {
            "best": [self._serialize(row, selected, "final_score", True) for _, row in best.iterrows()],
            "worst": [self._serialize(row, selected, "bad_fit_score", False) for _, row in worst.iterrows()],
            "persona": self._persona(answers),
            "model": {"provider": "local", "label": "K-Means Local + Weighted Scoring", "clusters": int(self.pipeline["kmeans"].n_clusters)},
        }

    def _serialize(self, row: pd.Series, selected: list[str], score_column: str, positive: bool) -> dict:
        dong = str(row["dong_nm"]); lat, lng = COORDINATES.get(dong, (37.5575, 126.918))
        ordered = sorted(selected, key=lambda key: float(row[key]), reverse=positive)[:2]
        reasons = [f"{TRAIT_LABELS[key]}이 {round(float(row[key])*100)}점으로 " + ("취향과 잘 맞아요" if positive else "기대와 차이가 있어요") for key in ordered]
        cluster_id = int(row["cluster_id_live"])
        cluster_name = self.pipeline["cluster_name_map"].get(cluster_id, str(row.get("cluster_name", "상권 유형")))
        return {"dong":dong,"lat":lat,"lng":lng,"clusterId":cluster_id,"clusterName":cluster_name,"score":round(float(row[score_column])*100),"reasons":reasons}

    @staticmethod
    def _persona(answers: dict) -> dict:
        labels = {"trend":"트렌드 중심","alley":"골목 중심","day":"낮상권","night":"밤상권","office":"직장인 타깃","young":"청년 타깃","weekday":"주중 안정형","weekend":"주말 집중형"}
        keys = [answers.get("marketStyle"),answers.get("timeStyle"),answers.get("targetCustomer"),answers.get("salesPattern")]
        return {"title":" · ".join(labels.get(key,key) for key in keys)+" 창업자","description":"선택한 운영 방식과 고객층을 기준으로 마포구 상권을 비교했습니다."}


class AzureMLProvider(ModelProvider):
    def __init__(self) -> None:
        self.endpoint = os.environ.get("AZUREML_ENDPOINT_URL", "").strip()
        self.api_key = os.environ.get("AZUREML_API_KEY", "").strip()
        if not self.endpoint or not self.api_key:
            raise RuntimeError("AZUREML_ENDPOINT_URL과 AZUREML_API_KEY를 설정해야 합니다.")

    def recommend(self, answers: dict) -> dict:
        request = urllib.request.Request(self.endpoint, data=json.dumps({"answers": answers}).encode("utf-8"), headers={"Content-Type":"application/json","Authorization":f"Bearer {self.api_key}"}, method="POST")
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
        result.setdefault("model", {"provider":"azureml","label":"Azure ML Online Endpoint"})
        return result


def get_provider() -> ModelProvider:
    return AzureMLProvider() if os.environ.get("MODEL_PROVIDER", "local").lower() == "azureml" else LocalKMeansProvider()
