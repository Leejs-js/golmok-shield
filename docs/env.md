# Environment Variables Guide

골목방패 프로젝트의 환경변수 관리 기준입니다.

이 프로젝트는 `frontend`와 `backend`가 독립 패키지입니다.  
따라서 실제 실행용 env 파일도 분리해서 관리합니다.

```text
frontend/.env.local   → 브라우저에 공개되어도 되는 프론트 변수
backend/.env.local    → Azure OpenAI 키 등 백엔드 비밀 변수
```

루트에 하나의 실제 `.env` 파일로 통합하지 않습니다.  
프론트 변수와 백엔드 비밀 변수가 섞이면 Azure OpenAI 키 같은 민감 정보가 브라우저 번들에 노출될 수 있습니다.

---

## 1. Local Development

### Frontend

파일 위치:

```text
frontend/.env.local
```

예시:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:7071
NEXT_PUBLIC_KAKAO_MAP_KEY=
```

설명:

| 변수명 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 필수 | 백엔드 API 루트 URL |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 선택 | 카카오맵 JavaScript 키 |

주의:

```text
NEXT_PUBLIC_ 접두사가 붙은 값은 브라우저에 공개될 수 있습니다.
비밀키를 NEXT_PUBLIC_ 변수에 넣지 않습니다.
```

---

### Backend

파일 위치:

```text
backend/.env.local
```

예시:

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

설명:

| 변수명 | 필수 | 설명 |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT` | 선택 | Azure OpenAI 리소스 endpoint |
| `AZURE_OPENAI_API_KEY` | 선택 | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | 선택 | Azure OpenAI deployment name |
| `AZURE_OPENAI_API_VERSION` | 선택 | Azure OpenAI API version. 기본값은 `2024-10-21` |
| `AZURE_OPENAI_TIMEOUT_MS` | 선택 | Azure OpenAI 요청 timeout. 기본값은 `8000` |
| `AZURE_OPENAI_MAX_RETRIES` | 선택 | Azure OpenAI 재시도 횟수. 기본값은 `1` |
| `RECOMMENDATION_ENGINE` | 선택 | 사용할 추천 엔진 ID |
| `CORS_ALLOWED_ORIGINS` | 필수 | 백엔드 API 호출을 허용할 프론트 origin 목록 |

Azure OpenAI 변수 3개가 없어도 추천 계산은 동작합니다.

```text
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT
```

다만 이 경우 추천 설명은 Azure OpenAI가 아니라 `rule_based` fallback으로 생성됩니다.

---

## 2. Production Deployment

운영 환경에서는 프론트와 백엔드 환경변수 저장 위치가 다릅니다.

```text
Frontend env  → GitHub Actions Secrets
Backend env   → Azure Function App Environment variables
```

---

### Frontend: GitHub Actions Secrets

GitHub repository settings에서 설정합니다.

```text
Settings → Secrets and variables → Actions → Repository secrets
```

필요한 값:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_KAKAO_MAP_KEY
SWA_DEPLOYMENT_TOKEN
```

`NEXT_PUBLIC_API_BASE_URL`은 Azure Function App의 루트 URL이어야 합니다.

올바른 예:

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net
```

잘못된 예:

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net/api
```

프론트 코드가 `/api/recommend/questions`, `/api/recommend`를 자동으로 붙입니다.

---

### Backend: Azure Function App Environment Variables

Azure Portal에서 설정합니다.

```text
Function App → Settings → Environment variables
```

필요한 값:

```text
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT
AZURE_OPENAI_API_VERSION
AZURE_OPENAI_TIMEOUT_MS
AZURE_OPENAI_MAX_RETRIES
RECOMMENDATION_ENGINE
CORS_ALLOWED_ORIGINS
```

운영 CORS 예시:

```text
CORS_ALLOWED_ORIGINS=https://mango-bay-08358bc00.7.azurestaticapps.net
```

로컬과 운영을 함께 허용하는 예시:

```text
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://mango-bay-08358bc00.7.azurestaticapps.net
```

주의:

```text
쉼표 뒤에 공백을 넣지 않습니다.
등록하지 않은 azurestaticapps.net 주소는 허용하지 않습니다.
```

---

## 3. Do Not Commit

아래 파일은 커밋하지 않습니다.

```text
.env
.env.local
.env.*.local
frontend/.env.local
backend/.env.local
backend/local.settings.json
```

실제 키 값도 README, 이슈, PR, 노션, 캡처 이미지에 노출하지 않습니다.

---

## 4. Safe Examples

커밋 가능한 예시 파일:

```text
frontend/.env.example
backend/.env.example
docs/env.md
```

커밋하면 안 되는 실제 설정 파일:

```text
frontend/.env.local
backend/.env.local
```

---

## 5. Quick Check

프론트 로컬 실행 전 확인:

```bash
cd frontend
cat .env.local
npm run dev
```

백엔드 로컬 실행 전 확인:

```bash
cd backend
cat .env.local
npm run dev
```

백엔드 health check:

```text
http://127.0.0.1:7071/api/recommend/health
```

운영 health check:

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
단, 설명 생성은 Azure OpenAI가 아니라 `rule_based` fallback으로 동작합니다.