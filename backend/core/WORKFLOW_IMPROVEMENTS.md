# 상황분석 워크플로우 개선 사항

## 변경 요약

UI 요구사항에 맞춰 워크플로우와 프롬프트를 수정했습니다.

## 주요 변경 사항

### 1. ✅ summary 필드: 4개 섹션 마크다운 구조 강제 생성

**변경 전:**
- `generate_summary_node`에서 별도로 생성
- 구조화되지 않은 텍스트 가능

**변경 후:**
- `generate_action_guide_node`에서 `summary` 필드 생성
- 반드시 다음 4개 섹션 포함:
  1. `## 📊 상황 분석의 결과`
  2. `## ⚖️ 법적 관점에서 본 현재상황`
  3. `## 🎯 지금 당장 할 수 있는 행동`
  4. `## 💬 이렇게 말해보세요`

**프롬프트 변경:**
```python
"summary": "마크다운 형식 리포트 (아래 4개 섹션 필수 포함)"
```

### 2. ✅ criteria 생성: retrieve_guides → generate_action_guide 분리

**변경 전:**
- criteria 생성 책임이 불명확

**변경 후:**
- `retrieve_guides_node`: legalBasis 구조 추출 (`_extract_legal_basis`)
- `generate_action_guide_node`: legalBasis를 `{name, status, reason}` 형태로 가공

**구현:**
```python
# retrieve_guides_node에서
legal_basis = self._extract_legal_basis(grounding_chunks)

# generate_action_guide_node에서
legal_basis를 받아서 criteria로 변환
```

**프롬프트 변경:**
- `legal_basis` 파라미터 추가
- criteria 생성 시 legal_basis 참고하도록 지시

### 3. ✅ actionPlan: steps[{title, items[]}] 구조 강제화

**변경 전:**
- 단일 텍스트일 가능성
- UI에서 평탄화 불가

**변경 후:**
- 반드시 `steps` 배열 구조 사용
- 각 step은 `{title, items[]}` 형태
- items는 문자열 배열 (체크리스트용)

**프롬프트 변경:**
```json
"action_plan": {
    "steps": [
        {
            "title": "증거 수집",
            "items": ["구체적인 증거 수집 방법 1", "구체적인 증거 수집 방법 2"]
        }
    ]
}
```

### 4. ✅ scripts 구조화 확실히

**변경 전:**
- 구조화되지 않을 수 있음

**변경 후:**
- `to_company`: 회사에 보낼 문구 (실제 사용 가능)
- `to_advisor`: 상담 기관에 보낼 문구 (실제 사용 가능)
- 구체적이고 실용적인 문장으로 작성하도록 지시

### 5. ✅ relatedCases: 최대 3개만 반환

**변경 전:**
- 제한 없음

**변경 후:**
- `retrieve_guides_node`에서 `related_cases[:3]`로 제한
- `merge_output_node`에서도 `[:3]` 이중 안전장치

## 워크플로우 구조 변경

### 이전 구조
```
prepare_query → classify_situation → filter_rules → retrieve_guides 
→ generate_action_guide → generate_summary → merge_output
```

### 변경 후 구조
```
prepare_query → classify_situation → filter_rules → retrieve_guides 
→ generate_action_guide → merge_output
```

**변경 사항:**
- `generate_summary_node` 제거 (통합됨)
- `generate_action_guide_node`에서 summary, criteria, actionPlan, scripts 모두 생성

## State 모델 변경

### 추가된 필드
```python
legal_basis: Optional[List[Dict[str, Any]]]  # 법적 근거 구조 (criteria 가공용)
```

## 프롬프트 변경 사항

### build_situation_action_guide_prompt

**추가된 파라미터:**
- `legal_basis: List[Dict[str, Any]]` - criteria 생성용

**출력 스키마 변경:**
```json
{
    "summary": "4개 섹션 마크다운 (필수)",
    "criteria": [
        {
            "name": "판단 기준명",
            "status": "likely|unclear|unlikely",
            "reason": "판단 이유 및 설명"
        }
    ],
    "action_plan": {
        "steps": [
            {
                "title": "단계 제목",
                "items": ["항목1", "항목2"]
            }
        ]
    },
    "scripts": {
        "to_company": "회사에 보낼 문구",
        "to_advisor": "상담 기관에 보낼 문구"
    }
}
```

## UI 호환성

### 카드 1: 상황 분석 리포트 (summary)
- ✅ 4개 섹션 마크다운 구조
- ✅ `MarkdownRenderer`로 렌더링

### 카드 2: 법적 관점 (criteria)
- ✅ `{name, status, reason}` 구조
- ✅ 상태 아이콘 표시 (likely/unclear/unlikely)

### 카드 3: 행동 체크리스트 (actionPlan)
- ✅ `steps` 배열 평탄화 가능
- ✅ `items` 배열을 체크리스트로 표시

### 카드 4: 스크립트 (scripts)
- ✅ `toCompany`, `toAdvisor` 구조화
- ✅ 복사 버튼 지원

### 카드 5: 유사한 사례 (relatedCases)
- ✅ 최대 3개만 표시
- ✅ 클릭 시 상세 페이지 이동

## 테스트 체크리스트

- [ ] `generate_action_guide`에서 summary가 4개 섹션 포함하는지 확인
- [ ] criteria가 legal_basis 기반으로 생성되는지 확인
- [ ] actionPlan이 steps 구조로 생성되는지 확인
- [ ] scripts가 toCompany, toAdvisor 구조로 생성되는지 확인
- [ ] relatedCases가 최대 3개만 반환되는지 확인
- [ ] UI에서 모든 카드가 정상적으로 표시되는지 확인

## 다음 단계

1. 실제 테스트로 각 필드가 올바르게 생성되는지 확인
2. 필요시 프롬프트 미세 조정
3. 에러 처리 강화 (JSON 파싱 실패 시 fallback)

