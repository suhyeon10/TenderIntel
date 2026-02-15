# 백엔드 Retrieval-Augmentation-Generation 단계별 상세 설명

## 📋 목차

1. [② Retrieval 단계 (VectorSearchTool)](#-retrieval-단계-vectorsearchtool)
2. [③ Augmentation 단계](#-augmentation-단계)
3. [④ Generation 단계 (Explanation Tool)](#-generation-단계-explanation-tool)

---

## ② Retrieval 단계 (VectorSearchTool)

### 검색 대상 데이터셋 (Supabase + pgvector)

**구현 위치**: `backend/core/supabase_vector_store.py`

현재 프로젝트는 **`legal_chunks`** 테이블을 사용하며, `source_type` 필드로 문서 타입을 구분합니다:

| source_type | 설명 | 실제 테이블 |
|------------|------|------------|
| `law` | 법령 (근로기준법, 노동법 등) | `legal_chunks` |
| `manual` | 가이드라인/매뉴얼 (고용노동부 매뉴얼) | `legal_chunks` |
| `case` | 케이스/시나리오 | `legal_chunks` |
| `standard_contract` | 표준 계약서 템플릿 | `legal_chunks` |

**참고**: 사용자가 언급한 `law_chunks`, `standard_contract_chunks`, `guide_chunks`, `case_chunks`, `scenario_chunks`는 모두 `legal_chunks` 테이블의 `source_type` 필드로 구분됩니다.

**스키마 구조** (`backend/core/supabase_vector_store.py`):
```python
legal_chunks 테이블:
- id: UUID (PK)
- external_id: TEXT (파일명/케이스 ID)
- source_type: TEXT ('law' | 'manual' | 'case')
- title: TEXT (문서 제목)
- content: TEXT (청크 텍스트)
- chunk_index: INTEGER (청크 순서)
- file_path: TEXT (원본 파일 경로)
- metadata: JSONB (추가 메타데이터)
- embedding: VECTOR(384) (임베딩 벡터, bge-m3 사용 시)
- created_at: TIMESTAMPTZ
```

**코드 위치**: 
- 테이블 스키마: `supabase/migrations/002_legal_documents_schema.sql`
- 벡터 검색: `backend/core/supabase_vector_store.py::search_similar_legal_chunks()`

---

### 최신 구현의 하이브리드 검색 전략

**구현 위치**: `backend/core/tools/vector_search_tool.py`

#### 1. 벡터 검색 (bge-m3 임베딩 기반 의미 검색)

**효과**: 표현이 달라도 같은 의미 탐지

```python
# backend/core/tools/vector_search_tool.py::_vector_search()
async def _vector_search(
    self,
    query_embedding: List[float],
    filters: Optional[Dict[str, Any]],
    top_k: int
) -> List[Dict[str, Any]]:
    """벡터 검색 (의미 기반)"""
    results = self.vector_store.search_similar_legal_chunks(
        query_embedding=query_embedding,
        top_k=top_k,
        filters=filters
    )
    return results
```

**특징**:
- 코사인 유사도 기반 검색
- `bge-m3` 임베딩 모델 사용 (384차원 또는 1024차원)
- `source_type` 필터링 지원

#### 2. 키워드 검색 (법령명, 조항 번호 기반 정밀 검색)

**효과**: 법령 재현율 극대화

```python
# backend/core/tools/vector_search_tool.py::_keyword_search()
async def _keyword_search(
    self,
    query: str,
    filters: Optional[Dict[str, Any]],
    top_k: int
) -> List[Dict[str, Any]]:
    """키워드 검색 (간단한 구현)"""
    # 쿼리에서 키워드 추출
    keywords = re.findall(r'\w+', query.lower())
    
    # 벡터 검색 결과를 가져와서 키워드 매칭 점수 계산
    # 키워드 매칭 개수 기반 점수 계산
    keyword_score = keyword_matches / len(keywords) if keywords else 0
```

**특징**:
- 법령명, 조항 번호 등 정확한 키워드 매칭
- 제목과 본문에서 키워드 검색

#### 3. Hybrid Search (벡터 + 키워드 조합)

**가중치 조합**:
- 벡터 검색: 0.7
- 키워드 검색: 0.3

```python
# backend/core/tools/vector_search_tool.py::_hybrid_search()
async def _hybrid_search(
    self,
    query: str,
    query_embedding: List[float],
    filters: Optional[Dict[str, Any]],
    top_k: int
) -> List[Dict[str, Any]]:
    """Hybrid Search (키워드 + 벡터)"""
    # 1. 벡터 검색
    vector_results = await self._vector_search(...)
    
    # 2. 키워드 검색
    keyword_results = await self._keyword_search(...)
    
    # 3. 결과 병합 및 가중치 적용
    combined = self._merge_results(
        vector_results=vector_results,
        keyword_results=keyword_results,
        vector_weight=0.7,
        keyword_weight=0.3
    )
```

**코드 위치**: `backend/core/tools/vector_search_tool.py::_merge_results()`

#### 4. 최신성 필터 (updated_at 기반 최신 법령 우선)

**효과**: 개정 법령 반영 정확도 향상

**참고**: 현재 구현에서는 `created_at` 필드를 사용하며, 향후 `updated_at` 필드 추가 예정입니다.

**코드 위치**: `backend/CONTRACT_ANALYSIS_TOOLS_DESIGN.md` (설계 문서에 명시)

#### 5. MMR 재랭킹 (다양성 + 유사도 균형)

**효과**: 중복 제거, 핵심 근거 우선

```python
# backend/core/tools/vector_search_tool.py::_mmr_rerank()
def _mmr_rerank(
    self,
    query_embedding: List[float],
    results: List[Dict[str, Any]],
    top_k: int,
    diversity: float = 0.5
) -> List[Dict[str, Any]]:
    """
    MMR (Maximum Marginal Relevance) 재랭킹
    
    다양성과 관련성을 균형있게 고려하여 재랭킹
    - diversity: 다양성 파라미터 (0-1, 높을수록 다양)
    """
    # MMR 점수 = λ * relevance - (1 - λ) * max_similarity
    mmr_score = diversity * relevance - (1 - diversity) * min_similarity
```

**특징**:
- 유사도와 다양성의 균형
- 중복된 조문 제거
- 다양한 관점의 법령 제공

**코드 위치**: `backend/core/tools/vector_search_tool.py::_mmr_rerank()`

**참고 문서**: `HALLUCINATION_REDUCTION.md`

---

### 검색 결과의 메타데이터

**구현 위치**: `backend/core/tools/vector_search_tool.py::SearchResult`

```python
@dataclass
class SearchResult:
    """검색 결과"""
    id: str
    external_id: str
    source_type: str  # "law", "standard_contract", "manual", "case"
    title: str
    content: str
    chunk_index: int
    file_path: Optional[str]
    metadata: Dict[str, Any]
    score: float  # 유사도 점수 (0-1)
    search_type: str  # "vector" | "hybrid" | "mmr"
```

**메타데이터 필드**:
- `source_type`: 문서 타입 (law/standard_contract/manual/case)
- `article_number`: 조항 번호 (metadata JSONB에 저장)
- `updated_at`: 최신성 정보 (향후 추가 예정)
- `similarity_score`: 유사도 점수 (0-1)

**→ LLM이 명확히 출처 기반 답변을 생성하도록 설계**

**코드 위치**: `backend/core/tools/vector_search_tool.py::execute()`

---

## ③ Augmentation 단계 (LLM 입력 전 증강)

**구현 위치**: `backend/core/prompts.py`, `backend/core/legal_rag_service.py`

### 증강 원칙

#### 1. 근거 없는 생성 금지

**구현**: 프롬프트 템플릿에서 검색된 법령만 참조하도록 제한

```python
# backend/core/prompts.py::build_legal_chat_prompt()
# 법령 청크 추가
if legal_chunks:
    context_parts.append("\n=== 관련 법령/가이드라인 ===")
    for chunk in legal_chunks[:5]:  # 상위 5개만 사용
        source_type = getattr(chunk, 'source_type', 'law')
        title = getattr(chunk, 'title', '')
        snippet = getattr(chunk, 'snippet', getattr(chunk, 'content', ''))[:500]
        context_parts.append(f"[{source_type}] {title}\n{snippet}")
```

**코드 위치**: `backend/core/prompts.py::build_legal_chat_prompt()`

#### 2. 강제 조문 번호 + 원문 삽입

**예시**: `[근로기준법 제26조] 해고의 예고: "사용자는 근로자를 해고하려면…"`

**구현**: `backend/core/tools/llm_explanation_tool.py::_extract_legal_basis()`

```python
def _extract_legal_basis(
    self,
    legal_contexts: List[Dict[str, Any]],
    provision: Dict[str, Any]
) -> List[str]:
    """법령 조문 자동 추출"""
    legal_basis = []
    
    for ctx in legal_contexts[:5]:  # 상위 5개만 사용
        source_type = ctx.get("source_type", "")
        title = ctx.get("title", "")
        content = ctx.get("content", "")
        
        # 법령 조문 패턴 추출 (제n조, 제n항 등)
        article_pattern = re.compile(r'제\s*\d+\s*조[^\n]*', re.MULTILINE)
        articles = article_pattern.findall(content)
        
        if articles:
            # 법령명과 조문 결합
            for article in articles[:2]:  # 최대 2개
                legal_basis.append(f"{title} {article.strip()}")
```

**코드 위치**: `backend/core/tools/llm_explanation_tool.py::_extract_legal_basis()`

#### 3. 구버전/충돌 근거 제거

**구현**: 검색 결과에서 중복 제거 및 최신성 필터링 (향후 `updated_at` 필드 활용)

**코드 위치**: `backend/core/tools/vector_search_tool.py::_mmr_rerank()`

#### 4. 안전 프롬프트 템플릿 적용

**구현**: `backend/core/prompts.py::LEGAL_CHAT_SYSTEM_PROMPT`

```python
LEGAL_CHAT_SYSTEM_PROMPT = """당신은 한국 노동법/계약 실무에 특화된 어시스턴트입니다.

**중요한 원칙:**
1. 이 서비스는 법률 자문이 아닙니다. 정보 안내와 가이드를 제공하는 것입니다.
2. 항상 관련 법령/가이드를 근거로 설명하세요.
3. 답변은 마크다운 형식으로 작성하세요 (제목, 리스트, 강조 등).
4. 답변 마지막에 "전문가 상담 권장" 문구를 포함하세요.

**답변 구조:**
1. 요약 결론 (한 문장)
2. 왜 위험한지 (법적 리스크)
3. 실무 협상 포인트 (현실적인 옵션)
4. 참고 법령/표준 계약 요약
"""
```

**코드 위치**: `backend/core/prompts.py::LEGAL_CHAT_SYSTEM_PROMPT`

#### 5. 데이터 부족 시 자동 전환

**구현**: 검색 결과가 없거나 부족한 경우 기본 응답 생성

```python
# backend/core/tools/llm_explanation_tool.py::_generate_default_explanation()
def _generate_default_explanation(
    self,
    provision: Dict[str, Any],
    risk_score: float,
    issue_type: str,
    legal_contexts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """LLM 비활성화 시 기본 설명 생성"""
    # 기본 설명 생성
    # 법령 조문 추출
    legal_basis = self._extract_legal_basis(legal_contexts, provision)
    
    # 기본 수정 제안
    suggested_revision = f"표준 계약서 형식에 맞게 '{prov_title}' 조항을 수정하는 것을 권장합니다."
```

**코드 위치**: `backend/core/tools/llm_explanation_tool.py::_generate_default_explanation()`

**참고 문서**: `HALLUCINATION_REDUCTION.md` (출력 제약 섹션)

---

## ④ Generation 단계 (Explanation Tool)

**구현 위치**: `backend/core/tools/llm_explanation_tool.py`

### 최종적으로 제공되는 정보

#### 1. 계약서 위험도 점수 (0–100)

**구현**: `backend/core/tools/risk_scoring_tool.py`

```python
{
    "overall_risk_score": float,  # 전체 위험도 (0-100)
    "risk_level": str,  # "low" | "medium" | "high"
    "risk_breakdown": {
        "working_hours": float,  # 근로시간 관련 위험도
        "wage": float,  # 임금 관련 위험도
        "probation_termination": float,  # 수습/해고 관련 위험도
        "stock_option_ip": float  # 스톡옵션/IP 관련 위험도
    }
}
```

**코드 위치**: `backend/core/tools/risk_scoring_tool.py::execute()`

#### 2. 영역별 위험도

**카테고리별 가중치**:
- `working_hours` (근로시간/휴게): 0.25
- `wage` (보수/수당): 0.30
- `probation_termination` (수습/해고): 0.25
- `stock_option_ip` (스톡옵션/IP): 0.20

**코드 위치**: `backend/core/tools/risk_scoring_tool.py::_calculate_risk_breakdown()`

**참고 문서**: `HALLUCINATION_REDUCTION.md` (리스크 스코어 계산 방식)

#### 3. 위험 조항 분석

**구현**: `backend/core/tools/llm_explanation_tool.py::execute()`

**제공 정보**:
- **"왜 위험한지?"**: `explanation` 필드
- **"어떤 법령과 충돌하는지?"**: `legal_basis` 필드
- **"표준계약과 비교해 무엇이 다른지?"**: 프롬프트에 포함

```python
@dataclass
class ExplanationResult:
    """설명 결과"""
    explanation: str  # 위험 사유 설명
    legal_basis: List[str]  # 관련 법령 조문
    suggested_revision: str  # 수정 제안 문구
    rationale: str  # 수정 이유
    suggested_questions: List[str]  # 회사에 질문할 문구
```

**코드 위치**: `backend/core/tools/llm_explanation_tool.py::ExplanationResult`

#### 4. 계약서 원문 하이라이트 연동

**구현**: 프론트엔드에서 `article_number`와 `originalText`를 사용하여 하이라이트

**코드 위치**: 
- 백엔드: `backend/core/tools/llm_explanation_tool.py::execute()` (provision 정보 반환)
- 프론트엔드: `src/app/legal/contract/[docId]/page.tsx`

#### 5. 법령 기반 수정 제안 문구

**구현**: `backend/core/tools/llm_explanation_tool.py::_generate_llm_explanation()`

```python
prompt = f"""...
다음 JSON 형식으로 응답해주세요:
{{
    "explanation": "이 조항의 문제점과 법적 위험성을 상세히 설명 (200-300자)",
    "legal_basis": ["근로기준법 제27조", "근로기준법 제56조"],
    "suggested_revision": "수정 제안 문구 (구체적인 문장으로 작성)",
    "rationale": "왜 이렇게 수정해야 하는지 이유 (100-150자)",
    "suggested_questions": [
        "회사에 이렇게 질문할 수 있는 문구 1",
        "회사에 이렇게 질문할 수 있는 문구 2",
        "회사에 이렇게 질문할 수 있는 문구 3"
    ]
}}
"""
```

**코드 위치**: `backend/core/tools/llm_explanation_tool.py::_generate_llm_explanation()`

#### 6. 단계별 대응 가이드

**제공 정보**:
- **해야 할 일**: `suggested_revision` (수정 제안)
- **하지 말아야 할 일**: `explanation` (위험성 설명)
- **신고 기관 안내**: 프롬프트에 포함 (전문가 상담 권장)

**코드 위치**: `backend/core/prompts.py::LEGAL_CHAT_SYSTEM_PROMPT`

---

## 📁 관련 파일 위치 요약

### Retrieval 단계
- **VectorSearchTool**: `backend/core/tools/vector_search_tool.py`
- **SupabaseVectorStore**: `backend/core/supabase_vector_store.py`
- **하이브리드 검색 전략**: `HALLUCINATION_REDUCTION.md`

### Augmentation 단계
- **프롬프트 템플릿**: `backend/core/prompts.py`
- **법령 조문 추출**: `backend/core/tools/llm_explanation_tool.py::_extract_legal_basis()`
- **RAG 서비스**: `backend/core/legal_rag_service.py`

### Generation 단계
- **Explanation Tool**: `backend/core/tools/llm_explanation_tool.py`
- **Risk Scoring Tool**: `backend/core/tools/risk_scoring_tool.py`
- **도구 설계 문서**: `backend/CONTRACT_ANALYSIS_TOOLS_DESIGN.md`

### 데이터베이스 스키마
- **legal_chunks 테이블**: `supabase/migrations/002_legal_documents_schema.sql`
- **백엔드 로직 설명**: `backend/BACKEND_LOGIC_EXPLANATION.md`

---

## 🔗 참고 문서

- [HALLUCINATION_REDUCTION.md](./HALLUCINATION_REDUCTION.md) - 하이브리드 검색 전략 상세
- [CONTRACT_ANALYSIS_TOOLS_DESIGN.md](./CONTRACT_ANALYSIS_TOOLS_DESIGN.md) - 도구 설계 문서
- [BACKEND_LOGIC_EXPLANATION.md](./BACKEND_LOGIC_EXPLANATION.md) - 백엔드 로직 상세 설명

