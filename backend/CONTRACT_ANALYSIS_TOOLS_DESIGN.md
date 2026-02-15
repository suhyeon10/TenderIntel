# 계약서 분석 백엔드 도구화 설계 문서

## 📋 개요

계약서 분석 백엔드 로직을 독립적인 도구(Tool)로 분리하여 모듈화하고, 각 도구가 명확한 입력/출력을 가지도록 설계합니다.

## 🎯 목표

1. **모듈화**: 각 기능을 독립적인 도구로 분리
2. **재사용성**: 도구를 조합하여 다양한 분석 파이프라인 구성
3. **테스트 용이성**: 각 도구를 독립적으로 테스트 가능
4. **확장성**: 새로운 도구 추가 용이

## 🛠️ 도구 구조

### 1. DocumentParserTool
**역할**: 문서에서 텍스트 추출 및 구조화

**입력**:
- `file_path: str` - 파일 경로
- `file_type: Optional[str]` - 파일 타입 (pdf, hwp, hwpx, html, txt)

**출력**:
```python
{
    "extracted_text": str,  # 추출된 전체 텍스트
    "chunks": List[Chunk],  # 조항 단위 청크
    "provisions": List[Provision],  # 조항 정보 (제n조)
    "metadata": {
        "file_type": str,
        "page_count": int,
        "total_chars": int,
        "provision_count": int
    }
}
```

**구현 위치**: `backend/core/tools/document_parser_tool.py`

**기존 코드 활용**:
- `DocumentProcessor` (document_processor_v2.py)
- `LegalChunker` (legal_chunker.py)

**주요 기능**:
- ✅ OCR (PyMuPDF, pdfplumber, pytesseract)
- ✅ 조항 단위 청킹 (제n조 패턴 분석)
- ✅ 조항 번호/패턴 분석 (제n조, 제n장, 제n절 등)
- ✅ 메타데이터 추출

---

### 2. ProvisionMatchingTool
**역할**: 표준근로계약서와 의미 기반 매칭 및 누락/과도 조항 탐지

**입력**:
- `contract_text: str` - 계약서 텍스트
- `contract_provisions: List[Provision]` - 계약서 조항 리스트
- `standard_contract_type: str` - 표준 계약서 타입 (employment, freelance 등)

**출력**:
```python
{
    "matched_provisions": List[MatchedProvision],  # 매칭된 조항
    "missing_provisions": List[Provision],  # 누락된 필수 조항
    "excessive_provisions": List[Provision],  # 과도한 조항
    "matching_scores": Dict[str, float],  # 각 조항별 매칭 점수
    "summary": str  # 매칭 결과 요약
}
```

**구현 위치**: `backend/core/tools/provision_matching_tool.py`

**주요 기능**:
- ✅ 표준근로계약서 템플릿 로드
- ✅ 의미 기반 매칭 (임베딩 유사도)
- ✅ 누락 조항 탐지 (필수 조항 체크리스트)
- ✅ 과도 조항 탐지 (불필요한 조항 식별)

**의존성**:
- `VectorSearchTool` - 표준 계약서 검색
- `LLMGenerator` - 의미 기반 매칭

---

### 3. VectorSearchTool
**역할**: 법령 + 표준계약 + 가이드라인 검색

**입력**:
- `query: str` - 검색 쿼리
- `doc_types: List[str]` - 문서 타입 필터 (law, standard_contract, manual, case)
- `top_k: int` - 검색 결과 개수
- `use_hybrid: bool` - Hybrid Search 사용 여부
- `use_mmr: bool` - MMR 재랭킹 사용 여부

**출력**:
```python
{
    "results": List[SearchResult],
    "count": int,
    "query": str,
    "search_type": str  # "vector" | "hybrid" | "mmr"
}
```

**구현 위치**: `backend/core/tools/vector_search_tool.py`

**기존 코드 활용**:
- `SupabaseVectorStore` (supabase_vector_store.py)
- `LegalRAGService._search_legal_chunks` (legal_rag_service.py)

