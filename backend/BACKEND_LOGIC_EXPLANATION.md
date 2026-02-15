# 백엔드 로직 상세 설명

## 개요
이 문서는 백엔드의 핵심 로직인 청킹(Chunking), RAG 구성, 벡터 검색에 대해 상세히 설명합니다.

## ⚠️ 중요 사항

**현재 프로젝트는 법률 리스크 분석에 집중하고 있으며, 공고 관련 기능은 레거시입니다.**

- ✅ **현재 사용 중**: 
  - `legal_chunks` 테이블 (법률 문서 검색)
  - `contract_chunks` 테이블 (계약서 조항 단위 청크)
  - `contract_analyses`, `contract_issues` 테이블 (계약서 분석 결과)
- ⚠️ **레거시 (사용 안 함)**: 
  - `announcement_chunks` 테이블 (공고 검색)
  - `announcements` 테이블 (공고 메타데이터)

---

## 📄 1. 계약서 텍스트 처리 및 조항 단위 청킹

### 1.1 문서 처리 파이프라인

```
파일 업로드 → 텍스트 추출 → 조항 단위 청킹 → 임베딩 생성 → 벡터 저장
```

### 1.2 텍스트 추출

**지원 파일 형식:**
- PDF: PyMuPDF → pdfplumber → pypdf → OCR (순차 시도)
- HWP/HWPX/HWPS: XML 파싱 또는 외부 변환 서비스
- HTML: HTML 파서로 텍스트 추출
- TXT: 직접 읽기

**코드 위치:** `core/document_processor_v2.py`

```python
# PDF 처리 예시
def pdf_to_text(self, pdf_path: str) -> str:
    # 1. PyMuPDF 시도 (가장 강력)
    # 2. pdfplumber 시도 (표 처리에 좋음)
    # 3. pypdf 시도 (기본 방법)
    # 4. OCR 시도 (스캔된 PDF용)
```

### 1.3 계약서 조항 단위 청킹 전략

**계약서는 일반 문서와 달리 구조화된 형식(제n조)을 가지므로, 특별한 청킹 전략을 사용합니다.**

#### 1차: 조항 단위 분할 (Primary Chunking)

**패턴:** `제n조` 또는 `제 n 조` 형식으로 조항을 식별

**코드 위치:** `core/document_processor_v2.py::ContractArticleSplitter`

```python
# 조항 패턴 예시
ARTICLE_PATTERN = re.compile(
    r'(제\s*\d+\s*조(?:\s*\([^)]+\))?[^\n]*)'  # 조항 헤더 (제1조 (제목))
    r'([\s\S]*?)'  # 조항 본문
    r'(?=제\s*\d+\s*조|$)',  # 다음 조항 또는 끝까지
    re.MULTILINE
)
```

**청킹 과정:**

```python
# 1. 조항 패턴으로 전체 텍스트 분할
matches = ARTICLE_PATTERN.finditer(text)

# 2. 각 조항을 독립적인 청크로 생성
for match in matches:
    header = match.group(1)  # "제1조 (근로기간)"
    body = match.group(2)    # 조항 본문
    article_number = extract_article_number(header)  # 1
    
    chunk = {
        "content": f"{header}\n{body}",
        "article_number": article_number,
        "article_header": header,
        "type": "article"
    }
```

**청킹 예시:**
```
원본 계약서:
제1조 (근로기간)
근로기간은 2024년 1월 1일부터...

제2조 (근로시간)
근로시간은 주 40시간을 원칙으로...

↓ 조항 단위 분할

청크 1: 제1조 (근로기간) + 본문
  - article_number: 1
  - type: "article"

청크 2: 제2조 (근로시간) + 본문
  - article_number: 2
  - type: "article"
```

#### 2차: 문단 단위 분할 (Secondary Chunking)

**조항이 너무 길면 (기본값: 2000자 초과) 문단 단위로 추가 분할**

**코드 위치:** `core/document_processor_v2.py::ArticleParagraphSplitter`

**구분자:**
- `\n\n` (빈 줄)
- `①`, `②`, `③` (원문자)
- `1.`, `2.`, `3.` (숫자)

**청킹 과정:**

```python
# 조항이 max_article_length(2000자)를 초과하면
if len(full_content) > max_article_length:
    # 문단 단위로 추가 분할
    paragraph_chunks = paragraph_splitter.split_article_into_paragraphs(
        full_content, article_number
    )
    # 결과: [청크1(제1조 문단1), 청크2(제1조 문단2), ...]
```

**청킹 예시:**
```
제5조 (근로시간 및 휴게시간) [3000자]
① 근로시간은 주 40시간을 원칙으로 한다.
② 휴게시간은...

↓ 문단 단위 분할

청크 1: 제5조 + ① 근로시간... (1500자)
  - article_number: 5
  - paragraph_index: 0
  - type: "paragraph"

청크 2: 제5조 + ② 휴게시간... (1500자)
  - article_number: 5
  - paragraph_index: 1
  - type: "paragraph"
```

