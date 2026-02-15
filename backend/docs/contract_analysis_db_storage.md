# 계약서 분석 시 데이터베이스 저장 구조

## 📊 저장되는 테이블 및 데이터

계약서 분석 시 다음 3개 테이블에 데이터가 저장됩니다:

---

## 1. contract_chunks 테이블

**저장 시점**: 텍스트 추출 직후, 분석 전

**저장 위치**: `backend/api/routes_legal_v2.py` (라인 216-261)

**저장 데이터**:
```sql
INSERT INTO contract_chunks (
    contract_id,           -- doc_id (UUID 문자열)
    article_number,        -- 조 번호 (INTEGER)
    paragraph_index,       -- 문단 인덱스 (INTEGER, nullable)
    content,              -- 청크 내용 (TEXT)
    chunk_index,          -- 청크 순서 (INTEGER)
    chunk_type,           -- 청크 타입 (TEXT: 'article' 등)
    embedding,            -- 임베딩 벡터 (VECTOR 1024차원)
    metadata              -- 추가 메타데이터 (JSONB)
)
```

**저장 로직**:
1. `processor.to_contract_chunks()`로 조항 단위 청킹
2. `LLMGenerator.embed()`로 임베딩 생성 (BAAI/bge-m3)
3. `SupabaseVectorStore.bulk_upsert_contract_chunks()`로 일괄 저장

**용도**: Dual RAG의 계약서 내부 검색용

---

## 2. contract_analyses 테이블

**저장 시점**: 분석 완료 후

**저장 위치**: `backend/core/contract_storage.py` (라인 39-156)

**저장 데이터**:
```sql
INSERT INTO contract_analyses (
    id,                   -- UUID (PK, 자동 생성)
    doc_id,              -- 문서 고유 ID (TEXT)
    user_id,             -- 사용자 ID (UUID, nullable)
    file_name,           -- 파일명 (TEXT, NOT NULL, 캐시 조회용)
    original_filename,   -- 원본 파일명 (TEXT, nullable)
    title,               -- 계약서 제목 (TEXT, nullable)
    doc_type,            -- 문서 타입 (TEXT: 'employment', 'freelance' 등)
    file_url,            -- 파일 URL (TEXT, 기본값: '')
    file_size,           -- 파일 크기 (BIGINT, nullable)
    file_type,           -- 파일 타입 (TEXT, nullable)
    
    -- 분석 결과
    risk_score,          -- 위험도 점수 (INTEGER: 0-100)
    risk_level,          -- 위험도 등급 (TEXT: 'low' | 'medium' | 'high')
    summary,             -- 분석 요약 (TEXT, nullable)
    contract_text,       -- 계약서 원문 텍스트 (TEXT, nullable)
    sections,            -- 영역별 점수 (JSONB: {working_hours: 80, wage: 70, ...})
    retrieved_contexts,  -- RAG 검색 결과 (JSONB: [{sourceType, title, snippet}, ...])
    
    -- 조항 및 하이라이트 (JSONB)
    clauses,             -- 조항 목록 (JSONB)
    highlighted_texts,   -- 하이라이트된 텍스트 (JSONB)
    analysis_result,     -- 전체 분석 결과 (JSONB, 기본값: {})
    
    -- 타임스탬프
    created_at,          -- 생성 시간 (TIMESTAMPTZ)
    updated_at           -- 수정 시간 (TIMESTAMPTZ)
)
```

### clauses JSONB 구조:
```json
[
    {
        "id": "clause-1",
        "title": "제1조 (목적)",
        "content": "조항 본문...",
        "articleNumber": 1,
        "startIndex": 0,
        "endIndex": 150,
        "category": "working_hours",
        "severity": "high"  // 이슈 정보 attach 후
    }
]
```

### highlighted_texts JSONB 구조:
```json
[
    {
        "text": "조항 내용...",
        "startIndex": 0,
        "endIndex": 150,
        "severity": "high",
        "clauseId": "clause-1",
        "issueIds": ["issue-1", "issue-2"]
    }
]
```

---

## 3. contract_issues 테이블

**저장 시점**: contract_analyses 저장 직후

**저장 위치**: `backend/core/contract_storage.py` (라인 120-149)

**저장 데이터**:
```sql
INSERT INTO contract_issues (
    id,                      -- UUID (PK, 자동 생성)
    contract_analysis_id,    -- FK → contract_analyses.id (UUID)
    issue_id,                -- 이슈 고유 ID (TEXT: 'issue-1' 등)
    category,                -- 이슈 카테고리 (TEXT: 'wage', 'working_hours' 등)
    severity,                -- 위험도 (TEXT: 'low' | 'medium' | 'high')
    summary,                 -- 이슈 요약 (TEXT)
    original_text,           -- 계약서 원문의 위험 조항 (TEXT)
                              -- ⭐ 새 파이프라인: clause.content 사용
    legal_basis,             -- 법적 근거 (TEXT[]: ['근로기준법 제XX조', ...])
    explanation,             -- 설명 (TEXT)
    suggested_revision,      -- 개선안 (TEXT)
    created_at               -- 생성 시간 (TIMESTAMPTZ)
)
```