**주요 기능**:
- ✅ 벡터 검색 (의미 기반)
- ✅ Hybrid Search (키워드 + 벡터)
- ✅ MMR (Maximum Marginal Relevance) 재랭킹
- ✅ 최신 법령 필터링 (날짜 기반)
- ✅ 문서 타입별 필터링

**검색 전략**:
1. **벡터 검색**: 임베딩 유사도 기반
2. **Hybrid Search**: 
   - 벡터 검색 결과 + 키워드 검색 결과
   - 가중치 조합 (벡터 0.7, 키워드 0.3)
3. **MMR 재랭킹**:
   - 다양성 확보를 위한 재랭킹
   - 유사도와 다양성 균형

---

### 4. RiskScoringTool
**역할**: 각 조항별 위험도 산정 및 전체 위험 스코어 생성

**입력**:
- `provisions: List[Provision]` - 계약서 조항 리스트
- `matched_provisions: List[MatchedProvision]` - 표준 계약서 매칭 결과
- `legal_contexts: List[SearchResult]` - 관련 법령 검색 결과
- `contract_type: str` - 계약서 타입

**출력**:
```python
{
    "provision_risks": List[ProvisionRisk],  # 각 조항별 위험도
    "overall_risk_score": float,  # 전체 위험도 (0-100)
    "risk_level": str,  # "low" | "medium" | "high"
    "risk_breakdown": {
        "working_hours": float,  # 근로시간 관련 위험도
        "wage": float,  # 임금 관련 위험도
        "probation_termination": float,  # 수습/해고 관련 위험도
        "stock_option_ip": float  # 스톡옵션/IP 관련 위험도
    },
    "critical_issues": List[str]  # 심각한 이슈 목록
}
```

**구현 위치**: `backend/core/tools/risk_scoring_tool.py`

**주요 기능**:
- ✅ 조항별 위험도 산정 (규칙 기반 + LLM)
- ✅ 전체 위험 스코어 계산 (가중 평균)
- ✅ 영역별 위험도 분류 (근로시간, 임금, 해고 등)
- ✅ 위험도 레벨 분류 (low/medium/high)

**위험도 산정 로직**:
1. **규칙 기반 점수** (50%):
   - 필수 조항 누락: +30점
   - 불법 조항 포함: +40점
   - 모호한 표현: +20점
2. **LLM 기반 점수** (50%):
   - 법령 컨텍스트 기반 위험도 평가
   - 조항의 법적 적합성 판단

---

### 5. LLMExplanationTool
**역할**: 위험 사유 자연어 설명, 법령 조문 인용, 수정 제안 문구 생성

**입력**:
- `provision: Provision` - 분석할 조항
- `risk_score: float` - 위험도 점수
- `legal_contexts: List[SearchResult]` - 관련 법령
- `issue_type: str` - 이슈 타입 (missing, excessive, illegal 등)

**출력**:
```python
{
    "explanation": str,  # 위험 사유 설명
    "legal_basis": List[str],  # 관련 법령 조문
    "suggested_revision": str,  # 수정 제안 문구
    "rationale": str,  # 수정 이유
    "suggested_questions": List[str]  # 회사에 질문할 문구
}
```

**구현 위치**: `backend/core/tools/llm_explanation_tool.py`

**기존 코드 활용**:
- `LLMGenerator` (generator_v2.py)
- `LegalRAGService._llm_summarize_risk` (legal_rag_service.py)

**주요 기능**:
- ✅ 위험 사유 자연어 설명 생성
- ✅ 법령 조문 인용 (자동 추출)
- ✅ 수정 제안 문구 생성
- ✅ 협상용 질문 스크립트 생성

---

## 🔄 도구 조합 파이프라인

### 계약서 분석 전체 파이프라인

