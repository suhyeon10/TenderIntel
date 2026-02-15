# 계약서 분석 전체 흐름 및 데이터베이스 구조

## 📋 목차
1. [전체 파이프라인 흐름](#전체-파이프라인-흐름)
2. [조항 분석 로직](#조항-분석-로직)
3. [위험 분석 로직 및 프롬프트](#위험-분석-로직-및-프롬프트)
4. [데이터베이스 테이블 구조](#데이터베이스-테이블-구조)

---

## 전체 파이프라인 흐름

### 1. API 엔드포인트
**파일**: `backend/api/routes_legal_v2.py`
**엔드포인트**: `POST /api/v2/legal/analyze-contract`

### 2. 처리 단계

```
[1] 파일 업로드
    ↓
[2] 텍스트 추출 (PDF/HWPX → 텍스트)
    - DocumentProcessor.process_file()
    ↓
[3] 조항 단위 청킹 및 벡터 저장
    - processor.to_contract_chunks()
    - 임베딩 생성 (BAAI/bge-m3)
    - contract_chunks 테이블에 저장
    ↓
[4] Dual RAG 검색
    - 계약서 내부 검색 (contract_chunks)
    - 외부 법령 검색 (legal_chunks)
    ↓
[5] LLM 위험 분석
    - build_contract_analysis_prompt()로 프롬프트 생성
    - Ollama/OpenAI로 위험 조항 식별
    ↓
[6] 조항 자동 분류
    - ClauseLabelingTool.execute()
    - LegalChunker.split_by_article()로 조항 추출
    ↓
[7] 하이라이트 생성
    - HighlightTool.execute()
    - originalText를 계약서 원문에서 찾아 하이라이트
    ↓
[8] DB 저장
    - contract_analyses 테이블
    - contract_issues 테이블
    ↓
[9] 응답 반환
    - ContractAnalysisResponseV2 형식
```

---

## 조항 분석 로직

### 1. 조항 추출 (ClauseLabelingTool)

**파일**: `backend/core/tools/clause_labeling_tool.py`

#### 실행 흐름:
```python
ClauseLabelingTool.execute(
    contract_text: str,  # 계약서 원문
    issues: List[Dict]   # 위험 이슈 리스트
)
```

#### 단계:
1. **조항 추출** (`_extract_clauses`)
   - `LegalChunker.split_by_article()` 호출
   - "제n조" 패턴 또는 키워드 기반 섹션 분할
   - 각 조항의 `start_index`, `end_index` 계산

2. **Issue와 조항 매핑** (`_map_issues_to_clauses`)
   - `issue.originalText`가 조항 본문에 포함되는지 확인
   - 매칭된 조항에 issue ID 연결

#### LegalChunker 로직:

**파일**: `backend/core/legal_chunker.py`

**조항 인식 방법**:
1. **"제n조" 패턴** (우선순위 1)
   - 정규식: `^제\s*\d+\s*조\b.*`
   - 예: "제1조 (목적)", "제 2 조"

2. **키워드 기반** (패턴이 없을 때)
   - 섹션 키워드:
     - `근로계약기간`, `근무 장소`, `업무의 내용`
     - `소정근로시간`, `휴게시간`, `임금`
     - `특약사항`, `수습 기간`, `연차유급휴가`
     - `사회보험 적용`, `근로계약서 교부`, `기타`

**출력 형식**:
```python
{
    "clauses": [
        {
            "id": "clause-1",
            "title": "제1조 (목적)",
            "content": "조항 본문...",
            "articleNumber": 1,
            "startIndex": 0,
            "endIndex": 150,
            "category": "working_hours"
        }
    ],
    "issue_clause_mapping": {
        "issue-1": ["clause-1", "clause-2"]
    }
}
```

---

## 위험 분석 로직 및 프롬프트

### 1. Dual RAG 검색

**파일**: `backend/core/legal_rag_service.py`

#### 검색 단계:
1. **쿼리 생성**
   ```python
   query = _build_query_from_contract(extracted_text, description)
   # 계약서 앞부분 2000자 또는 조항 제목만 사용
   ```

2. **계약서 내부 검색** (contract_chunks)
   - `doc_id`가 있으면 계약서 내부 청크 검색
   - 벡터 유사도 검색 (top_k=5)
   - 조항 번호 기반 boosting 지원

3. **외부 법령 검색** (legal_chunks)
   - 법령/가이드/케이스 검색 (top_k=8)
   - source_type: `law`, `manual`, `case`, `standard_contract`

### 2. LLM 프롬프트

**파일**: `backend/core/prompts.py`
**함수**: `build_contract_analysis_prompt()`

#### 프롬프트 구조:

```
[시스템 프롬프트]
당신은 한국 노동법 전문가입니다...

[분석 대상 계약서]
{contract_text_for_prompt}
- 전체 텍스트가 3000자 이하: 전체 전달
- 3000~9000자: 앞 3000자 + 뒤 3000자
- 9000자 이상: 앞 3000자 + 중간 3000자 + 뒤 3000자

[계약서 주요 조항] (contract_chunks)
- 제{article_number}조: {content[:400]}

[참고 법령/가이드라인] (grounding_chunks)
- [source_type] {title}: {snippet[:200]}

[JSON 형식 응답 요청]
{
    "risk_score": 0-100,
    "risk_level": "low" | "medium" | "high",
    "summary": "전체 위험도 요약",
    "issues": [
        {
            "name": "이슈 이름",
            "description": "위험 조항 설명",
            "original_text": "계약서 원문의 실제 텍스트 (반드시 원문과 일치)",
            "severity": "low" | "medium" | "high",
            "legal_basis": ["근로기준법 제XX조"],
            "suggested_text": "개선된 조항",
            "rationale": "왜 위험한지",
            "suggested_questions": ["협상 질문"]
        }
    ],
    "recommendations": [...]
}
```

#### 프롬프트 최적화:
- **legal_context**: 8개 × 300자 → **5개 × 200자**로 축소
- **contract_context**: 상위 5개 조항만 사용 (각 400자)
- **응답 규칙**: 간소화 (5개 핵심 규칙만)

---

## 데이터베이스 테이블 구조

### 1. contract_analyses (계약서 분석 결과)

**주요 컬럼**:
```sql
id                  UUID (PK)
doc_id              TEXT (고유 문서 ID)
user_id             UUID (FK → auth.users)
file_name           TEXT (파일명, 캐시 조회용)
title               TEXT (계약서 제목)
contract_text       TEXT (계약서 원문 텍스트)
risk_score          INTEGER (0-100)
risk_level          TEXT ('low' | 'medium' | 'high')
summary             TEXT (분석 요약)
sections            JSONB ({working_hours: 80, wage: 70, ...})
retrieved_contexts  JSONB (RAG 검색 결과)
clauses             JSONB (조항 목록)
highlighted_texts   JSONB (하이라이트된 텍스트)
analysis_result     JSONB (전체 분석 결과)
created_at          TIMESTAMPTZ
```

**clauses JSONB 구조**:
```json
[
    {
        "id": "clause-1",
        "title": "제1조 (목적)",
        "content": "조항 본문...",
        "articleNumber": 1,
        "startIndex": 0,
        "endIndex": 150,
        "category": "working_hours"
    }
]
```

**highlighted_texts JSONB 구조**:
```json
[
    {
        "text": "위험 조항 텍스트",
        "startIndex": 100,
        "endIndex": 200,
        "severity": "high",
        "issueId": "issue-1"
    }
]
```

### 2. contract_chunks (계약서 청크)

**주요 컬럼**:
```sql
id              UUID (PK)
contract_id     TEXT (FK → contract_analyses.doc_id)
article_number  INTEGER (조 번호)
paragraph_index INTEGER (문단 인덱스)
content         TEXT (청크 내용)
chunk_index     INTEGER (청크 순서)
chunk_type      TEXT ('article' | 'paragraph')
embedding       VECTOR (임베딩 벡터, 1024차원)
metadata        JSONB (추가 메타데이터)
created_at      TIMESTAMPTZ
```

**용도**:
- Dual RAG의 계약서 내부 검색
- 조항 단위 벡터 검색
- Issue 기반 boosting

### 3. contract_issues (위험 이슈)

**주요 컬럼**:
```sql
id                    UUID (PK)
contract_analysis_id UUID (FK → contract_analyses.id)
issue_id              TEXT (이슈 고유 ID)
category              TEXT (이슈 카테고리)
severity              TEXT ('low' | 'medium' | 'high')
summary               TEXT (이슈 요약)
original_text         TEXT (계약서 원문의 위험 조항)
legal_basis           TEXT[] (법적 근거 배열)
explanation           TEXT (설명)
suggested_revision    TEXT (개선안)
created_at            TIMESTAMPTZ
```

### 4. legal_chunks (법령 청크)

**주요 컬럼**:
```sql
id           UUID (PK)
external_id  TEXT (외부 문서 ID)
source_type  TEXT ('law' | 'manual' | 'case' | 'standard_contract')
title        TEXT (제목)
content      TEXT (내용)
chunk_index  INTEGER
embedding    VECTOR (임베딩 벡터)
metadata     JSONB
created_at   TIMESTAMPTZ
```

**용도**:
- Dual RAG의 외부 법령 검색
- 위험 분석 시 법적 근거 제공

---

## 주요 처리 로직 상세

### 1. 하이라이트 매칭 (HighlightTool)

**파일**: `backend/core/tools/highlight_tool.py`

**매칭 전략**:
1. **정확한 매칭** (우선순위 1)
   - `contract_text.find(cleaned_original_text)`
   - 페이지 정보 제거 후 매칭

2. **키워드 기반 매칭** (우선순위 2)
   - `originalText`에서 핵심 키워드 추출
   - 키워드가 포함된 문장 찾기

3. **부분 매칭** (우선순위 3)
   - `originalText`의 처음 50자로 검색
   - 문장 단위로 확장

4. **중복 제거**
   - 겹치는 하이라이트 제거
   - 높은 severity 우선

### 2. originalText 검증

**파일**: `backend/api/routes_legal_v2.py` (라인 308-344)

**검증 단계**:
1. 페이지 정보 제거: `"페이지 2/2 1. 근로계약서"` → `"1. 근로계약서"`
2. 정확한 매칭 확인
3. 부분 매칭 시도 (50자 기준)
4. 문장 단위로 확장하여 추출

---

## 캐시 조회 로직

**파일**: `backend/api/routes_legal_v2.py` (라인 148-177)

**현재 상태**: 개발 모드로 비활성화됨

**로직**:
1. `file_name`으로 `contract_analyses` 조회
2. `created_at DESC LIMIT 1`로 최신 결과 가져오기
3. "분석 완료" 확인:
   - `clauses`가 비어있지 않음 (`[]` 아님)
   - 또는 `analysis_result IS NOT NULL`
4. 완료된 결과면 즉시 반환, 아니면 전체 파이프라인 실행

---

## 성능 최적화

### 1. 프롬프트 길이 최적화
- **legal_context**: 8개 × 300자 → 5개 × 200자
- **contract_context**: 상위 5개만 사용
- **응답 규칙**: 간소화

### 2. 텍스트 샘플링
- 긴 계약서는 앞/중간/뒤 부분만 샘플링
- 최대 9000자까지 전달 (3000자 × 3)

### 3. 비동기 처리
- 임베딩 생성: `asyncio.to_thread()`
- contract_chunks 저장 후 분석 시작 (Race condition 방지)

---

## 에러 처리

### 1. 조항 추출 실패
- `clauses`가 비어있으면 경고 로그
- 계속 진행 (빈 배열 반환)

### 2. 하이라이트 매칭 실패
- `originalText`를 찾지 못하면 경고 로그
- 계속 진행 (하이라이트 없이 반환)

### 3. DB 저장 실패
- 경고 로그만 남기고 응답은 반환
- 사용자는 결과를 볼 수 있음

---

## 참고 파일

- **API 엔드포인트**: `backend/api/routes_legal_v2.py` (라인 130-540)
- **조항 분석**: `backend/core/tools/clause_labeling_tool.py`
- **하이라이트**: `backend/core/tools/highlight_tool.py`
- **프롬프트**: `backend/core/prompts.py` (라인 153-282)
- **RAG 서비스**: `backend/core/legal_rag_service.py` (라인 106-150)
- **청커**: `backend/core/legal_chunker.py`
- **DB 저장**: `backend/core/contract_storage.py`