### 1.4 계약서 청크 메타데이터

**각 청크는 다음 메타데이터를 포함합니다:**

```python
{
    "article_number": 5,           # 조항 번호
    "article_header": "제5조 (근로시간)",  # 조항 헤더
    "paragraph_index": 0,           # 문단 인덱스 (문단 분할 시)
    "chunk_type": "article" | "paragraph",  # 청크 타입
    "chunk_index": 0,               # 청크 순서
    "chunk_size": 1500,              # 청크 길이
    "total_chunks": 20,              # 전체 청크 개수
    "contract_id": "uuid",           # 계약서 ID
}
```

**코드 위치:** `core/document_processor_v2.py::to_contract_chunks()`

### 1.5 텍스트 정제

```python
def _clean_text(self, text: str) -> str:
    # 중복 공백 제거
    text = re.sub(r'\s+', ' ', text)
    # 불필요한 특수문자 제거 (한글, 영문, 숫자, 기본 구두점만 유지)
    text = re.sub(r'[^\w\s가-힣.,()%\-:/]', '', text)
    return text.strip()
```

---

## 🔍 2. RAG (Retrieval-Augmented Generation) 구성

### 2.1 Dual RAG 아키텍처

**계약서 분석과 법률 상담은 두 가지 벡터 저장소를 동시에 사용합니다:**

```
┌─────────────────┐
│  사용자 쿼리     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 쿼리 임베딩 생성 │ (sentence-transformers)
└────────┬────────┘
         │
         ├─────────────────┬─────────────────┐
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 계약서 청크 검색 │ │ 법령 청크 검색  │ │ 이슈 기반 Boosting│
│ (contract_chunks)│ │ (legal_chunks)  │ │ (article_number)│
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ LLM 컨텍스트 구성│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ LLM 답변 생성   │ (Ollama/OpenAI)
                    └─────────────────┘
```

### 2.2 Dual RAG 파이프라인 상세

**코드 위치:** `core/legal_rag_service.py::chat_with_context()`

#### 단계 1: 계약서 내부 검색 (Internal Contract Search)

```python
# 계약서 내부에서 관련 조항 검색
contract_chunks = await self._search_contract_chunks(
    doc_id=contract_id,
    query=query,
    top_k=3,  # 계약서는 상위 3개만 사용
    selected_issue=selected_issue  # 이슈 기반 boosting
)
```

**특징:**
- `contract_chunks` 테이블에서 검색
- `contract_id`로 필터링
- `selected_issue.article_number`와 일치하는 조항은 가점 부여 (boosting)

#### 단계 2: 외부 법령 검색 (External Legal Search)

```python
# 법령 문서에서 관련 조문 검색
legal_chunks = await self._search_legal_chunks(
    query=query,
    top_k=8  # 법령은 상위 8개 사용
)
```

**특징:**
- `legal_chunks` 테이블에서 검색
- `source_type` 필터링 (law, manual, case)
- 코사인 유사도 기반 정렬

#### 단계 3: LLM 컨텍스트 구성

```python
# 계약서 청크 + 법령 청크를 함께 전달
prompt = build_legal_chat_prompt(
    query=query,
    contract_chunks=contract_chunks,  # 계약서 내부 컨텍스트
    legal_chunks=legal_chunks,         # 외부 법령 컨텍스트
    selected_issue=selected_issue,
    ...
)
```

### 2.3 이슈 기반 Boosting

**선택된 이슈와 관련된 조항에 가점을 부여하여 검색 결과를 개선합니다.**

**코드 위치:** `core/supabase_vector_store.py::search_similar_contract_chunks()`

```python
def search_similar_contract_chunks(
    contract_id: str,
    query_embedding: List[float],
    top_k: int = 5,
    boost_article: Optional[int] = None,  # 이슈의 조항 번호
    boost_factor: float = 1.5  # 가점 배율
):
    # 유사도 계산
    similarity = cosine_similarity(query_vec, chunk_vec)
    
    # 같은 조항이면 가점 부여
    if boost_article is not None:
        chunk_article = chunk.get("article_number")
        if chunk_article == boost_article:
            similarity *= boost_factor  # 1.5배 가점
    
    return results
```

**예시:**
```
사용자가 "제5조 수습 기간" 이슈를 선택
→ 쿼리: "수습 기간 해고 조건"
→ 검색 결과:
  - 제5조 청크: similarity 0.75 × 1.5 = 1.125 (boosting)
  - 제3조 청크: similarity 0.80 (일반)
  → 제5조 청크가 상위로 올라감
```

### 2.4 임베딩 생성

**임베딩 모델:**
- **법률/계약서 임베딩**: `BAAI/bge-m3` (1024차원, 다국어 지원)
- **기본 모델**: `BAAI/bge-small-en-v1.5` (384차원, 빠름)

