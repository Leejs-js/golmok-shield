# Handoff: 상세 지표 페이지 리디자인 (시안 B)

## Overview
"상세 지표" 페이지를 개선한 디자인입니다. 기존에는 9개 지표가 동일한 무게의 카드 그리드로
나열되고, 카드를 누르면 설명이 아래로 펼쳐지면서 그리드가 깨졌습니다(정신없고 가독성 저하).

**시안 B**는 이를 다음으로 해결합니다.
1. 상단 **요약 바**(위험/주의/정상 개수) — "무엇부터 볼지" 즉시 파악
2. **단일 컬럼 리스트** — 펼쳐도 좌우 흐름이 끊기지 않음
3. **점수 오름차순(개선 필요 항목 우선) 정렬** + 상태 색 점으로 시선 정리
4. 설명/TIP을 인라인으로 펼침 (한 번에 하나만 열림, 토글)

## About the Design Files
이 번들의 HTML 파일은 **디자인 레퍼런스(프로토타입)** 입니다. 그대로 복붙해 배포하는
프로덕션 코드가 아니라, 의도한 모양·동작을 보여주는 참고물입니다. 실제 작업은 이 디자인을
**대상 코드베이스의 기존 환경(React/Vue 등)과 패턴·컴포넌트로 재현**하는 것입니다.

## Fidelity
**High-fidelity.** 색상·타이포·간격·인터랙션이 최종값입니다. 아래 토큰/스펙대로 픽셀 단위로
재현하되, 코드베이스에 동등한 컴포넌트(Card, Tag/Badge, Icon 등)가 있으면 그것을 사용하세요.
이 프로젝트는 **Wanted Design System** 토큰을 따릅니다.

## Screen: 상세 지표 (Detail Metrics)

### Purpose
상권 분석 결과의 9개 세부 지표를 점수·상태와 함께 보여주고, 각 항목의 해석과 실행 팁을 읽게 함.

### Layout
- 컨테이너: 흰색 카드, `border-radius:16px`, `box-shadow:0 1px 4px rgba(0,0,0,.08)`, `padding:24px`, 최대 폭 ~680px.
- 제목 "상세 지표" (700 / 18px) — `margin-bottom:14px`.
- **요약 바**: `display:flex; gap:10px; margin-bottom:20px`. 3개 동일 폭(`flex:1`) 블록.
- **리스트**: `display:flex; flex-direction:column`. 각 행 위에 `border-top:1px solid rgba(112,115,124,.16)`.

### 요약 바 (3 blocks)
각 블록: `border-radius:12px; padding:14px 16px`. 큰 숫자(700/20px) + 라벨(500/12px, ink 61%).
| 블록 | 배경 | 숫자색 | 숫자 | 라벨 |
|---|---|---|---|---|
| 위험 | `rgba(255,66,66,.07)` | `#FF4242` | 1개 | 위험 · 우선 점검 |
| 주의 | `rgba(255,146,0,.08)` | `#FF9200` | 5개 | 주의 · 보완 권장 |
| 정상 | `rgba(0,191,64,.08)` | `#00BF40` | 3개 | 정상 · 강점 |
> 개수는 데이터에서 상태별 count로 계산. (위 값은 현재 샘플 기준)

### 리스트 행 (collapsed)
`display:flex; align-items:center; gap:14px; padding:16px 8px; cursor:pointer; border-radius:8px`.
hover 시 `background:rgba(112,115,124,.06)`.
순서대로:
1. 상태 점: `width/height:8px; border-radius:99px; background:<statusColor>`
2. 지표명: 600 / 15px, ink `#171717`, `flex:1`
3. 상태 라벨: 600 / 12px, 색 = `<statusColor>` (텍스트 "위험/주의/정상")
4. 점수: 700 / 16px, ink, `width:54px; text-align:right` (소수 1자리, 예 `33.1`)
5. 셰브론 `⌄`: 700 / 18px, ink 40%, 열림 시 `transform:rotate(180deg)`, `transition:transform .2s`

