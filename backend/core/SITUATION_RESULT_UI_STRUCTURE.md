# 상황분석 결과 화면 구성

## 전체 구조

```
┌─────────────────────────────────────────────────┐
│  헤더 섹션                                      │
│  - AI 분석 결과 배지                            │
│  - "분석이 완료되었습니다" 제목                 │
│  - 예상 유형 + 위험도 배지                      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  카드 1: 상황 분석 리포트 (summary)             │
│  - 마크다운 형식 리포트                         │
│  - 4개 섹션 포함:                               │
│    1. 📊 상황 분석의 결과                      │
│    2. ⚖️ 법적 관점에서 본 현재상황             │
│    3. 🎯 지금 당장 할 수 있는 행동             │
│    4. 💬 이렇게 말해보세요                     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  카드 2: 법적 관점에서 본 현재 상황 (criteria) │
│  - 판단 기준 리스트 (번호 + 상태 아이콘)        │
│  - 각 기준별 충족/부분충족/불충족 표시          │
│  - 법률 자문 아님 안내 문구                     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  카드 3: 지금 당장 할 수 있는 행동 (actionPlan)│
│  - 체크리스트 형식                              │
│  - 완료 체크 가능 (로컬 상태 저장)             │
│  - steps 배열의 items를 평탄화하여 표시        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  카드 4: 이렇게 말해보세요 (scripts)           │
│  - 대표/상사에게 말할 때 (toCompany)           │
│    - 복사 버튼 포함                             │
│  - 공적 기관에 상담할 때 (toAdvisor)           │
│    - 복사 버튼 포함                             │
│  - 유사한 사례 더 보기 버튼                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  카드 5: 비슷한 상황 케이스 (relatedCases)     │
│  - 최대 3개 표시                                │
│  - 클릭 시 케이스 상세 페이지로 이동            │
│  - 제목 + 요약 표시                             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  카드 6: 즉시 상담 시작                        │
│  - 리포트 기반 상담 시작 버튼                   │
│  - localStorage에 데이터 저장 후                │
│    /legal/assist/quick 페이지로 이동            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  액션 버튼                                      │
│  - 다시 분석하기 (폼 초기화)                    │
│  - 홈으로 돌아가기                              │
└─────────────────────────────────────────────────┘
```

## 데이터 구조

### analysisResult 타입
```typescript
interface SituationAnalysisResponse {
  classifiedType: SituationCategory  // 'harassment' | 'unpaid_wage' | ...
  riskScore: number                  // 0-100
  summary: string                    // 마크다운 형식 리포트
  criteria: Array<{                  // 법적 판단 기준
    name: string
    status: 'likely' | 'unclear' | 'unlikely'
    reason: string
  }>
  actionPlan: {                      // 행동 가이드
    steps: Array<{
      title: string
      items: string[]
    }>
  }
  scripts: {                          // 스크립트 템플릿
    toCompany?: string
    toAdvisor?: string
  }
  relatedCases: Array<{              // 유사 케이스
    id: string
    title: string
    summary: string
  }>
}
```

## 각 섹션 상세

### 1. 헤더 섹션
- **예상 유형**: `classifiedType` 기반 라벨 표시
- **위험도**: `riskScore` 기반 색상 구분
  - 0-30: 낮음 (초록)
  - 31-70: 중간 (노랑)
  - 71-100: 높음 (빨강)

### 2. 상황 분석 리포트 (summary)
- **형식**: 마크다운 렌더링 (`MarkdownRenderer` 컴포넌트)
- **내용**: 4개 섹션 포함
  1. `## 📊 상황 분석의 결과`
  2. `## ⚖️ 법적 관점에서 본 현재상황`
  3. `## 🎯 지금 당장 할 수 있는 행동`
  4. `## 💬 이렇게 말해보세요`

### 3. 법적 관점 (criteria)
- **표시 방식**: 
  - 번호 배지 (1, 2, 3...)
  - 상태 아이콘 (✅ 충족, ⚠️ 부분충족, ❌ 불충족)
  - 기준명 + 판단 이유
