# /legal/situation 페이지 데이터 흐름 검토 보고서

## 📊 전체 데이터 흐름

### 1단계: LLM 프롬프트 요구사항
**파일**: `backend/core/prompts.py:343-404`

LLM이 반환해야 하는 JSON 형식:
```json
{
    "classified_type": "harassment|unpaid_wage|unfair_dismissal|overtime|probation|unknown",
    "risk_score": 0~100,
    "summary": "마크다운 형식 텍스트 (4개 섹션 포함)",
    "criteria": [
        {
            "name": "판단 기준명",
            "status": "likely|unclear|unlikely",  // ⚠️ 중요
            "reason": "판단 이유 및 설명"
        }
    ],
    "action_plan": {
        "steps": [
            {
                "title": "증거 수집",
                "items": ["구체적인 증거 수집 방법"]
            },
            {
                "title": "1차 대응",
                "items": ["초기 대응 방법"]
            }
        ]
    },
    "scripts": {
        "to_company": "회사에 보낼 문구",
        "to_advisor": "상담 시 쓸 설명"
    }
}
```

### 2단계: LLM 응답 파싱
**파일**: `backend/core/legal_rag_service.py:1056-1070`

- JSON 추출 및 파싱
- `diagnosis.get("criteria")` - 그대로 반환 (status 포함)
- `diagnosis.get("action_plan")` - 그대로 반환
- `diagnosis.get("scripts")` - 그대로 반환

**반환 형식**:
```python
{
    "classified_type": str,
    "risk_score": int,
    "summary": str,
    "criteria": List[{"name": str, "status": str, "reason": str}],
    "action_plan": {"steps": List[{"title": str, "items": List[str]}]},
    "scripts": {"to_company": str, "to_advisor": str},
    "related_cases": []  # 나중에 추가됨
}
```

### 3단계: v2 API 변환
**파일**: `backend/api/routes_legal_v2.py:784-844`

**변환 로직**:
1. `criteria` → `legalBasis`: `{name, reason}` → `{title, snippet}` ⚠️ **status 손실**
2. `action_plan.steps[].items` → `checklist` (모든 steps의 items 병합)
3. `action_plan.steps[].items` → `recommendations` (모든 steps의 items 병합) ⚠️ **checklist와 동일**
4. `scripts.to_company` → `scripts.toCompany` (camelCase 변환)
5. `related_cases` → `relatedCases`

**v2 API 응답 형식**:
```python
SituationResponseV2(
    riskScore: float,
    riskLevel: "low"|"medium"|"high",
    tags: List[str],  # [classified_type]
    analysis: {
        summary: str,
        legalBasis: List[{title: str, snippet: str, sourceType: str}],
        recommendations: List[str]  # 모든 action_plan.steps[].items 병합
    },
    checklist: List[str],  # 모든 action_plan.steps[].items 병합 (recommendations와 동일)
    scripts: {toCompany: str, toAdvisor: str},
    relatedCases: List[{id: str, title: str, summary: str, link: None}]
)
```

### 4단계: 프론트엔드 변환
**파일**: `src/app/legal/situation/page.tsx:310-342`

**변환 로직**:
1. `tags[0]` → `classifiedType`
2. `analysis.legalBasis` → `criteria`: `{title, snippet}` → `{name, status: 'likely', reason}` ⚠️ **status 항상 'likely'로 하드코딩**
3. `checklist.slice(0, 3)` → `actionPlan.steps[0].items` ("즉시 조치")
4. `analysis.recommendations` → `actionPlan.steps[1].items` ("권고사항")
5. `scripts` → 그대로 사용
6. `relatedCases` → 그대로 사용

**UI가 기대하는 형식**:
```typescript
SituationAnalysisResponse {
    classifiedType: SituationCategory,
    riskScore: number,
    summary: string,
    criteria: Array<{name: string, status: 'likely'|'unclear'|'unlikely', reason: string}>,
    actionPlan: {
        steps: Array<{title: string, items: string[]}>
    },
    scripts: {toCompany?: string, toAdvisor?: string},
    relatedCases: Array<{id: string, title: string, summary: string}>
}
```