**코드 위치:** `core/generator_v2.py`

```python
def embed(self, texts: List[str]) -> List[List[float]]:
    # sentence-transformers 사용
    model = SentenceTransformer(settings.local_embedding_model)
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()
```

**환경 변수:**
```env
# 법률/계약서 전용 임베딩 모델
LOCAL_EMBEDDING_MODEL=BAAI/bge-m3  # 1024차원
USE_LOCAL_EMBEDDING=true
```

### 2.5 벡터 저장

**저장소:**
- **Supabase pgvector**: PostgreSQL의 pgvector 확장 사용
- **현재 사용 중인 테이블:**
  - ✅ `contract_chunks`: 계약서 조항 단위 청크 및 임베딩
  - ✅ `legal_chunks`: 법률 문서 청크 및 임베딩
  - ⚠️ `announcement_chunks`: 공고 청크 (레거시, 사용하지 않음)

**코드 위치:** `core/supabase_vector_store.py`

#### 계약서 청크 저장

```python
# contract_chunks 테이블에 저장
def bulk_upsert_contract_chunks(contract_id, chunks):
    # 기존 청크 삭제
    sb.table("contract_chunks")\
        .delete()\
        .eq("contract_id", contract_id)\
        .execute()
    
    # 새 청크 삽입
    payload = [{
        "contract_id": contract_id,
        "article_number": chunk["article_number"],
        "paragraph_index": chunk.get("paragraph_index"),
        "content": chunk["content"],
        "chunk_index": chunk["chunk_index"],
        "chunk_type": chunk["chunk_type"],
        "embedding": chunk["embedding"],  # vector(1024)
        "metadata": chunk.get("metadata", {})
    } for chunk in chunks]
    
    sb.table("contract_chunks").insert(payload).execute()
```

#### 법률 문서 청크 저장

```python
# legal_chunks 테이블에 저장
def upsert_legal_chunks(chunks):
    payload = [{
        "external_id": chunk["external_id"],
        "source_type": chunk["source_type"],  # "law", "manual", "case"
        "title": chunk["title"],
        "content": chunk["content"],
        "embedding": chunk["embedding"],  # vector(1024)
        "metadata": chunk.get("metadata", {}),
        "chunk_index": chunk.get("chunk_index", 0)
    } for chunk in chunks]
    
    sb.table("legal_chunks").upsert(
        payload, 
        on_conflict="external_id,chunk_index"
    ).execute()
```

---

## 🔎 3. 벡터 검색 (Vector Search)

### 3.1 검색 방식

**검색은 쿼리 중심 (Query-based)입니다.**

1. **사용자 쿼리** → **임베딩 벡터 변환**
2. **임베딩 벡터** → **코사인 유사도 계산**
3. **유사도 순 정렬** → **Top-K 결과 반환**

### 3.2 계약서 청크 검색

**코드 위치:** `core/supabase_vector_store.py::search_similar_contract_chunks()`

```python
def search_similar_contract_chunks(
    contract_id: str,
    query_embedding: List[float],
    top_k: int = 5,
    filters: Optional[Dict[str, Any]] = None,
    boost_article: Optional[int] = None,  # 이슈 기반 boosting
    boost_factor: float = 1.5
) -> List[Dict[str, Any]]:
    # contract_id로 필터링
    query = sb.table("contract_chunks")\
        .select("*")\
        .eq("contract_id", contract_id)
    
    # article_number 필터 (선택사항)
    if filters and "article_number" in filters:
        query = query.eq("article_number", filters["article_number"])
    
    chunks = query.limit(1000).execute().data
    
    # 클라이언트 측 코사인 유사도 계산
    results = []
    for chunk in chunks:
        similarity = cosine_similarity(query_vec, chunk_vec)
        
        # 이슈 기반 boosting
        if boost_article is not None:
            chunk_article = chunk.get("article_number")
            if chunk_article == boost_article:
                similarity *= boost_factor
        
        if similarity > 0.5:  # 임계값
            results.append({
                "id": chunk["id"],
                "contract_id": chunk["contract_id"],
                "article_number": chunk["article_number"],
                "paragraph_index": chunk.get("paragraph_index"),
                "content": chunk["content"],
                "score": similarity
            })
    
    # 유사도 순 정렬
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]
```

**Supabase RPC 함수 (SQL) - contract_chunks용:**

```sql
CREATE OR REPLACE FUNCTION match_contract_chunks(
    p_contract_id UUID,
    query_embedding VECTOR(1024),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    boost_article INTEGER DEFAULT NULL,
    boost_factor FLOAT DEFAULT 1.5
)
RETURNS TABLE (
    id UUID,
    contract_id UUID,
    article_number INTEGER,
    paragraph_index INTEGER,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cc.id,
        cc.contract_id,
        cc.article_number,
        cc.paragraph_index,
        cc.content,
        (1 - (cc.embedding <=> query_embedding)) * 
            CASE WHEN boost_article IS NOT NULL AND cc.article_number = boost_article 
                 THEN boost_factor ELSE 1.0 END AS similarity,
        cc.metadata
    FROM public.contract_chunks cc
    WHERE cc.contract_id = p_contract_id
      AND (1 - (cc.embedding <=> query_embedding)) * 
            CASE WHEN boost_article IS NOT NULL AND cc.article_number = boost_article 
                 THEN boost_factor ELSE 1.0 END > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
```

