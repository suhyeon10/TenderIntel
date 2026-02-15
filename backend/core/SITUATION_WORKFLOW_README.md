# 상황분석 LangGraph 워크플로우 가이드

## 개요

상황분석 RAG 시스템을 **단일 스텝 방식**에서 **LangGraph 기반 멀티 스텝 워크플로우**로 변경했습니다.

## 구조 변경

### 이전 구조 (단일 스텝)
```
사용자 입력 → RAG 검색 → LLM 진단 (한 번에 모든 것 생성) → 결과 반환
```

### 새로운 구조 (멀티 스텝)
```
사용자 입력
  ↓
1. prepare_query: 쿼리 텍스트 준비 + 임베딩 생성
  ↓
2. classify_situation: 상황 분류 (카테고리 + 위험도)
  ↓
3. filter_rules: 분류 결과 기반 규정 필터링
  ↓
4. retrieve_guides: RAG 검색 (필터링된 카테고리만)
  ↓
5. generate_action_guide: 행동 가이드 생성
  ↓
6. generate_summary: 최종 요약 리포트 생성
  ↓
7. merge_output: 최종 JSON 출력 병합
  ↓
결과 반환
```

## 파일 구조

```
backend/core/
├── situation_workflow.py      # LangGraph 워크플로우 정의
├── legal_rag_service.py       # 기존 서비스 (워크플로우 옵션 추가)
└── prompts.py                 # 단계별 프롬프트 함수
```

## 사용 방법

### 1. LangGraph 설치

```bash
pip install langgraph
```

### 1-1. LLM Provider 설정

상황분석 워크플로우는 환경변수 `LLM_PROVIDER`에 따라 Groq 또는 Ollama를 사용합니다.

**Groq 사용 시:**
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

**Ollama 사용 시:**
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

> **참고:** 상세한 LLM 설정 방법은 [LLM_SETUP.md](../../LLM_SETUP.md)를 참고하세요.

워크플로우 내부의 모든 LLM 호출(`classify_situation_node`, `generate_action_guide_node`, `generate_summary_node` 등)은 이 설정에 따라 자동으로 Groq 또는 Ollama를 사용합니다.

### 2. 워크플로우 사용

```python
from core.legal_rag_service import LegalRAGService

service = LegalRAGService()

# 워크플로우 사용 (새로운 방식)
result = await service.analyze_situation_detailed(
    category_hint="unpaid_wage",
    situation_text="3개월째 월급이 늦게 들어와요",
    summary="임금 체불",
    details="상세 설명...",
    employment_type="regular",
    use_workflow=True,  # 워크플로우 활성화
)

# 기존 방식 (레거시)
result = await service.analyze_situation_detailed(
    category_hint="unpaid_wage",
    situation_text="3개월째 월급이 늦게 들어와요",
    use_workflow=False,  # 기존 단일 스텝 방식
)
```

### 3. 직접 워크플로우 사용

```python
from core.situation_workflow import SituationWorkflow

workflow = SituationWorkflow()

initial_state = {
    "situation_text": "상황 설명",
    "category_hint": "unpaid_wage",
    "summary": "한 줄 요약",
    "details": "자세한 설명",
    "employment_type": "regular",
    "work_period": "1_3_years",
    "weekly_hours": 40,
    "is_probation": False,
    "social_insurance": "all",
}

result = await workflow.run(initial_state)
```

## State 모델

```python
class SituationWorkflowState(TypedDict):
    # 입력 데이터
    situation_text: str
    category_hint: Optional[str]
    summary: Optional[str]
    details: Optional[str]
    employment_type: Optional[str]
    work_period: Optional[str]
    weekly_hours: Optional[int]
    is_probation: Optional[bool]
    social_insurance: Optional[str]
    
    # 중간 결과
    query_text: Optional[str]
    query_embedding: Optional[List[float]]
    classification: Optional[Dict[str, Any]]
    filtered_categories: Optional[List[str]]
    grounding_chunks: Optional[List[LegalGroundingChunk]]
    related_cases: Optional[List[LegalCasePreview]]
    action_plan: Optional[Dict[str, Any]]
    scripts: Optional[Dict[str, str]]
    criteria: Optional[List[Dict[str, Any]]]
    
    # 최종 결과
    summary_report: Optional[str]
    final_output: Optional[Dict[str, Any]]
```

## 노드별 설명

### 1. prepare_query_node
- 쿼리 텍스트 구성 (summary + details 또는 situation_text)
- 임베딩 생성 (BAAI/bge-m3)

### 2. classify_situation_node
- LLM으로 상황 분류 (Groq/Ollama - 환경변수 `LLM_PROVIDER`에 따라 자동 선택)
- 카테고리 + 위험도 점수 계산
- 검색에 사용할 카테고리 키워드 추출

### 3. filter_rules_node
- 분류 결과 기반 규정 필터링
- 카테고리 매핑 또는 LLM 기반 필터링

### 4. retrieve_guides_node
- RAG 검색 (필터링된 카테고리만)
- 법령/매뉴얼 검색 (top-8)
- 케이스 검색 (top-3)

### 5. generate_action_guide_node
- 행동 가이드 생성 (Groq/Ollama - 환경변수 `LLM_PROVIDER`에 따라 자동 선택)
- 체크리스트, 스크립트, 판단 기준 생성

### 6. generate_summary_node
- 최종 요약 리포트 생성 (마크다운, Groq/Ollama - 환경변수 `LLM_PROVIDER`에 따라 자동 선택)
- 4개 섹션 포함:
  - 📊 상황 분석의 결과
  - ⚖️ 법적 관점에서 본 현재상황
  - 🎯 지금 당장 할 수 있는 행동
  - 💬 이렇게 말해보세요

### 7. merge_output_node
- 모든 노드 결과 병합
- 최종 JSON 형식 출력

## 프롬프트 함수

### build_situation_classify_prompt
- 상황 분류용 프롬프트
- 입력: 상황 텍스트, 사용자 정보
- 출력: {classified_type, risk_score, categories}

### build_situation_action_guide_prompt
- 행동 가이드 생성용 프롬프트
- 입력: 상황 텍스트, 분류 결과, 법령 청크
- 출력: {action_plan, scripts, criteria}

## 장점

1. **모듈화**: 각 단계가 독립적으로 실행 가능
2. **디버깅 용이**: 각 노드의 입력/출력 확인 가능
3. **확장성**: 새로운 노드 추가 용이
4. **조건부 분기**: 분류 결과에 따라 다른 경로 선택 가능
5. **재사용성**: 노드별 함수를 다른 곳에서도 사용 가능

## 마이그레이션 가이드

### 기존 코드
```python
result = await service.analyze_situation_detailed(
    category_hint="unpaid_wage",
    situation_text="...",
)
```

### 새로운 코드 (워크플로우 사용)
```python
result = await service.analyze_situation_detailed(
    category_hint="unpaid_wage",
    situation_text="...",
    use_workflow=True,  # 추가
)
```

기존 코드는 `use_workflow=False`가 기본값이므로 호환성 유지됩니다.

## 향후 개선 사항

1. **조건부 분기**: 분류 결과에 따라 다른 노드 경로 선택
2. **재시도 로직**: 노드 실패 시 재시도
3. **병렬 처리**: 독립적인 노드 병렬 실행
4. **캐싱**: 중간 결과 캐싱으로 성능 향상
5. **모니터링**: 각 노드 실행 시간 및 성공률 추적

