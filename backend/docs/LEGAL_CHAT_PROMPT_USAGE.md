# Legal Chat 프롬프트 사용 현황

## 📋 개요

`LEGAL_CHAT_SYSTEM_PROMPT`와 `build_legal_chat_prompt` 함수가 사용되는 모든 API 엔드포인트를 정리한 문서입니다.

---

## 🔧 사용되는 프롬프트

### 1. `LEGAL_CHAT_SYSTEM_PROMPT`
- **위치**: `backend/core/prompts.py` (14-133줄)
- **용도**: 법률 상담 챗의 기본 시스템 프롬프트
- **내용**: 역할 정의, 분석 원칙, 출력 형식 등

### 2. `build_legal_chat_prompt()`
- **위치**: `backend/core/prompts.py` (306-546줄)
- **용도**: 동적으로 프롬프트 구성
- **입력**: query, contract_chunks, legal_chunks, selected_issue, analysis_summary 등

---

## 📍 사용되는 API 엔드포인트

### 1. Agent 기반 통합 챗 API (모든 모드)

**엔드포인트**: `POST /api/v2/legal/agent/chat`

**모드별 사용**:
- ✅ **`mode=plain`**: 일반 Q&A
- ✅ **`mode=contract`**: 계약서 분석 + 챗
- ✅ **`mode=situation`**: 상황 분석 + 챗

**코드 위치**: `backend/api/routes_legal_v2.py:2646`
```python
chat_result = await legal_service.chat_with_context(
    query=message,
    doc_ids=[contract_analysis.id] if contract_analysis else [],
    selected_issue_id=None,
    analysis_summary=None,
    risk_score=None,
    total_issues=None,
    context_type=context_type,
    context_data=context_data,
)
```

**호출 경로**:
1. `legal_chat_agent()` → `chat_with_context()` → `_llm_chat_response()` → `build_legal_chat_prompt()`

---

### 2. 일반 법률 상담 챗 API (V2)

**엔드포인트**: `POST /api/v2/legal/chat`

**설명**: 계약서 분석 결과를 컨텍스트로 포함한 법률 상담 챗

**코드 위치**: `backend/api/routes_legal_v2.py:2028`
```python
result = await service.chat_with_context(
    query=payload.query,
    doc_ids=payload.docIds or [],
    selected_issue_id=payload.selectedIssueId,
    selected_issue=selected_issue,
    analysis_summary=payload.analysisSummary,
    risk_score=payload.riskScore,
    total_issues=payload.totalIssues,
    top_k=payload.topK or 8,
    context_type=context_type,
    context_data=prompt_context,
)
```

**호출 경로**:
1. `chat_with_contract()` → `chat_with_context()` → `_llm_chat_response()` → `build_legal_chat_prompt()`

---

### 3. 레거시 법률 상담 챗 API (V1)

**엔드포인트**: `POST /api/legal/chat` (또는 `/api/v1/legal/chat`)

**설명**: 계약서 분석 결과를 컨텍스트로 포함한 법률 상담 챗 (레거시)

**코드 위치**: `backend/api/routes_legal.py:191`
```python
result = await service.chat_with_context(
    query=body.query,
    doc_ids=body.doc_ids,
    selected_issue_id=body.selected_issue_id,
    selected_issue=body.selected_issue,
    analysis_summary=body.analysis_summary,
    risk_score=body.risk_score,
    total_issues=body.total_issues,
    top_k=body.top_k,
)
```

**호출 경로**:
1. `legal_chat_api()` → `chat_with_context()` → `_llm_chat_response()` → `build_legal_chat_prompt()`

---

## 🔄 공통 호출 흐름

모든 API는 다음 공통 흐름을 따릅니다:

```
API 엔드포인트
  ↓
chat_with_context() (legal_rag_service.py)
  ↓
_llm_chat_response() (legal_rag_service.py)
  ↓
build_legal_chat_prompt() (prompts.py)
  ↓
LEGAL_CHAT_SYSTEM_PROMPT (prompts.py)
```

---

## 📊 사용 현황 요약

| API 엔드포인트 | 모드/타입 | 프롬프트 사용 | 비고 |
|---------------|----------|-------------|------|
| `POST /api/v2/legal/agent/chat` | `mode=plain` | ✅ | Agent API - 일반 Q&A |
| `POST /api/v2/legal/agent/chat` | `mode=contract` | ✅ | Agent API - 계약서 분석 |
| `POST /api/v2/legal/agent/chat` | `mode=situation` | ✅ | Agent API - 상황 분석 |
| `POST /api/v2/legal/chat` | 일반 챗 | ✅ | V2 챗 API |
| `POST /api/legal/chat` | 일반 챗 | ✅ | 레거시 챗 API |

---

## 🔍 코드 참조

### `chat_with_context()` 메서드
- **위치**: `backend/core/legal_rag_service.py:453`
- **역할**: RAG 검색 + LLM 답변 생성

### `_llm_chat_response()` 메서드
- **위치**: `backend/core/legal_rag_service.py:1930`
- **역할**: 프롬프트 구성 + LLM 호출
- **프롬프트 사용**: `build_legal_chat_prompt()` 호출 (2099줄)

### `build_legal_chat_prompt()` 함수
- **위치**: `backend/core/prompts.py:306`
- **역할**: 동적 프롬프트 구성
- **시스템 프롬프트 포함**: `LEGAL_CHAT_SYSTEM_PROMPT` (480줄)

---

## ⚠️ 주의사항

1. **프롬프트 수정 시 영향 범위**
   - `LEGAL_CHAT_SYSTEM_PROMPT`를 수정하면 **모든 챗 API에 영향**
   - `build_legal_chat_prompt()`를 수정하면 **모든 챗 API에 영향**

2. **테스트 필요성**
   - 프롬프트 수정 시 다음 API들을 모두 테스트해야 함:
     - Agent API (plain, contract, situation 모드)
     - V2 챗 API
     - 레거시 챗 API

3. **호환성 유지**
   - 기존 API와의 호환성을 위해 프롬프트 구조 변경 시 주의 필요
   - JSON 응답 형식이 변경되면 프론트엔드도 함께 수정 필요

---

## 📚 관련 문서

- [Agent API 명세서](./AGENT_API_SPEC.md)
- [Agent API 테스트 예시](./AGENT_API_TEST_EXAMPLES.md)
- [프롬프트 개선 가이드](../PROMPT_IMPROVEMENTS.md)