### 3.3 법률 문서 청크 검색

**코드 위치:** `core/supabase_vector_store.py::search_similar_legal_chunks()`

```python
def search_similar_legal_chunks(
    query_embedding: List[float],
    top_k: int = 5,
    filters: Optional[Dict] = None
):
    # legal_chunks 테이블에서 검색
    query = sb.table("legal_chunks").select("*")
    
    # source_type 필터링 (law, manual, case 등)
    if filters and "source_type" in filters:
        query = query.eq("source_type", filters["source_type"])
    
    chunks = query.execute().data
    
    # 클라이언트 측 코사인 유사도 계산
    import numpy as np
    query_vec = np.array(query_embedding, dtype=np.float32)
    
    results = []
    for chunk in chunks:
        if chunk.get("embedding"):
            chunk_vec = np.array(chunk["embedding"], dtype=np.float32)
            
            # 코사인 유사도 = dot product / (norm1 * norm2)
            similarity = np.dot(query_vec, chunk_vec) / (
                np.linalg.norm(query_vec) * np.linalg.norm(chunk_vec)
            )
            
            if similarity > 0.7:  # 임계값
                results.append({
                    "id": chunk["id"],
                    "external_id": chunk.get("external_id", ""),
                    "source_type": chunk.get("source_type", "law"),
                    "title": chunk.get("title", ""),
                    "content": chunk.get("content", ""),
                    "score": float(similarity),
                    "metadata": chunk.get("metadata", {})
                })
    
    # 유사도 순 정렬
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]
```

**Supabase RPC 함수 (SQL) - legal_chunks용:**

