# Golmok Shield Backend

골목방패 백엔드입니다.  
Azure Functions 기반 Node.js API이며, 추천 질문, 취향 벡터, 16개 행정동 점수, 추천 엔진, Azure OpenAI 설명 생성을 담당합니다.

프론트엔드는 추천 계산을 직접 수행하지 않습니다.  
추천 로직과 모델 데이터는 백엔드에서 관리합니다.

## 역할

```text
Frontend
↓
Azure Function App
↓
추천 엔진
↓
Azure OpenAI 설명 생성
↓
추천/비추천 결과 반환
```

## 주요 기능

```text
질문 목록 제공
사용자 답변 검증
취향 벡터 생성
16개 행정동 추천 점수 계산
추천 TOP 3 / 비추천 TOP 3 반환
Azure OpenAI 기반 설명 생성
Azure OpenAI 실패 시 rule_based 설명 fallback
```

## 주요 경로

```text
src/functions/recommend.ts          Azure Functions HTTP 엔드포인트
src/http/handlers.ts                API 요청 처리
src/http/cors.ts                    CORS 허용 Origin 관리
src/lib/balanceGameQuestions.ts     밸런스게임 질문 원본
src/lib/preference.ts               답변 검증 및 취향 벡터 생성
src/lib/recommend.ts                추천 점수 계산
src/lib/service.ts                  추천 응답 조립
src/lib/azureOpenAI.ts              Azure OpenAI 설명 생성 및 fallback
src/model/recommendationEngine.ts   현재 추천 엔진
src/model/finalModelEngine.template.ts 최종 모델 교체용 템플릿
src/data/                           모델 입력 JSON 데이터
tests/                              백엔드 테스트
```

## 로컬 실행

```bash
cd backend
cp .env.example .env.local
npm ci
npm run verify
npm run dev
```

기본 로컬 서버 주소:

```text
http://127.0.0.1:7071
```

로컬 서버는 `.env.local`을 읽습니다.

## API 목록

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/recommend/questions` | 프론트 표시용 밸런스게임 5문항 반환 |
| POST | `/api/recommend` | 답변 검증 후 추천/비추천 결과 반환 |
| GET | `/api/recommend/health` | 추천 엔진, 데이터, Azure OpenAI 설정 상태 확인 |

## 환경변수

`.env.example`을 기준으로 설정합니다.

```env
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_TIMEOUT_MS=8000
AZURE_OPENAI_MAX_RETRIES=1
RECOMMENDATION_ENGINE=current-feature-score-v1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## CORS 설정

운영 배포 시 Azure Function App의 환경변수에 프론트 주소를 등록해야 합니다.

환경변수 이름:

```text
CORS_ALLOWED_ORIGINS
```

운영 예시:

```text
https://mango-bay-08358bc00.7.azurestaticapps.net
```

로컬과 운영을 함께 허용하는 예시:

```text
http://localhost:3000,http://127.0.0.1:3000,https://mango-bay-08358bc00.7.azurestaticapps.net
```

주의:

```text
쉼표 뒤에 공백을 넣지 않습니다.
등록하지 않은 azurestaticapps.net 주소는 허용하지 않습니다.
Origin 헤더가 없는 curl, health check, 서버-서버 요청은 허용합니다.
```

Azure Portal의 Function App CORS 허용 목록에도 같은 프론트 도메인을 등록합니다.

## Azure OpenAI 설정

Azure OpenAI를 사용하려면 Function App 환경변수에 아래 값을 등록해야 합니다.

```text
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT
AZURE_OPENAI_API_VERSION
```

예시:

```text
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_TIMEOUT_MS=8000
AZURE_OPENAI_MAX_RETRIES=1
```

주의:

```text
AZURE_OPENAI_API_KEY는 절대 프론트엔드에 넣지 않습니다.
NEXT_PUBLIC_ 접두사가 붙은 환경변수에 Azure OpenAI 키를 넣으면 안 됩니다.
.env.local, local.settings.json, 실제 키 값은 커밋하지 않습니다.
```

Azure OpenAI 설정이 없거나 요청에 실패해도 추천 계산은 계속 동작합니다.  
이 경우 응답의 `explanation_source`는 아래처럼 반환됩니다.

```json
{
  "explanation_source": "rule_based"
}
```

Azure OpenAI 설명이 정상 사용되면 아래처럼 반환됩니다.

```json
{
  "explanation_source": "azure_openai"
}
```

## 응답 계약

프론트는 백엔드 추천 응답이 아래 구조를 만족한다고 가정합니다.

```text
model_info
explanation_source
user_profile
recommendations      추천 TOP 3
not_recommended      비추천 TOP 3
map_data             추천 3개 + 비추천 3개
cluster_summary
```

추천 항목은 아래 필드를 포함해야 합니다.

```text
rank
dong_nm
total_score
cluster_id
cluster_type
reason
score_breakdown
```

API 응답 필드를 바꾸면 같은 작업에서 프론트 파일도 함께 수정해야 합니다.

```text
frontend/lib/types.ts
frontend/lib/api.ts
frontend/tests/api.test.ts
```

## 추천 데이터

현재 추천 엔진은 16개 행정동 점수 테이블을 사용합니다.

```text
공덕동
아현동
도화동
용강동
대흥동
염리동
신수동
서강동
서교동
합정동
망원1동
망원2동
연남동
성산1동
성산2동
상암동
```

점수 데이터 위치:

```text
backend/src/data/dong_score_table.json
backend/src/data/dong_cluster_result.json
backend/src/data/cluster_summary.json
```

생성 데이터 변경 시 아래 명령어를 사용합니다.

```bash
cd backend
npm run build:data
```

## 테스트

```bash
cd backend
npm run typecheck
npm test
npm run build
```

전체 검증:

```bash
npm run verify
```

## 배포

백엔드는 Azure Function App으로 배포합니다.

사용 워크플로:

```text
.github/workflows/backend-golmok-function.yml
```

배포 대상 Function App:

```text
golmok-function
```

배포 흐름:

```text
1. backend 변경 감지
2. npm ci
3. npm run verify
4. production dependencies만 남김
5. backend/dist, host.json, node_modules, package.json 업로드
6. Azure Function App 배포
7. /api/recommend/health로 배포 상태 확인
```

## 배포 후 확인

아래 주소로 health check를 실행합니다.

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net/api/recommend/health
```

확인할 값:

```text
status: ok
data.record_count: 16
azure_openai.configured: true 또는 false
```

`azure_openai.configured`가 `false`여도 추천 계산은 동작합니다.  
다만 설명은 Azure OpenAI가 아니라 rule_based fallback으로 생성됩니다.

## 프론트와 연결할 때 주의

프론트의 `NEXT_PUBLIC_API_BASE_URL`에는 Function App 루트 URL만 넣습니다.

올바른 예:

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net
```

잘못된 예:

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net/api
```

프론트 코드에서 `/api/recommend/questions`, `/api/recommend`를 자동으로 붙입니다.

## 충돌 방지 규칙

1. 추천 로직, 질문 원본, 모델 JSON을 프론트로 복사하지 않습니다.
2. API 응답 필드를 바꾸면 프론트 타입과 검증기도 함께 수정합니다.
3. `frontend`와 `backend`는 독립 패키지입니다. 각 폴더에서 따로 `npm ci`를 실행합니다.
4. 루트 또는 다른 폴더의 `node_modules`를 공유하지 않습니다.
5. `.env.local`, `local.settings.json`, 실제 Azure 키는 커밋하지 않습니다.
6. 새 모델을 붙일 때는 `RecommendationEngine` 계약을 유지합니다.