```python
async def analyze_contract_pipeline(file_path: str, contract_type: str):
    # 1. 문서 파싱
    parser = DocumentParserTool()
    parse_result = await parser.parse(file_path)
    
    # 2. 조항 매칭
    matcher = ProvisionMatchingTool()
    match_result = await matcher.match(
        contract_text=parse_result.extracted_text,
        contract_provisions=parse_result.provisions,
        standard_contract_type=contract_type
    )
    
    # 3. 법령 검색
    searcher = VectorSearchTool()
    search_result = await searcher.search(
        query=parse_result.extracted_text[:2000],  # 계약서 요약
        doc_types=["law", "standard_contract", "manual"],
        top_k=10,
        use_hybrid=True,
        use_mmr=True
    )
    
    # 4. 위험도 산정
    scorer = RiskScoringTool()
    risk_result = await scorer.score(
        provisions=parse_result.provisions,
        matched_provisions=match_result.matched_provisions,
        legal_contexts=search_result.results,
        contract_type=contract_type
    )
    
    # 5. 설명 생성 (각 이슈별)
    explainer = LLMExplanationTool()
    issues = []
    for provision_risk in risk_result.provision_risks:
        if provision_risk.risk_score > 30:  # 위험도 30 이상만
            explanation = await explainer.explain(
                provision=provision_risk.provision,
                risk_score=provision_risk.risk_score,
                legal_contexts=search_result.results,
                issue_type=provision_risk.issue_type
            )
            issues.append({
                "provision": provision_risk.provision,
                "risk_score": provision_risk.risk_score,
                "explanation": explanation
            })
    
    # 최종 결과 반환
    return {
        "doc_id": parse_result.metadata.get("doc_id"),
        "contract_text": parse_result.extracted_text,
        "provisions": parse_result.provisions,
        "matched_provisions": match_result.matched_provisions,
        "missing_provisions": match_result.missing_provisions,
        "risk_score": risk_result.overall_risk_score,
        "risk_level": risk_result.risk_level,
        "risk_breakdown": risk_result.risk_breakdown,
        "issues": issues,
        "legal_contexts": search_result.results
    }
```

---

## 📁 파일 구조

```
backend/
├── core/
│   ├── tools/                    # 새로 생성
│   │   ├── __init__.py
│   │   ├── document_parser_tool.py
│   │   ├── provision_matching_tool.py
│   │   ├── vector_search_tool.py
│   │   ├── risk_scoring_tool.py
│   │   └── llm_explanation_tool.py
│   ├── orchestrator_v3.py       # 도구 조합 오케스트레이터
│   ├── document_processor_v2.py  # 기존 (활용)
│   ├── legal_chunker.py          # 기존 (활용)
│   ├── legal_rag_service.py      # 기존 (활용)
│   ├── generator_v2.py           # 기존 (활용)
│   └── supabase_vector_store.py  # 기존 (활용)
```

---

## 🔌 인터페이스 정의

### BaseTool (추상 클래스)

```python
from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseTool(ABC):
    """모든 도구의 기본 클래스"""
    
    @abstractmethod
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """도구 실행"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """도구 이름"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """도구 설명"""
        pass
```

---

## 📊 데이터 모델

### Provision (조항)

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Provision:
    """계약서 조항"""
    id: str
    title: str  # "제1조 (목적)"
    content: str  # 조항 본문
    article_number: Optional[int] = None  # 조 번호
    start_index: int = 0  # 원문에서 시작 위치
    end_index: int = 0  # 원문에서 종료 위치
    category: Optional[str] = None  # "working_hours", "wage" 등
```

### MatchedProvision (매칭된 조항)

```python
@dataclass
class MatchedProvision:
    """표준 계약서와 매칭된 조항"""
    provision: Provision
    standard_provision: Provision  # 표준 계약서 조항
    similarity_score: float  # 유사도 점수 (0-1)
    match_type: str  # "exact" | "semantic" | "partial"