```sql
CREATE OR REPLACE FUNCTION match_legal_chunks(
    query_embedding vector(1024),
    match_threshold float,
    match_count int,
    source_type_filter text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    external_id text,
    source_type text,
    title text,
    content text,
    similarity float,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lc.id,
        lc.external_id,
        lc.source_type,
        lc.title,
        lc.content,
        1 - (lc.embedding <=> query_embedding) as similarity,
        lc.metadata
    FROM legal_chunks lc
    WHERE 1 - (lc.embedding <=> query_embedding) > match_threshold
        AND (source_type_filter IS NULL OR lc.source_type = source_type_filter)
    ORDER BY lc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

### 3.4 코사인 유사도 (Cosine Similarity)

**공식:**
```
similarity = (A · B) / (||A|| × ||B||)
```

- `A · B`: 두 벡터의 내적 (dot product)
- `||A||`: 벡터 A의 크기 (norm)
- `||B||`: 벡터 B의 크기 (norm)
- 결과값: -1 ~ 1 (1에 가까울수록 유사)

**pgvector 연산자:**
- `<=>`: 코사인 거리 (1 - similarity)
- `<=>` 값이 작을수록 유사함

### 3.5 검색 최적화

#### 인덱싱

```sql
-- contract_chunks 벡터 인덱스 (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_contract_chunks_embedding 
ON contract_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- contract_id 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_chunks_contract_id 
ON contract_chunks (contract_id);

-- article_number 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_chunks_article_number 
ON contract_chunks (contract_id, article_number);

-- legal_chunks 벡터 인덱스 (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding 
ON legal_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- source_type 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_chunks_source_type 
ON legal_chunks (source_type);
```

#### 필터링

```python
# 계약서 청크 검색 필터
filters = {
    "article_number": 5  # 특정 조항만 검색
}

# 법률 문서 검색 필터
filters = {
    "source_type": "law"  # "law", "manual", "case"
}
```

---

## 🔄 4. 전체 플로우 예시

### 4.1 계약서 분석 플로우

```
1. 계약서 파일 업로드 (PDF/HWPX)
   ↓
2. 텍스트 추출 (PyMuPDF/HWPX 파서)
   "제1조 (근로기간)... 제2조 (근로시간)..."
   ↓
3. 조항 단위 청킹
   - 제1조 → 청크1 (article_number=1)
   - 제2조 → 청크2 (article_number=2)
   - 제5조 (3000자) → 청크3-4 (article_number=5, paragraph_index=0,1)
   ↓
4. 임베딩 생성 (BAAI/bge-m3, 1024차원)
   청크1 → [0.15, 0.25, ..., 0.85]
   청크2 → [0.12, 0.28, ..., 0.82]
   ...
   ↓
5. 벡터 저장 (contract_chunks 테이블)
   - contract_id로 그룹화
   - article_number, paragraph_index 메타데이터 포함
   ↓
6. Dual RAG 검색
   - 계약서 내부: contract_chunks에서 관련 조항 검색
   - 외부 법령: legal_chunks에서 관련 법령 검색
   ↓
7. LLM 위험 분석 (Ollama/OpenAI)
   - 검색된 계약서 조항 + 법령 조문을 컨텍스트로 사용
   - 위험 조항 식별 및 분석
   ↓
8. 분석 결과 저장
   - contract_analyses 테이블에 저장
   - contract_issues 테이블에 이슈별 상세 저장
```

### 4.2 법률 상담 챗 플로우

```
1. 사용자 쿼리
   "수습 기간 해고 조건은 어떻게 되나요?"
   (선택된 이슈: 제5조 수습 기간)
   ↓
2. 쿼리 임베딩 생성
   "수습 기간 해고 조건은 어떻게 되나요?"
   → [0.15, 0.25, ..., 0.85] (1024차원)
   ↓
3. Dual RAG 검색
   
   3-1. 계약서 내부 검색 (contract_chunks)
   - contract_id로 필터링
   - 제5조 청크에 boosting (1.5배)
   - 결과: 제5조 청크 (similarity=0.85, boosted=1.275)
   
   3-2. 외부 법령 검색 (legal_chunks)
   - source_type="law" 필터링
   - 결과: 
     * 근로기준법 제27조 (similarity=0.92)
     * 근로기준법 시행령 (similarity=0.88)
   ↓
4. LLM 컨텍스트 구성
   "=== 계약서 내용 ==="
   제5조: 수습 기간은 6개월로 한다...
   
   "=== 관련 법령/가이드라인 ==="
   [law] 근로기준법 제27조: 수습기간은 3개월을 초과할 수 없다...
   ↓
5. LLM 답변 생성 (구조화된 형식)
   ## 요약 결론
   수습 기간 중 해고는 근로기준법 제27조에 따라 정당한 사유가 있어야 하며,
   3개월을 초과할 수 없습니다.
   
   ## 왜 위험한지 (법적 리스크)
   현재 계약서의 제5조는 수습 기간을 6개월로 규정하고 있어 근로기준법에 위반됩니다.
   
   ## 실무 협상 포인트
   1. 수습 기간을 3개월로 단축 요청
   2. 해고 사유를 구체적으로 명시 요청
   
   ## 참고 법령/표준 계약
   - 근로기준법 제27조: 수습 기간은 3개월을 초과할 수 없음
```

### 4.3 이슈 기반 분석 플로우

```
1. 계약서 분석 완료
   - contract_issues 테이블에 이슈 저장
   - 예: 이슈 ID="issue-1", article_number=5, category="probation"
   ↓
2. 사용자가 특정 이슈 선택
   - selected_issue = {
       "id": "issue-1",
       "article_number": 5,
       "originalText": "제5조 수습 기간은 6개월로 한다...",
       "category": "probation"
     }
   ↓
3. 이슈 기반 쿼리 생성
   - 쿼리: "수습 기간 해고 조건"
   - boost_article: 5 (제5조에 가점)
   ↓
4. 계약서 청크 검색 (boosting 적용)
   - 제5조 청크: similarity 0.75 × 1.5 = 1.125 (상위)
   - 제3조 청크: similarity 0.80 (일반)
   → 제5조 청크가 우선 선택됨
   ↓
5. LLM 답변 생성
   - 제5조 조항을 중심으로 위험도 분석
   - 관련 법령과 비교하여 개선안 제시
```

---

## 📊 5. 데이터베이스 스키마

### 5.1 주요 테이블

#### ✅ 현재 사용 중인 테이블

**`contract_chunks`** (현재 사용 중)
- 계약서 조항 단위 청크 및 임베딩 저장 테이블
- 계약서 분석, 법률 상담에 사용
- **스키마:**
  - `id`: UUID (PK)
  - `contract_id`: UUID (FK, 계약서 ID)
  - `article_number`: INTEGER (조항 번호)
  - `paragraph_index`: INTEGER (문단 인덱스, 선택)
  - `content`: TEXT (청크 텍스트)
  - `chunk_index`: INTEGER (청크 순서)
  - `chunk_type`: TEXT ('article' | 'paragraph')
  - `embedding`: VECTOR(1024) (임베딩 벡터)
  - `metadata`: JSONB (메타데이터)
  - `created_at`: TIMESTAMPTZ

**`legal_chunks`** (현재 사용 중)
- 법률 문서 청크 및 임베딩 저장 테이블
- 계약서 분석, 법률 검색에 사용
- **스키마:**
  - `id`: UUID (PK)
  - `external_id`: TEXT (외부 문서 ID)
  - `source_type`: TEXT ('law' | 'manual' | 'case')
  - `title`: TEXT (문서 제목)
  - `content`: TEXT (청크 텍스트)
  - `embedding`: VECTOR(1024) (임베딩 벡터)
  - `metadata`: JSONB (메타데이터)
  - `chunk_index`: INTEGER (청크 순서)
  - `file_path`: TEXT (원본 파일 경로)

**`contract_analyses`** (현재 사용 중)
- 계약서 분석 결과 저장
- **스키마:**
  - `id`: UUID (PK)
  - `doc_id`: UUID (문서 ID)
  - `title`: TEXT (계약서 제목)
  - `risk_score`: INTEGER (위험도 점수, 0-100)
  - `risk_level`: TEXT ('low' | 'medium' | 'high')
  - `contract_text`: TEXT (계약서 원문 텍스트)
  - `summary`: TEXT (분석 요약)
  - `user_id`: TEXT (사용자 ID, 선택)
  - `created_at`: TIMESTAMPTZ

**`contract_issues`** (현재 사용 중)
- 계약서 이슈 상세 정보
- **스키마:**
  - `id`: UUID (PK)
  - `contract_analysis_id`: UUID (FK, 계약서 분석 ID)
  - `issue_id`: TEXT (이슈 ID)
  - `category`: TEXT (이슈 카테고리)
  - `severity`: TEXT ('low' | 'medium' | 'high')
  - `summary`: TEXT (이슈 요약)
  - `legal_basis`: TEXT[] (법적 근거 배열)
  - `original_text`: TEXT (원본 조항 텍스트)
  - `article_number`: INTEGER (조항 번호)
  - `suggested_text`: TEXT (개선된 조항 텍스트)

#### ⚠️ 레거시 테이블 (사용하지 않음)

**`announcements`** (레거시)
- 공고 관련 기능은 더 이상 사용하지 않습니다
- `id`: UUID (PK)
- `source`: TEXT (출처)
- `external_id`: TEXT (외부 시스템 ID)
- `title`: TEXT (제목)
- `version`: INTEGER (버전 번호)
- `content_hash`: TEXT (내용 해시, 중복 감지)

**`announcement_chunks`** (레거시)
- 공고 청크 및 임베딩 저장 테이블 (더 이상 사용하지 않음)
- `id`: UUID (PK)
- `announcement_id`: UUID (FK, 공고 ID)
- `chunk_index`: INTEGER (청크 순서)
- `content`: TEXT (청크 텍스트)
- `embedding`: VECTOR(384) (임베딩 벡터)
- `metadata`: JSONB (메타데이터)

### 5.2 인덱스

#### ✅ 현재 사용 중: contract_chunks 인덱스

```sql
-- 벡터 인덱스 (IVFFlat) - contract_chunks
CREATE INDEX IF NOT EXISTS idx_contract_chunks_embedding 
ON contract_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- contract_id 인덱스
CREATE INDEX IF NOT EXISTS idx_contract_chunks_contract_id 
ON contract_chunks (contract_id);

-- article_number 인덱스 (복합)
CREATE INDEX IF NOT EXISTS idx_contract_chunks_article_number 
ON contract_chunks (contract_id, article_number);

-- metadata 인덱스 (GIN)
CREATE INDEX IF NOT EXISTS idx_contract_chunks_metadata 
ON contract_chunks USING gin (metadata);
```

#### ✅ 현재 사용 중: legal_chunks 인덱스

```sql
-- 벡터 인덱스 (IVFFlat) - legal_chunks
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding 
ON legal_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- source_type 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_chunks_source_type 
ON legal_chunks (source_type);

-- external_id 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_chunks_external_id 
ON legal_chunks (external_id);
```

---

## 🎯 6. LLM 프롬프트 템플릿

### 6.1 프롬프트 구조화

**코드 위치:** `core/prompts.py`

**법률 상담 챗 프롬프트는 4단계 구조로 고정되어 있습니다:**

```python
LEGAL_CHAT_SYSTEM_PROMPT = """당신은 한국 노동법/계약 실무에 특화된 어시스턴트입니다.

**답변 구조:**
1. 요약 결론 (한 문장)
2. 왜 위험한지 (법적 리스크)
3. 실무 협상 포인트 (현실적인 옵션)
4. 참고 법령/표준 계약 요약
"""
```

**프롬프트 구성:**

```python
def build_legal_chat_prompt(
    query: str,
    contract_chunks: list = None,  # 계약서 내부 청크
    legal_chunks: list = None,      # 법령 청크
    selected_issue: dict = None,
    ...
) -> str:
    # 계약서 청크 추가
    if contract_chunks:
        context_parts.append("=== 계약서 내용 ===")
        for chunk in contract_chunks[:3]:
            context_parts.append(f"제{chunk.article_number}조:\n{chunk.content}")
    
    # 법령 청크 추가
    if legal_chunks:
        context_parts.append("\n=== 관련 법령/가이드라인 ===")
        for chunk in legal_chunks[:5]:
            context_parts.append(f"[{chunk.source_type}] {chunk.title}\n{chunk.snippet}")
    
    prompt = f"""{LEGAL_CHAT_SYSTEM_PROMPT}
    
    위 정보를 바탕으로 사용자의 질문에 대해 다음 구조로 답변해주세요:
    
    ## 요약 결론
    [한 문장으로 핵심 답변]
    
    ## 왜 위험한지 (법적 리스크)
    [관련 법령을 근거로 위험성 설명]
    
    ## 실무 협상 포인트
    [현실적인 협상 옵션과 대안 제시]
    
    ## 참고 법령/표준 계약
    [관련 법령 요약 및 출처]
    """
```

### 6.2 계약서 분석 프롬프트

```python
CONTRACT_ANALYSIS_SYSTEM_PROMPT = """당신은 한국 노동법 전문가입니다. 계약서를 분석하여 위험 조항을 식별하고 개선안을 제시합니다.

**분석 원칙:**
1. 근로기준법, 최저임금법 등 관련 법령을 기준으로 분석
2. 표준근로계약서와 비교하여 누락/과도한 조항 식별
3. 각 위험 조항에 대해 구체적인 법적 근거 제시
4. 실무적인 개선안과 협상 포인트 제시
"""
```

**응답 형식 (JSON):**

```json
{
    "risk_score": 0-100,
    "risk_level": "low" | "medium" | "high",
    "summary": "전체 위험도 요약 (2-3문장)",
    "issues": [
        {
            "name": "이슈 이름",
            "description": "위험 조항 내용",
            "severity": "low" | "medium" | "high",
            "legal_basis": ["근로기준법 제XX조", ...],
            "suggested_text": "개선된 조항 텍스트",
            "rationale": "왜 위험한지 설명",
            "suggested_questions": ["협상 시 물어볼 질문 1", ...]
        }
    ],
    "recommendations": [
        {
            "title": "권장 사항 제목",
            "description": "구체적인 권장 사항",
            "steps": ["단계 1", "단계 2", ...]
        }
    ]
}
```

### 6.3 상황 분석 프롬프트

```python
SITUATION_ANALYSIS_SYSTEM_PROMPT = """당신은 한국 노동법 전문가입니다. 사용자의 상황을 분석하여 법적 리스크와 대응 방안을 제시합니다.

**분석 원칙:**
1. 제공된 상황 정보를 바탕으로 법적 리스크 평가
2. 관련 법령을 근거로 설명
3. 실무적인 대응 방안과 체크리스트 제시
4. 유사 케이스와 비교 분석
"""
```

**응답 형식 (JSON):**

```json
{
    "classified_type": "harassment|unpaid_wage|unfair_dismissal|overtime|probation|unknown",
    "risk_score": 0~100,
    "summary": "한 줄 요약",
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
                "title": "증거 수집",
                "items": ["구체적인 증거 수집 방법"]
            },
            {
                "title": "1차 대응",
                "items": ["초기 대응 방법"]
            },
            {
                "title": "상담/신고 루트",
                "items": ["고용노동부 1350 상담센터", "청년노동센터", "노무사 상담"]
            }
        ]
    },
    "scripts": {
        "to_company": "회사에 보낼 정중한 문제 제기 문구 템플릿",
        "to_advisor": "노무사/기관에 상담할 때 쓸 설명 템플릿"
    }
}
```

---

## 🔧 7. 설정 및 튜닝

### 7.1 청킹 파라미터

```env
# .env 파일
# 계약서 조항 내부 문단 분할 시 사용
CHUNK_SIZE=1500      # 조항 내부 문단 분할 시 사용 (기본값: 1500)
CHUNK_OVERLAP=300    # 조항 내부 문단 오버랩 (기본값: 300)

