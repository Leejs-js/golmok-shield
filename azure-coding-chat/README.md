# Azure Coding Chat

Azure OpenAI API를 이용하는 로컬 코딩 어시스턴트입니다. 브라우저는 로컬 Node.js 서버에만 요청하며, Azure API 키는 서버의 `.env`에서만 읽습니다.

## 요구 사항

- Node.js 20 이상
- Azure OpenAI 리소스
- Azure에 배포한 채팅 모델과 해당 배포 이름

## Windows

PowerShell에서 실행합니다.

```powershell
cd azure-coding-chat
Copy-Item .env.example .env
notepad .env
npm start
```

`.env`에 Azure 설정을 입력한 후 실행합니다.

```powershell
npm start
```

## macOS

터미널에서 실행합니다.

```bash
cd azure-coding-chat
cp .env.example .env
nano .env
npm start
```

`.env`에 Azure 설정을 입력한 후 실행합니다.

```bash
npm start
```

## `.env` 설정

Windows와 macOS 모두 동일합니다.

```dotenv
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE-NAME.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
PORT=3000
```

실행 후 브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 별도 패키지 설치는 필요하지 않습니다.

## 환경변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT` | 예 | Azure OpenAI 리소스의 HTTPS 엔드포인트 |
| `AZURE_OPENAI_API_KEY` | 예 | Azure OpenAI API 키 |
| `AZURE_OPENAI_DEPLOYMENT` | 예 | 모델명이 아닌 Azure 배포 이름 |
| `PORT` | 아니요 | 로컬 포트, 기본값 `3000` |

쉘에 이미 같은 이름의 환경변수가 있으면 `.env`보다 우선합니다.

## 제공 기능

- Azure OpenAI 응답 실시간 스트리밍
- 대화 내역 브라우저 로컬 저장
- 코딩용 시스템 프롬프트 편집
- Markdown 및 코드 블록 표시
- 코드/답변 복사
- 생성 중단, 새 대화, 반응형 화면
- API 키를 노출하지 않는 로컬 서버 프록시

## 테스트

실제 Azure API를 호출하지 않는 서버 테스트가 포함되어 있습니다.

```bash
npm test
```

## 문제 해결

- `설정 필요`: `.env` 파일 위치와 세 필수 값을 확인한 후 서버를 다시 시작합니다.
- `401` 또는 `403`: API 키가 해당 엔드포인트의 리소스에서 발급된 키인지 확인합니다.
- `DeploymentNotFound`: `AZURE_OPENAI_DEPLOYMENT`에 모델 카탈로그 이름이 아니라 실제 배포 이름을 입력했는지 확인합니다.
- 응답이 오지 않음: 배포 모델이 Responses API와 스트리밍을 지원하는지, Azure 할당량이 남아 있는지 확인합니다.
- `EADDRINUSE`: 기존 서버를 종료하거나 `.env`의 `PORT`를 다른 번호로 변경합니다.

이 앱은 Codex 계열 모델을 포함한 최신 배포와 호환되도록 Azure OpenAI의
`POST /openai/v1/responses` 엔드포인트를 사용합니다.