```

### ProvisionRisk (조항 위험도)

```python
@dataclass
class ProvisionRisk:
    """조항별 위험도"""
    provision: Provision
    risk_score: float  # 위험도 (0-100)
    issue_type: str  # "missing" | "excessive" | "illegal" | "ambiguous"
    severity: str  # "low" | "medium" | "high"
    reasons: List[str]  # 위험 사유
```

---

## 🚀 구현 단계

### Phase 1: 기본 도구 구현 (1주)
- [ ] `DocumentParserTool` 구현
- [ ] `VectorSearchTool` 구현
- [ ] 기본 테스트 작성

### Phase 2: 매칭 및 위험도 산정 (1주)
- [ ] `ProvisionMatchingTool` 구현
- [ ] `RiskScoringTool` 구현
- [ ] 통합 테스트 작성

### Phase 3: LLM 설명 도구 (1주)
- [ ] `LLMExplanationTool` 구현
- [ ] 프롬프트 최적화
- [ ] 성능 테스트

### Phase 4: 오케스트레이터 및 통합 (1주)
- [ ] `OrchestratorV3` 구현
- [ ] 기존 API와 통합
- [ ] 문서화

---

## 📝 사용 예시

### 개별 도구 사용

```python
# 1. 문서 파싱
parser = DocumentParserTool()
result = await parser.parse("contract.pdf")
print(f"추출된 조항 수: {len(result.provisions)}")

# 2. 조항 매칭
matcher = ProvisionMatchingTool()
match_result = await matcher.match(
    contract_text=result.extracted_text,
    contract_provisions=result.provisions,
    standard_contract_type="employment"
)
print(f"누락된 조항: {len(match_result.missing_provisions)}")

# 3. 법령 검색
searcher = VectorSearchTool()
search_result = await searcher.search(
    query="수습 기간 해고 조건",
    doc_types=["law", "manual"],
    top_k=5,
    use_hybrid=True
)
print(f"검색 결과: {len(search_result.results)}개")

# 4. 위험도 산정
scorer = RiskScoringTool()
risk_result = await scorer.score(
    provisions=result.provisions,
    matched_provisions=match_result.matched_provisions,
    legal_contexts=search_result.results,
    contract_type="employment"
)
print(f"전체 위험도: {risk_result.overall_risk_score}")

# 5. 설명 생성
explainer = LLMExplanationTool()
explanation = await explainer.explain(
    provision=result.provisions[0],
    risk_score=risk_result.provision_risks[0].risk_score,
    legal_contexts=search_result.results,
    issue_type="missing"
)
print(f"설명: {explanation.explanation}")
```

### 파이프라인 사용

```python
from core.orchestrator_v3 import ContractAnalysisOrchestrator

orchestrator = ContractAnalysisOrchestrator()
result = await orchestrator.analyze_contract(
    file_path="contract.pdf",
    contract_type="employment"
)

print(f"위험도: {result['risk_score']}")
print(f"이슈 수: {len(result['issues'])}")
```

---

## 🔍 성능 최적화

1. **병렬 처리**: 독립적인 도구는 병렬 실행
2. **캐싱**: 법령 검색 결과 캐싱
3. **배치 처리**: 여러 조항을 한 번에 처리
4. **LLM 호출 최소화**: 필요한 경우에만 LLM 호출

---

## 📚 참고 자료

- 기존 코드:
  - `backend/core/document_processor_v2.py`
  - `backend/core/legal_chunker.py`
  - `backend/core/legal_rag_service.py`
  - `backend/core/generator_v2.py`
  - `backend/core/supabase_vector_store.py`

- 외부 라이브러리:
  - LangChain (도구 체인 구성)
  - sentence-transformers (임베딩)
  - Ollama (LLM)

---

## ✅ 체크리스트

- [ ] 각 도구의 입력/출력 명확히 정의
- [ ] 기존 코드 재사용 최대화
- [ ] 독립적인 테스트 가능
- [ ] 에러 처리 및 로깅
- [ ] 문서화 완료
- [ ] 성능 최적화
- [ ] 기존 API와 호환성 유지

