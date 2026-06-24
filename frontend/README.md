# Golmok Shield Frontend

골목방패 프론트엔드입니다.  
Next.js App Router 기반 UI이며, 정적 export 결과물을 Azure Static Web Apps에 배포합니다.

## 역할

```text
사용자 브라우저
↓
Azure Static Web Apps
↓
Next.js 정적 페이지
↓
Azure Function App API 호출
```

프론트엔드는 추천 로직을 직접 계산하지 않습니다.  
질문 목록 조회와 추천 결과 생성은 백엔드 Azure Function App을 호출합니다.

## 주요 경로

```text
app/page.tsx                 홈
app/onboarding/page.tsx      시작 안내
app/game/page.tsx            밸런스게임 질문
app/result/page.tsx          추천/비추천 결과
app/market/[dongId]/         동별 상세 리포트
lib/api.ts                   백엔드 API 클라이언트
lib/districts.ts             16개 행정동 라우트/지도용 기본 정보
components/                  공통 UI 컴포넌트
tests/                       프론트 계약 테스트
```

## 필수 환경변수

로컬 개발 시 `frontend/.env.local` 파일을 생성합니다.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:7071
NEXT_PUBLIC_KAKAO_MAP_KEY=
```

배포 시 GitHub Actions Secrets에 아래 값을 등록해야 합니다.

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_KAKAO_MAP_KEY
SWA_DEPLOYMENT_TOKEN
```

### NEXT_PUBLIC_API_BASE_URL 주의

`NEXT_PUBLIC_API_BASE_URL`은 Azure Function App의 루트 URL이어야 합니다.

올바른 예:

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net
```

잘못된 예:

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net/api
```

프론트 코드에서 `/api/recommend/questions`, `/api/recommend`를 자동으로 붙입니다.

## 로컬 실행

프론트만 실행:

```bash
cd frontend
npm ci
npm run dev
```

브라우저에서 접속:

```text
http://localhost:3000
```

백엔드도 같이 테스트하려면 별도 터미널에서 실행합니다.

```bash
cd backend
npm ci
npm run dev
```

기본 백엔드 주소:

```text
http://localhost:7071
```

## API 연결 구조

프론트는 `lib/api.ts`에서 API URL을 만듭니다.

```text
GET  {NEXT_PUBLIC_API_BASE_URL}/api/recommend/questions
POST {NEXT_PUBLIC_API_BASE_URL}/api/recommend
```

`NEXT_PUBLIC_API_BASE_URL`이 비어 있으면 정적 웹앱 자기 자신에게 `/api/...`를 요청하게 되어 404가 발생할 수 있습니다.  
그래서 GitHub Actions에서 빌드 전에 해당 secret이 비어 있는지 검증합니다.

## 테스트

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

전체 검증:

```bash
npm run verify
```

## 배포

프론트는 Azure Static Web Apps로 배포합니다.

사용 워크플로:

```text
.github/workflows/azure-static-web-apps-mango-bay-08358bc00.yml
```

배포 방식:

```text
1. frontend에서 npm ci 실행
2. 환경변수 검증
3. npm run build 실행
4. frontend/out 생성 확인
5. Azure Static Web Apps에 frontend/out 업로드
```

`next.config.mjs`에서 정적 export를 사용합니다.

```js
const nextConfig = {
  output: "export",
};

export default nextConfig;
```

따라서 서버 전용 기능이나 런타임 API Route에 의존하면 안 됩니다.  
추천 API는 Next.js 내부 Route Handler가 아니라 별도 Azure Function App에서 처리합니다.

## 상세 페이지 주의

`app/market/[dongId]`는 정적 export 대상입니다.  
따라서 `lib/districts.ts`의 `DISTRICTS`에 등록된 16개 동만 상세 페이지로 생성됩니다.

현재 기준 16개 동:

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

추천 결과의 점수, 군집, 추천 사유, 상세 점수는 `sessionStorage.recommendation`에 저장된 API 응답을 우선 사용합니다.

## 자주 발생하는 문제

### 질문을 불러오지 못했어요 / 404

원인:

```text
NEXT_PUBLIC_API_BASE_URL이 비어 있음
또는 Static Web App URL로 잘못 설정됨
또는 /api까지 포함해서 설정됨
```

확인:

```text
GitHub Actions Secrets > NEXT_PUBLIC_API_BASE_URL
```

올바른 값:

```text
https://golmok-function-xxxxx.koreacentral-01.azurewebsites.net
```

### 상세 페이지 404

원인:

```text
추천 결과의 동 이름이 lib/districts.ts의 DISTRICTS에 없음
```

확인:

```bash
cd frontend
npm test
```

### API 응답 형식이 올바르지 않습니다

원인:

```text
백엔드 응답이 프론트의 RecommendationResponse 계약과 맞지 않음
```

확인할 파일:

```text
frontend/lib/api.ts
frontend/lib/types.ts
backend/src/lib/types.ts
backend/src/lib/service.ts
```