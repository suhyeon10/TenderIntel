# RAG Citation 구현 최종 지시서

## 📋 개요

계약서 분석 시 RAG로 검색된 법적 근거를 구조화된 형식으로 제공하고, 출처 PDF 파일을 다운로드할 수 있도록 구현한 시스템입니다.

## 1. 데이터/스토리지 규칙

### 1-1. legal_chunks 테이블 스키마 (핵심 필드)

```sql
legal_chunks (
  id           uuid        primary key,
  source_type  text,       -- 'law' | 'manual' | 'case' | 'standard_contract' ...
  title        text,       -- 사람이 보는 문서 이름 (PDF 제목)
  external_id  text,       -- 스토리지 파일 키의 베이스 (md5 또는 파일명)
  content      text,       -- RAG에 쓰인 청크 텍스트
  chunk_index  int,        -- 문서 내 청크 순서
  file_path    text,       -- 스토리지 경로 (선택적, 없으면 자동 생성)
  -- (page, section 등 메타는 선택)
)
```

### 1-2. Supabase Storage 규칙

**버킷 이름**: `legal-sources`

**object key 규칙**:
```
{source_type_folder}/{external_id}.pdf
```

**source_type → folder_name 매핑**:
- `law` → `laws`
- `manual` → `manuals`
- `case` → `cases`
- `standard_contract` → `standard_contracts`

**예시**:
- `standard_contracts/437f9719fcdf4fb0a3b011315b75c56c.pdf`
- `laws/2025년 청소년 노동권리 안내서_게시용.pdf`

**참고**: 실제 Storage 구조는 복수형 폴더명을 사용합니다.

## 2. 프론트엔드 타입 정의

### LegalBasisItem 인터페이스

```typescript
export interface LegalBasisItem {
  sourceType: 'law' | 'manual' | 'case' | 'standard_contract' | string
  title: string             // legal_chunks.title (문서 이름)
  snippet: string           // legal_chunks.content 일부 (참조한 텍스트)
  filePath: string          // 스토리지 object key (예: "laws/xxx.pdf")
  externalId?: string       // legal_chunks.external_id
  chunkIndex?: number       // legal_chunks.chunk_index
  similarityScore?: number  // (선택) 벡터 유사도
  reason?: string           // 이 이슈에 이 근거를 붙인 이유 (LLM 한 줄 설명)
  status?: string           // "likely" | "unclear" | "unlikely" (레거시 호환)
}
```

### 프론트엔드 사용법

- `title`, `sourceType` → 카드 헤더 / 배지
- `snippet` → 본문에 그대로 표시
- `filePath` → `/api/v2/legal/file?path=...` 로 열기/다운로드
- `reason` → "이 근거를 왜 붙였는지" 설명 영역/툴팁
- `similarityScore`, `chunkIndex` → 필요 시 디버그/표시

## 3. API 응답 규격

### 계약서 분석 API 응답 예시

```json
{
  "docId": "65fb23aa-e7bd-4eff-a16b-ea396f6cdc5b",
  "title": "김인턴 샘플 근로계약서.pdf",
  "riskScore": 65,
  "riskLevel": "medium",
  "issues": [
    {
      "id": "issue-1",
      "category": "working_hours",
      "severity": "high",
      "summary": "근로시간·휴게시간이 포괄임금으로 뭉뚱그려져 있습니다.",
      "originalText": "… 실제 계약서 조항 전문 …",
      "explanation": "… 왜 위험한지 설명 …",
      "suggestedRevision": "… 수정 예시 …",
      "clauseId": "clause-1-working_hours",
      "startIndex": 123,
      "endIndex": 234,
      "legalBasis": [
        {
          "sourceType": "standard_contract",
          "title": "개정 표준근로계약서(2025년, 배포).pdf",
          "snippet": "제17조 이행) ... 이 계약에 정함이 없는 사항은 근로관계법령에 따름 ...",
          "filePath": "standard_contracts/437f9719fcdf4fb0a3b011315b75c56c.pdf",
          "externalId": "437f9719fcdf4fb0a3b011315b75c56c",
          "chunkIndex": 523,
          "similarityScore": 0.87,
          "reason": "표준근로계약서는 근로조건 명시 의무를 규정하고 있어, 현재 근로시간·휴게 조항이 법령 수준을 충족하는지 비교 기준이 됩니다."
        }
      ]
    }
  ],
  "retrievedContexts": [ ... ],
  "clauses": [ ... ],
  "contractText": "..."
}
```

**중요**: `legalBasis`는 더 이상 단순 문자열 배열이 아닌 `LegalBasisItem[]` 구조로 반환됩니다.

## 4. 백엔드 구현

### 4-1. filePath 생성 로직

**위치**: `backend/core/legal_rag_service.py::_build_file_path()`

```python
def _build_file_path(self, source_type: str, external_id: str) -> str:
    """
    Storage 파일 경로 생성
    
    Args:
        source_type: 'law' | 'manual' | 'case' | 'standard_contract'
        external_id: 파일 키 (MD5 or filename)
    
    Returns:
        Storage object key (예: "standard_contracts/437f9719fcdf4fb0a3b011315b75c56c.pdf")
    """
    # source_type을 폴더명으로 변환
    folder_mapping = {
        "law": "laws",
        "manual": "manuals",
        "case": "cases",
        "standard_contract": "standard_contracts",
    }
    folder_name = folder_mapping.get(source_type, source_type)
    
    # external_id에 확장자가 없다는 가정이면 .pdf 추가
    if not external_id.lower().endswith(".pdf"):
        object_name = f"{external_id}.pdf"
    else:
        object_name = external_id
    
    # 경로 규칙: {folder_name}/{object_name}
    return f"{folder_name}/{object_name}"
```