### 리스트 행 (expanded — 한 번에 하나)
`padding:4px 8px 20px 30px` (좌측 들여쓰기로 본문 정렬):
- 설명: 400 / 15px, line-height 1.7, ink `#171717`, `margin-bottom:14px`
- TIP 박스: `display:flex; gap:8px; background:rgba(112,115,124,.05); border-radius:10px; padding:13px 15px`
  - "TIP" 라벨: 700 / 12px, primary `#3366FF`
  - 본문: 400 / 13px, line-height 1.6, ink 61%

## Interactions & Behavior
- 행 클릭 → 해당 항목 펼침. 이미 열린 항목 클릭 → 닫힘. (아코디언, 동시 1개만 open)
- 전환: 셰브론 회전 `.2s`. 펼침 영역은 즉시 표시(원하면 height/opacity 트랜지션 `.2s cubic-bezier(.4,0,.2,1)` 추가 가능).
- 정렬 고정: 상태 그룹(위험→주의→정상) 내 점수 오름차순 = 결과적으로 점수 낮은 순.

## State Management
- `openIndex: number` (열린 항목 인덱스, 닫힘이면 `-1`). 초기값 0(첫 항목 열림) 또는 -1(전부 닫힘) 선택.
- 데이터는 정적/서버 fetch 모두 가능. 요약 개수는 데이터에서 파생.

## Data shape
```ts
type Status = "위험" | "주의" | "정상";
interface Metric { name: string; score: number; status: Status; desc: string; tip: string; }
```
상태→색 매핑: 위험 `#FF4242`, 주의 `#FF9200`, 정상 `#00BF40`.
정렬: `statusRank(위험=0,주의=1,정상=2)` → score 오름차순.

현재 샘플 데이터 (정렬 적용 후 순서):
1. 중장년 수요 · 33.1 · 위험
2. 낮은 경쟁 부담 · 50.6 · 주의
3. 업무 수요 · 61.0 · 주의
4. 생활권 수요 · 67.3 · 주의
5. 상권 규모 · 67.8 · 주의
6. 점포 성장성 · 69.1 · 주의
7. 트렌드 적합도 · 77.5 · 정상
8. 20·30대 적합도 · 89.3 · 정상
9. 대중교통 접근성 · 100.0 · 정상
> desc/tip 전체 문구는 `상세지표 개선시안.dc.html`의 `data()` 메서드를 그대로 참조하세요.

## Design Tokens (Wanted Design System)
- Primary: `#3366FF`
- Ink: `#171717` / 61% `rgba(23,23,23,.61)` / 40% `rgba(23,23,23,.40)`
- Status: positive `#00BF40`, cautionary `#FF9200`, negative `#FF4242`
- Fill(중립): `rgba(112,115,124,.05)`, hover `rgba(112,115,124,.06)`
- Line(중립): `rgba(112,115,124,.16)`
- Radius: 카드 16px, 컨트롤/박스 10–12px, 점 99px(pill)
- Shadow(카드): `0 1px 4px rgba(0,0,0,.08)`
- Font: Wanted Sans / Pretendard. 본문 Medium(500), 라벨/지표명 SemiBold(600), 숫자/제목 Bold(700)
- Spacing: 4px 그리드 (8/10/12/14/16/20/24)

## Components (코드베이스에 있으면 재사용)
- Card (흰색·16px·무테·shadow)
- Tag/Badge — 상태 라벨용 (텍스트만 색으로 처리해도 무방)
- Icon — 셰브론은 `chevron-down` (Lucide). 현재 목업은 `⌄` 글리프 사용 중이니 Icon 컴포넌트로 교체 권장.

## Assets
없음. 아이콘은 셰브론 1종(`chevron-down`)만 필요. 이미지/로고 없음.

## Files
- `상세지표 개선시안.dc.html` — A안 + B안 원본 프로토타입. **오른쪽 프레임이 시안 B**입니다.
  로직(`data()`, 정렬, 토글)과 정확한 스타일 문자열이 이 파일에 들어 있습니다.