## ⚠️ 발견된 문제점

### 1. **criteria.status 필드 손실** (중요)
- **문제**: LLM이 반환하는 `criteria[].status` (likely/unclear/unlikely)가 v2 API 변환 과정에서 손실됨
- **현재**: 프론트엔드에서 항상 `'likely'`로 하드코딩
- **영향**: UI에서 판단 기준의 충족 여부를 정확히 표시할 수 없음
- **위치**: 
  - `backend/api/routes_legal_v2.py:792-798` - status 필드 변환 누락
  - `src/app/legal/situation/page.tsx:318` - status 하드코딩

### 2. **checklist와 recommendations 중복**
- **문제**: v2 API에서 `action_plan.steps[].items`를 checklist와 recommendations 둘 다에 넣음
- **현재**: 프론트엔드에서 checklist는 "즉시 조치", recommendations는 "권고사항"으로 다르게 표시
- **영향**: 두 섹션이 동일한 내용을 표시할 수 있음
- **위치**: `backend/api/routes_legal_v2.py:800-809`

### 3. **action_plan.steps 구조 손실**
- **문제**: LLM이 반환하는 `action_plan.steps[].title` 정보가 v2 API에서 손실됨
- **현재**: 프론트엔드에서 "즉시 조치", "권고사항"으로 하드코딩
- **영향**: LLM이 제공하는 단계별 제목을 활용할 수 없음
- **위치**: `backend/api/routes_legal_v2.py:800-809`

## ✅ 정상 작동하는 부분

1. **기본 필드 변환**: `classified_type`, `risk_score`, `summary` 정상 변환
2. **scripts 변환**: snake_case → camelCase 정상 변환
3. **relatedCases 변환**: 정상 변환
4. **안전성 검사**: 프론트엔드에서 옵셔널 체이닝과 기본값 제공 완료

## 🔧 권장 수정 사항

### 1. criteria.status 필드 보존
```python
# backend/api/routes_legal_v2.py:792-798
legal_basis = []
for criteria in result.get("criteria", []):
    legal_basis.append({
        "title": criteria.get("name", ""),
        "snippet": criteria.get("reason", ""),
        "status": criteria.get("status", "likely"),  # 추가
        "sourceType": "law",
    })
```

```typescript
// src/app/legal/situation/page.tsx:316-320
criteria: (result?.analysis?.legalBasis || []).map(basis => ({
  name: basis?.title || '',
  status: (basis?.status || 'likely') as 'likely' | 'unclear' | 'unlikely',  // 수정
  reason: basis?.snippet || '',
})),
```

### 2. checklist와 recommendations 구분
```python
# backend/api/routes_legal_v2.py:800-809
# 첫 번째 step은 checklist, 나머지는 recommendations로 분리
action_plan = result.get("action_plan", {})
steps = action_plan.get("steps", [])

checklist = []
recommendations = []

if len(steps) > 0:
    checklist = steps[0].get("items", [])  # 첫 번째 step만
    for step in steps[1:]:  # 나머지 steps
        recommendations.extend(step.get("items", []))
```

### 3. action_plan.steps 구조 보존 (선택사항)
v2 API 스펙을 확장하여 steps 구조를 보존하는 것을 고려할 수 있습니다.

## 📝 결론

**전체적인 데이터 흐름은 정상 작동하지만, 다음 문제점이 있습니다:**

1. ⚠️ **criteria.status 필드 손실** - UI에서 판단 기준의 충족 여부를 정확히 표시할 수 없음
2. ⚠️ **checklist와 recommendations 중복** - 두 섹션이 동일한 내용을 표시할 수 있음
3. ℹ️ **action_plan.steps 구조 손실** - LLM이 제공하는 단계별 제목을 활용할 수 없음

**우선순위**: 
- 높음: criteria.status 필드 보존
- 중간: checklist와 recommendations 구분
- 낮음: action_plan.steps 구조 보존