# 조항 단위 분할은 자동으로 처리됨 (제n조 패턴 기반)
# 조항이 CHUNK_SIZE를 초과하면 문단 단위로 추가 분할
```

**권장값:**
- **일반 계약서**: `CHUNK_SIZE=1500, CHUNK_OVERLAP=300`
- **긴 조항이 많은 계약서**: `CHUNK_SIZE=2000, CHUNK_OVERLAP=400`
- **짧은 조항이 많은 계약서**: `CHUNK_SIZE=1000, CHUNK_OVERLAP=200`

### 7.2 검색 파라미터

```python
# 검색 시
top_k = 5              # 반환할 결과 개수
match_threshold = 0.7  # 최소 유사도 임계값
boost_factor = 1.5     # 이슈 기반 boosting 배율
```

**권장값:**
- **계약서 내부 검색**: `top_k=3, match_threshold=0.5, boost_factor=1.5`
- **법령 검색**: `top_k=8, match_threshold=0.7`
- **정밀 검색**: `top_k=3, match_threshold=0.85`
- **광범위 검색**: `top_k=10, match_threshold=0.6`

### 7.3 임베딩 모델 선택

```env
# 법률/계약서 전용 임베딩 모델
LOCAL_EMBEDDING_MODEL=BAAI/bge-m3          # 1024차원, 다국어 지원
USE_LOCAL_EMBEDDING=true
```

**모델 비교:**
- **BAAI/bge-m3** (권장): 1024차원, 다국어 지원, 법률 문서에 적합
- **BAAI/bge-small-en-v1.5**: 384차원, 빠름, 영어 중심

---

## 📝 8. 주요 코드 참조

### 8.1 청킹
- ✅ `core/document_processor_v2.py::to_contract_chunks()` - 계약서 조항 단위 청킹 (현재 사용)
- ✅ `core/document_processor_v2.py::ContractArticleSplitter` - 조항 분할 알고리즘 (현재 사용)
- ✅ `core/document_processor_v2.py::ArticleParagraphSplitter` - 문단 분할 알고리즘 (현재 사용)
- ⚠️ `core/document_processor_v2.py::to_chunks()` - 일반 문서 청킹 (레거시, 공고용)

### 8.2 임베딩
- ✅ `core/generator_v2.py::embed()` - 배치 임베딩 (현재 사용)
- ✅ `core/generator_v2.py::embed_one()` - 단일 임베딩 (현재 사용)

### 8.3 벡터 검색 (현재 사용 중)
- ✅ `core/supabase_vector_store.py::search_similar_contract_chunks()` - 계약서 청크 검색 (현재 사용)
- ✅ `core/supabase_vector_store.py::search_similar_legal_chunks()` - 법률 문서 검색 (현재 사용)
- ✅ `core/supabase_vector_store.py::bulk_upsert_contract_chunks()` - 계약서 청크 저장 (현재 사용)
- ⚠️ `core/supabase_vector_store.py::search_similar_chunks()` - 공고 검색 (레거시, 사용 안 함)

### 8.4 RAG 파이프라인 (현재 사용 중)
- ✅ `core/legal_rag_service.py::analyze_contract()` - 계약서 분석 RAG (현재 사용)
- ✅ `core/legal_rag_service.py::chat_with_context()` - 법률 상담 챗 (Dual RAG) (현재 사용)
- ✅ `core/legal_rag_service.py::_search_contract_chunks()` - 계약서 내부 검색 (현재 사용)
- ✅ `core/legal_rag_service.py::_search_legal_chunks()` - 법령 검색 (현재 사용)
- ✅ `core/legal_rag_service.py::analyze_situation_detailed()` - 상황 분석 (현재 사용)

### 8.5 프롬프트 템플릿 (현재 사용 중)
- ✅ `core/prompts.py::build_legal_chat_prompt()` - 법률 상담 챗 프롬프트 (현재 사용)
- ✅ `core/prompts.py::build_contract_analysis_prompt()` - 계약서 분석 프롬프트 (현재 사용)
- ✅ `core/prompts.py::build_situation_analysis_prompt()` - 상황 분석 프롬프트 (현재 사용)

---

## 🚀 9. 성능 최적화

### 9.1 벡터 인덱스
- IVFFlat 인덱스 사용 (빠른 근사 검색)
- `lists` 파라미터 조정 (100-1000 권장)
- contract_id, article_number 복합 인덱스로 필터링 성능 향상

### 9.2 배치 처리
- 임베딩 생성 시 배치 처리 (`embed()` 메서드)
- 벡터 저장 시 일괄 삽입 (`bulk_upsert_contract_chunks()`)
- 기존 청크 삭제 후 새 청크 삽입으로 중복 방지

### 9.3 캐싱
- 임베딩 모델 지연 로드 (싱글톤 패턴)
- Supabase 클라이언트 지연 초기화
- 이슈 기반 boosting으로 관련 조항 우선 검색

---

## 📚 참고 자료

- [Supabase pgvector 문서](https://supabase.com/docs/guides/ai/vector-columns)
- [sentence-transformers 문서](https://www.sbert.net/)
- [LangChain RAG 가이드](https://python.langchain.com/docs/use_cases/question_answering/)
- [프롬프트 개선 사항](./PROMPT_IMPROVEMENTS.md)

---

## ⚠️ 레거시 기능 (참고용)

### 레거시: 공고 업로드 및 인덱싱 (사용하지 않음)

```
⚠️ 이 플로우는 더 이상 사용하지 않습니다.

1. 파일 업로드 (PDF)
   ↓
2. 텍스트 추출
   ↓
3. 일반 청크 분할 (SimpleTextSplitter)
   ↓
4. 임베딩 생성
   ↓
5. 벡터 저장 (announcement_chunks)  ← 레거시
   ↓
6. LLM 분석
   ↓
7. 분석 결과 저장 (announcement_analysis)  ← 레거시
```

**레거시 코드 위치:**
- ⚠️ `core/orchestrator_v2.py::process_announcement()` - 공고 처리 (레거시, 사용 안 함)
- ⚠️ `api/routes_v2.py` - 공고 관련 엔드포인트 (deprecated=True)
