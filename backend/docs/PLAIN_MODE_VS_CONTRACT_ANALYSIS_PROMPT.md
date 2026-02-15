# Plain 모드 vs 계약서 분석 프롬프트 비교

## 📋 개요

Plain 모드에서 사용되는 프롬프트와 계약서 분석에서 사용되는 프롬프트는 **서로 다릅니다**.

---

## 🔍 프롬프트 비교

### 1. Plain 모드 (챗)

**프롬프트**: `LEGAL_CHAT_SYSTEM_PROMPT` + `build_legal_chat_prompt()`

**위치**: `backend/core/prompts.py`
- 시스템 프롬프트: 14-133줄 (`LEGAL_CHAT_SYSTEM_PROMPT`)
- 프롬프트 빌더: 306-546줄 (`build_legal_chat_prompt()`)

**용도**: 
- 계약서 분석 결과를 **참고하여 질문에 답변**
- 사용자가 "이 조항은 무엇을 의미하나요?" 같은 질문에 답변
- 계약서 분석 리포트를 컨텍스트로 활용

**특징**:
- 계약서 분석 결과를 **이미 받은 상태**에서 질문에 답변
- JSON 형식 응답 (ParsedLegalResponse)
- 계약서 조항 원문, 선택된 이슈 정보, 분석 요약 등을 컨텍스트로 사용

**사용 위치**:
- `POST /api/v2/legal/agent/chat` (mode=plain)
- `POST /api/v2/legal/chat`
- `POST /api/legal/chat`

---

### 2. 계약서 분석

**프롬프트**: `CONTRACT_ANALYSIS_SYSTEM_PROMPT` + `build_contract_analysis_prompt()`

**위치**: `backend/core/prompts.py`
- 시스템 프롬프트: 835-845줄 (`CONTRACT_ANALYSIS_SYSTEM_PROMPT`)
- 프롬프트 빌더: 848-1098줄 (`build_contract_analysis_prompt()`)

**용도**:
- 계약서를 **처음부터 분석하여 위험 조항 식별**
- 계약서 전체를 검토하여 문제점 찾기
- JSON 형식으로 issues 배열 반환

**특징**:
- 계약서 전체 텍스트를 분석
- 9개 항목별로 체계적으로 분석 (돈·대금, 업무 범위, 기간·해지 등)
- 독소조항 탐지
- JSON 형식 응답 (risk_score, risk_level, issues 배열)

**사용 위치**:
- `POST /api/v2/legal/analyze-contract`
- `POST /api/v2/legal/agent/chat` (mode=contract, 첫 요청 시)

---

## 📊 비교표

| 항목 | Plain 모드 (챗) | 계약서 분석 |
|------|----------------|------------|
| **시스템 프롬프트** | `LEGAL_CHAT_SYSTEM_PROMPT` | `CONTRACT_ANALYSIS_SYSTEM_PROMPT` |
| **프롬프트 빌더** | `build_legal_chat_prompt()` | `build_contract_analysis_prompt()` |
| **목적** | 질문에 답변 | 위험 조항 식별 |
| **입력** | 사용자 질문 + 분석 결과 참고 | 계약서 전체 텍스트 |
| **출력 형식** | JSON (ParsedLegalResponse) | JSON (risk_score, issues) |
| **컨텍스트** | 계약서 분석 결과 참고 | 계약서 원문 직접 분석 |
| **사용 시점** | 분석 후 질문 | 분석 수행 |

---

## 🔄 사용 흐름

### Plain 모드 (챗)
```
1. 계약서 분석 완료 (이미 위험 조항 식별됨)
   ↓
2. 사용자 질문: "이 조항은 무엇을 의미하나요?"
   ↓
3. LEGAL_CHAT_SYSTEM_PROMPT 사용
   ↓
4. 분석 결과를 컨텍스트로 활용하여 답변 생성
```

### 계약서 분석
```
1. 계약서 업로드
   ↓
2. 계약서 전체 텍스트 분석
   ↓
3. CONTRACT_ANALYSIS_SYSTEM_PROMPT 사용
   ↓
4. 위험 조항 식별 및 issues 배열 생성
```

---

## 💡 핵심 차이점

### 1. 목적
- **Plain 모드**: 이미 분석된 결과를 바탕으로 **질문에 답변**
- **계약서 분석**: 계약서를 **처음부터 분석**하여 위험 조항 찾기

### 2. 프롬프트 내용
- **Plain 모드**: 
  - "이 조항이 무엇을 의미하는지 설명하세요"
  - "법적으로 어느 정도 위험한지 평가하세요"
  - "실무에서 어떻게 수정·협상하면 좋은지 제안하세요"
  
- **계약서 분석**:
  - "계약서를 9개 항목별로 분석하세요"
  - "독소조항을 탐지하세요"
  - "각 이슈에 clause_id를 지정하세요"

### 3. 출력 형식
- **Plain 모드**: 
  ```json
  {
    "summary": "...",
    "riskLevel": "보통",
    "riskContent": [...],
    "checklist": [...],
    "negotiationPoints": {...},
    "legalReferences": [...]
  }
  ```

- **계약서 분석**:
  ```json
  {
    "risk_score": 65,
    "risk_level": "medium",
    "summary": "...",
    "issues": [
      {
        "name": "...",
        "clause_id": "clause-1",
        "severity": "high",
        ...
      }
    ]
  }
  ```

---

## ⚠️ 주의사항

1. **프롬프트 수정 시 영향 범위**
   - `LEGAL_CHAT_SYSTEM_PROMPT` 수정 → 모든 챗 API에 영향
   - `CONTRACT_ANALYSIS_SYSTEM_PROMPT` 수정 → 계약서 분석 API에만 영향

2. **서로 다른 목적**
   - Plain 모드는 **질문 답변**용
   - 계약서 분석은 **위험 조항 식별**용
   - 두 프롬프트를 혼용하면 안 됨

3. **Agent API의 contract 모드**
   - 첫 요청: 계약서 분석 수행 (`CONTRACT_ANALYSIS_SYSTEM_PROMPT` 사용)
   - 후속 요청: 챗 답변 생성 (`LEGAL_CHAT_SYSTEM_PROMPT` 사용)

---

## 📚 관련 문서

- [Legal Chat 프롬프트 사용 현황](./LEGAL_CHAT_PROMPT_USAGE.md)
- [Agent API 명세서](./AGENT_API_SPEC.md)

