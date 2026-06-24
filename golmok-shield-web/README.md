# 골목 방패 웹 프로토타입

Notion의 **프로젝트 진행 현황**, **와이어프레임**, **카페 입지 추천 모델 및 데이터 활용 설계**를 기준으로 만든 독립형 웹 앱입니다. 기존 저장소 파일은 수정하지 않고 이 폴더에만 구현했습니다.

## 구현 범위

- 인트로 → 7문항 밸런스 게임 → 분석 로딩 → 추천/주의 TOP 3 결과
- OpenStreetMap + Leaflet 지도, 추천/주의 마커와 카드 연동
- `kmeans_pipeline.pkl`을 실제 로드해 16개 동의 군집을 재예측
- 사용자 응답과 실제 모델 feature를 결합한 가중 추천 점수
- API 연결 실패 시에도 시연 가능한 정적 목업 데이터 fallback
- Azure Static Web Apps 통합 Python API
- Local KMeans ↔ Azure ML Online Endpoint 환경변수 전환
- Leaflet ↔ Kakao Maps 어댑터 전환 지점

## 폴더 구조

```text
golmok-shield-web/
├─ static/                 # Azure Static Web Apps 프론트엔드
│  ├─ index.html
│  ├─ app.js
│  ├─ styles.css
│  ├─ js/
│  │  ├─ config.js         # 지도/API 설정
│  │  └─ map-adapters.js   # Leaflet/Kakao 지도 어댑터
│  └─ assets/data/areas.json
├─ api/                    # Azure Functions Python v2
│  ├─ function_app.py
│  ├─ model_provider.py    # Local/Azure ML 모델 어댑터
│  └─ models/
└─ scripts/prepare_model.ps1
```

## 로컬 실행

### 1. 모델 준비

이미 복사되어 있지만 원본 모델을 갱신한 뒤에는 다시 실행합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare_model.ps1
```

### 2. 정적 UI 빠른 확인

```powershell
cd static
python -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 엽니다. 이 방식은 정적 fallback 추천을 사용합니다.

### 3. API 포함 실행

Azure Functions Core Tools와 Static Web Apps CLI가 설치된 환경에서:

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
Copy-Item local.settings.example.json local.settings.json
cd ..
swa start static --api-location api
```

## Azure Static Web Apps 배포

Azure Portal 또는 GitHub Actions 설정값:

```yaml
app_location: golmok-shield-web/static
api_location: golmok-shield-web/api
output_location: ""
```

Python API가 `api/models/kmeans_pipeline.pkl`과 `dong_cluster_result.csv`를 포함하도록, 배포 전에 `prepare_model.ps1`을 실행합니다. 모델 pickle을 만든 scikit-learn 버전과 런타임 버전을 맞추기 위해 API 요구사항을 `scikit-learn==1.9.0`으로 고정했습니다.

## Azure ML로 전환

Static Web Apps의 애플리케이션 설정에 다음 값을 추가합니다.

```text
MODEL_PROVIDER=azureml
AZUREML_ENDPOINT_URL=https://<endpoint>/score
AZUREML_API_KEY=<managed-online-endpoint-key>
```

Azure ML 응답은 현재 API와 같은 형태를 반환하면 프론트엔드를 수정할 필요가 없습니다.

```json
{
  "best": [{"dong":"망원1동","lat":37.5556,"lng":126.91,"clusterName":"골목·생활형 상권","score":87,"reasons":["..."]}],
  "worst": [{"dong":"서교동","lat":37.5553,"lng":126.918,"clusterName":"트렌디·오피스형 상권","score":78,"reasons":["..."]}],
  "persona": {"title":"골목 중심 · 낮상권 창업자","description":"..."},
  "model": {"provider":"azureml","label":"Azure ML Online Endpoint"}
}
```

운영 환경에서는 API 키를 브라우저에 두지 말고 반드시 서버의 애플리케이션 설정 또는 Key Vault 참조로 관리하세요.

## Kakao Maps로 전환

1. `static/index.html`에 Kakao Maps SDK 스크립트를 추가합니다.
2. `static/js/config.js`의 `mapProvider`를 `"kakao"`로 바꿉니다.
3. `KakaoMapAdapter`에서 마커 이미지·인포윈도우를 원하는 디자인으로 확장합니다.

추천 엔진과 UI는 지도 공급자와 분리되어 있어 다른 코드는 바꿀 필요가 없습니다.

## 현재 데이터 한계

현재 모델은 KMeans 군집 + weighted scoring 단계입니다. Notion 설계의 LightGBM 잠재력 점수, 임대료, 카페 매출, 시간대별 생활인구는 아직 실데이터가 없어 기존 feature에서 파생한 점수로 대체했습니다. 프론트의 지도 중심점과 행정동 좌표는 동 대표점 목업입니다.
