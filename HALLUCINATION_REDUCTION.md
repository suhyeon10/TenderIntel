# 환각(Hallucination) 줄이기 전략

법률 AI 서비스에서 가장 중요한 것은 **정확성과 신뢰성**입니다. Linkus Legal은 다음과 같은 방법으로 AI 환각을 최소화하고 검증 가능한 결과를 제공합니다.

## 📑 목차

1. [Hybrid Search + MMR](#1-hybrid-search--mmr-maximum-marginal-relevance)
2. [도메인 필터링](#2-도메인-필터링-document-type-filtering)
3. [출력 제약](#3-출력-제약-output-constraints)
4. [리스크 스코어 계산 방식](#4-리스크-스코어-계산-방식)
5. [검증 가능한 결과 제공](#5-검증-가능한-결과-제공)

---

## 1. Hybrid Search + MMR (Maximum Marginal Relevance)

### 키워드 매칭 + 벡터 검색 동시 수행
- 벡터 검색만으로는 놓칠 수 있는 정확한 법조문 매칭을 키워드 검색으로 보완
- 두 검색 결과를 가중치 조합 (벡터 0.7, 키워드 0.3)하여 최종 결과 도출

### MMR 재랭킹으로 중복 제거
- 동일하거나 유사한 조문이 중복으로 검색되는 것을 방지
- 유사도와 다양성의 균형을 맞춰 다양한 관점의 법령을 제공
- `mmr_diversity` 파라미터로 다양성 조절 (0-1, 높을수록 다양)

**구현 위치**: `backend/core/tools/vector_search_tool.py`

---

## 2. 도메인 필터링 (Document Type Filtering)

### 문서 타입별 분리 검색
- `laws`: 법령 (근로기준법, 노동법 등)
- `standard_contracts`: 표준 계약서 템플릿
- `manuals`: 고용노동부 매뉴얼 및 가이드
- `cases`: 실제 케이스 및 시나리오

### 맥락에 맞는 문서 타입 우선 검색
- 계약서 위험 분석 시: `laws` + `standard_contracts` 위주로 검색
- 괴롭힘/성희롭 상담 시: `manuals` + `cases` 위주로 검색
- 각 분석 목적에 맞는 문서 타입만 필터링하여 관련성 높은 결과만 제공

**구현 위치**: `backend/api/routes_legal_v2.py` (doc_type 파라미터)

---

## 3. 출력 제약 (Output Constraints)

### LLM 프롬프트에 엄격한 규칙 부여
- **반드시 `retrievedContexts` 안에서만 인용**: 검색된 법령/조문만 참조하도록 제한
- **법조문 번호 없으면 '관련 법령 추정'으로만 표기**: 확실하지 않은 법조문 번호는 표기하지 않음
- **출처 명시 필수**: 모든 법적 근거에 출처(source_type, title) 포함

**구현 위치**: `backend/core/legal_rag_service.py` (`_llm_summarize_risk` 메서드)

---

## 4. 리스크 스코어 계산 방식

### 가중치 기반 위험도 산정
```
riskScore = Σ(조항별 위험도 × 카테고리 가중치)
```

### 카테고리별 가중치 (청년에게 치명적인 영역에 더 높은 weight)
- `wage` (임금): 0.30 - 임금 체불은 청년에게 가장 치명적
- `working_hours` (근로시간): 0.25 - 과로 및 연장근로 문제
- `probation_termination` (수습/해고): 0.25 - 수습 기간 중 부당 해고
- `stock_option_ip` (스톡옵션/IP): 0.20 - 상대적으로 덜 치명적

### 이중 검증 시스템
- **규칙 기반 점수 (50%)**: 키워드 매칭, 필수 조항 누락, 불법 조항 포함 여부
- **LLM 기반 점수 (50%)**: 법령 컨텍스트 기반 위험도 평가
- 두 점수를 가중 평균하여 최종 위험도 산정

**구현 위치**: `backend/core/tools/risk_scoring_tool.py`

---

## 5. 검증 가능한 결과 제공

### 모든 분석 결과에 출처 포함
- `retrievedContexts`: 분석에 사용된 법령/조문 목록
- `legalBasis`: 각 이슈별 관련 법조문 번호
- `sourceType`, `title`: 문서 출처 명시

### 사용자가 직접 확인 가능
- 계약서 전문(`contractText`) 제공으로 사용자가 직접 검증 가능
- 각 위험 조항의 원문(`originalText`) 표시
- 관련 법령 링크 및 출처 제공

---

## 결론

이러한 설계를 통해 **"그냥 AI가 만들어낸 답변"이 아닌 "검증 가능한 법적 근거 기반 분석"**을 제공합니다.

---

## 추가 정보

- LLM Toolchain 아키텍처: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Legal RAG 가이드: [LEGAL_RAG_GUIDE.md](./LEGAL_RAG_GUIDE.md)