- **안내 문구**: "실제 법률 자문이 아닌, 공개된 가이드와 사례를 바탕으로 한 1차 정보입니다."

### 4. 행동 체크리스트 (actionPlan)
- **표시 방식**: 
  - `steps` 배열을 평탄화하여 모든 `items` 표시
  - 각 항목별 체크박스 (로컬 상태 `checkedItems`로 관리)
  - 완료 시 색상 변경 (초록 배경)
- **상태 관리**: `Set<string>`으로 체크된 항목 추적

### 5. 스크립트 (scripts)
- **toCompany**: 회사에 보낼 메시지 템플릿
  - 복사 버튼 포함
  - 보라색 테마
- **toAdvisor**: 상담 기관에 보낼 템플릿
  - 복사 버튼 포함
  - 파란색 테마
- **유사한 사례 더 보기**: 케이스 검색 페이지로 이동

### 6. 유사한 사례 (relatedCases)
- **표시 개수**: 최대 3개 (`slice(0, 3)`)
- **레이아웃**: 그리드 (1열 모바일, 2열 데스크톱)
- **클릭 동작**: `/legal/cases/${caseItem.id}`로 이동
- **표시 정보**: 제목 + 요약 (2줄 제한)

### 7. 즉시 상담 시작
- **기능**: 
  - 리포트 데이터를 `localStorage`에 저장
  - `situationAnalysisId` 포함
  - `/legal/assist/quick` 페이지로 이동
- **저장 데이터**:
  ```typescript
  {
    analysisResult: SituationAnalysisResponse
    summary: string
    details: string
    categoryHint: SituationCategory
    employmentType?: EmploymentType
    workPeriod?: WorkPeriod
    socialInsurance?: SocialInsurance
    situationAnalysisId?: string
  }
  ```

## UI 특징

### 색상 테마
- **리포트**: 인디고/보라 (`border-indigo-300`)
- **법적 관점**: 파랑 (`border-blue-300`)
- **행동 가이드**: 초록 (`border-emerald-300`)
- **스크립트**: 보라 (`border-purple-300`)
- **케이스**: 회색 (`border-slate-300`)

### 인터랙션
- ✅ 체크리스트 항목 클릭으로 완료 표시
- 📋 스크립트 복사 버튼
- 🔗 케이스 카드 클릭으로 상세 페이지 이동
- 💬 즉시 상담 시작 버튼

### 반응형 디자인
- 모바일: 1열 레이아웃
- 데스크톱: 2열 그리드 (케이스 카드)
- 유연한 flex 레이아웃

## 데이터 흐름

```
백엔드 응답 (v2 형식)
  ↓
프론트엔드 변환 (v1 형식으로 호환)
  ↓
analysisResult 상태 저장
  ↓
각 카드 컴포넌트에 전달
  ↓
UI 렌더링
```

## 백엔드 응답 형식 (v2)

```json
{
  "id": "situation_analysis_id",
  "tags": ["unpaid_wage"],
  "riskScore": 75,
  "analysis": {
    "summary": "마크다운 리포트...",
    "legalBasis": [
      {
        "title": "근로기준법 제43조",
        "status": "likely",
        "snippet": "..."
      }
    ],
    "recommendations": []
  },
  "checklist": ["증거 수집", "상담 신청"],
  "scripts": {
    "toCompany": "...",
    "toAdvisor": "..."
  },
  "relatedCases": [
    {
      "id": "case_id",
      "title": "케이스 제목",
      "summary": "케이스 요약"
    }
  ]
}
```

## 프론트엔드 변환 로직

v2 응답을 v1 형식으로 변환:
- `tags[0]` → `classifiedType`
- `riskScore` → `riskScore`
- `analysis.summary` → `summary`
- `analysis.legalBasis` → `criteria`
- `checklist` 또는 `summary` 파싱 → `actionPlan.steps`
- `scripts` → `scripts`
- `relatedCases` → `relatedCases`