### 4-2. LegalBasisItem 생성 로직

**위치**: `backend/core/legal_rag_service.py::_llm_summarize_risk()`

이슈별 legal 검색 후 `LegalBasisItemV2` 객체 생성:

```python
issue_legal_basis.append(
    LegalBasisItemV2(
        title=chunk.title,
        snippet=chunk.snippet,
        sourceType=chunk.source_type,
        status="unclear",
        filePath=file_path,  # _build_file_path()로 생성
        similarityScore=chunk.score,
        chunkIndex=chunk.chunk_index,
        externalId=chunk.external_id,
        reason=reason,  # _build_reason()으로 생성
    )
)
```

### 4-3. reason 생성 로직 (선택적, 권장)

**위치**: `backend/core/legal_rag_service.py::_build_reason()`

```python
async def _build_reason(
    self,
    issue_summary: str,
    clause_text: str,
    basis_snippet: str,
) -> Optional[str]:
    """
    "왜 이 근거를 붙였는지" LLM 한 줄 설명 생성
    """
    prompt = f"""아래 세 정보를 보고, 왜 이 법령/표준계약서 스니펫이 이 이슈의 근거가 되는지
한국어로 1~2문장으로 간단하게 설명해줘.

[이슈 요약]
{issue_summary[:500]}

[계약서 조항]
{clause_text[:500]}

[법령/표준계약서 스니펫]
{basis_snippet[:500]}"""
    
    # Groq 또는 Ollama로 LLM 호출
    # ...
```

## 5. 파일 다운로드 API

### 5-1. 엔드포인트

```
GET /api/v2/legal/file?path={filePath}[&download=true]
```

**파라미터**:
- `path`: `LegalBasisItem.filePath` 그대로 (예: `laws/xxx.pdf`)
- `download`: `true`면 다운로드 모드, 없으면 브라우저에서 열기

### 5-2. 구현 위치

**위치**: `backend/api/routes_legal_v2.py::get_legal_file()`

**Storage 버킷**: `legal-sources`

**응답 헤더**:
- `download=true`: `Content-Disposition: attachment; filename="..."`
- `download` 없음: `Content-Disposition: inline`

### 5-3. 프론트엔드 사용 예시

```tsx
// 파일 열기
<a
  href={`${BACKEND_URL}/api/v2/legal/file?path=${encodeURIComponent(basis.filePath)}`}
  target="_blank"
>
  열기
</a>

// 파일 다운로드
<a
  href={`${BACKEND_URL}/api/v2/legal/file?path=${encodeURIComponent(basis.filePath)}&download=true`}
  download
>
  다운로드
</a>
```

## 6. 구현 체크리스트

### ✅ DB
- [x] `legal_chunks.source_type`, `title`, `external_id`, `content`, `chunk_index` 정상 저장
- [x] `file_path` 컬럼 존재 (선택적, 없으면 자동 생성)

### ✅ 스토리지
- [x] `legal-sources` 버킷 사용
- [x] `{source_type_folder}/{external_id}.pdf` 규칙으로 업로드
- [x] source_type → folder_name 매핑 적용

### ✅ RAG
- [x] 검색 결과에서 `legal_chunks` row를 정확히 가져옴
- [x] 각 row → `LegalBasisItem`으로 매핑
- [x] `file_path`가 없으면 `external_id`로 자동 생성
- [x] `similarityScore`, `chunkIndex`, `externalId` 포함

### ✅ API 응답
- [x] `issues[].legalBasis`는 `LegalBasisItem[]` 구조
- [x] 기존 단순 문자열 배열 형식 제거
- [x] `retrievedContexts`에도 `filePath`, `externalId`, `chunkIndex` 포함

### ✅ 파일 API
- [x] `/api/v2/legal/file?path=`로 열기
- [x] `&download=true`로 다운로드
- [x] Storage 버킷 `legal-sources` 사용

### ✅ 출처/이유 설명
- [x] `snippet`으로 "어떤 내용을 참조했는지" 노출
- [x] `title`/`sourceType`/`filePath`로 "어떤 문서인지 + 바로 열기/다운로드" 가능
- [x] `reason`으로 "왜 이 이슈의 근거인지" 한 줄 설명 (LLM 생성, 선택적)

## 7. 주요 파일 위치

### 백엔드
- **스키마**: `backend/models/schemas.py` - `LegalBasisItemV2`, `LegalGroundingChunk`
- **filePath 생성**: `backend/core/legal_rag_service.py::_build_file_path()`
- **reason 생성**: `backend/core/legal_rag_service.py::_build_reason()`
- **RAG 검색**: `backend/core/legal_rag_service.py::_search_legal_chunks()`
- **이슈별 검색**: `backend/core/legal_rag_service.py::_llm_summarize_risk()`
- **API 엔드포인트**: `backend/api/routes_legal_v2.py::analyze_contract()`
- **파일 다운로드**: `backend/api/routes_legal_v2.py::get_legal_file()`

### 프론트엔드
- **타입 정의**: `src/types/legal.ts` - `LegalBasisItem`
- **UI 컴포넌트**: `src/components/contract/AnalysisPanel.tsx`

## 8. 완성된 기능

이제 **"RAG니까, 어떤 문서에서 어떤 내용을 근거로 삼았고, 왜 이 이슈에 붙였는지 + 실제 출처 PDF까지 전부 보여주는 시스템"**이 완성되었습니다.

### 사용자 경험
1. 계약서 분석 시 각 이슈에 법적 근거가 구조화된 형식으로 표시됨
2. 각 근거의 출처 문서를 바로 열거나 다운로드 가능
3. "왜 이 근거를 붙였는지" 설명으로 이해도 향상
4. 벡터 유사도 점수로 신뢰도 확인 가능