**저장 로직**:
- `contract_analysis_id`로 연결
- 각 issue마다 별도 row로 저장
- `original_text`는 **clause.content**를 사용 (새 파이프라인)

---

## 📋 저장 순서

```
[1] 텍스트 추출
    ↓
[2] contract_chunks 저장 (청킹 + 임베딩)
    - contract_id = doc_id
    - article_number, content, embedding 등
    ↓
[3] clause 추출 (extract_clauses)
    - 메모리에만 저장 (아직 DB 저장 안 함)
    ↓
[4] LLM 분석 (clause_id 기반)
    - clauses를 프롬프트에 포함
    - LLM이 clause_id 기반으로 이슈 생성
    ↓
[5] contract_analyses 저장
    - doc_id, title, file_name
    - risk_score, risk_level, summary
    - contract_text (전체 원문)
    - clauses (JSONB)
    - highlighted_texts (JSONB)
    - retrieved_contexts (JSONB)
    ↓
[6] contract_issues 저장
    - contract_analysis_id (FK)
    - issue_id, category, severity
    - original_text (clause.content)
    - legal_basis, explanation 등
```

---

## 🔍 주요 필드 설명

### contract_analyses.file_name
- **용도**: 캐시 조회용 (같은 파일명이면 DB에서 바로 불러오기)
- **값**: `file.filename` 또는 `title`
- **NOT NULL 제약**: 반드시 값이 있어야 함

### contract_analyses.clauses
- **용도**: 조항 목록 (프론트엔드에서 조항별 위험도 표시)
- **형식**: JSONB 배열
- **생성**: `extract_clauses()` → `attach_issue_info_to_clauses()`

### contract_analyses.highlighted_texts
- **용도**: 하이라이트된 텍스트 위치 정보
- **형식**: JSONB 배열
- **생성**: `build_highlights_from_clauses()` (clause 기준)

### contract_issues.original_text
- **기존 방식**: LLM이 생성한 텍스트 (매칭 실패 가능)
- **새 방식**: `clause.content` 직접 사용 (정확함)
- **저장 로직**: `routes_legal_v2.py`에서 clause_id 기반으로 자동 채움

---

## 📝 실제 저장 예시

### contract_analyses 예시:
```json
{
    "id": "3f6f3624-85b2-4562-b0d2-9c19c11526f5",
    "doc_id": "68d62a43-d5be-4666-b230-5605c90a6c4f",
    "file_name": "김인턴_샘플_근로계약서.pdf",
    "title": "김인턴_샘플_근로계약서.pdf",
    "risk_score": 65,
    "risk_level": "high",
    "contract_text": "표준근로계약서 기간의 정함이 있는 경우...",
    "clauses": [
        {
            "id": "clause-1",
            "title": "근로계약기간",
            "content": "년 월 일부터 년 월 일까지",
            "articleNumber": 1,
            "startIndex": 100,
            "endIndex": 150,
            "category": "working_hours",
            "severity": "high"
        }
    ],
    "highlighted_texts": [
        {
            "text": "년 월 일부터 년 월 일까지",
            "startIndex": 100,
            "endIndex": 150,
            "severity": "high",
            "clauseId": "clause-1",
            "issueIds": ["issue-1"]
        }
    ]
}
```

### contract_issues 예시:
```json
{
    "id": "uuid-...",
    "contract_analysis_id": "3f6f3624-85b2-4562-b0d2-9c19c11526f5",
    "issue_id": "issue-1",
    "category": "working_hours",
    "severity": "high",
    "summary": "근로계약기간이 불명확함",
    "original_text": "년 월 일부터 년 월 일까지",  // clause.content
    "legal_basis": ["근로기준법 제23조"],
    "explanation": "근로계약기간이 구체적으로 명시되지 않아...",
    "suggested_revision": "2024년 1월 1일부터 2024년 12월 31일까지"
}
```

### contract_chunks 예시:
```json
{
    "id": "uuid-...",
    "contract_id": "68d62a43-d5be-4666-b230-5605c90a6c4f",
    "article_number": 1,
    "content": "년 월 일부터 년 월 일까지",
    "chunk_index": 0,
    "chunk_type": "article",
    "embedding": [0.123, 0.456, ...],  // 1024차원 벡터
    "metadata": {
        "contract_id": "68d62a43-...",
        "title": "김인턴_샘플_근로계약서.pdf",
        "filename": "김인턴_샘플_근로계약서.pdf"
    }
}
```

---

## 🔗 테이블 간 관계

```
contract_analyses (1)
    ├── doc_id (TEXT)
    │
    ├── contract_chunks (N)  -- contract_id = doc_id
    │   └── 벡터 검색용 청크
    │
    └── contract_issues (N)  -- contract_analysis_id = id
        └── 위험 이슈 상세 정보
```

---

## ⚠️ 주의사항

1. **contract_chunks**: 분석 전에 먼저 저장 (Dual RAG 검색에 필요)
2. **clauses**: JSONB로 저장 (별도 테이블 없음)
3. **original_text**: 새 파이프라인에서는 clause.content 사용 (정확함)
4. **file_name**: 캐시 조회용이므로 정확한 파일명 필요

