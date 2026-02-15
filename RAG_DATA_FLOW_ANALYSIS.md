# RAG 데이터 흐름 분석 결과

## ✅ 확인된 사항

### 1. RAG 데이터는 DB 기반으로 동작합니다

**데이터 소스**: `legal_chunks` 테이블 (Supabase)

**검색 프로세스**:
1. `backend/core/legal_rag_service.py::_search_legal_chunks()` 
   - 쿼리 임베딩 생성
   - `SupabaseVectorStore::search_similar_legal_chunks()` 호출

2. `backend/core/supabase_vector_store.py::search_similar_legal_chunks()`
   - `legal_chunks` 테이블에서 벡터 검색 수행
   - 반환 데이터:
     ```python
     {
         "id": str,                    # legal_chunks.id
         "external_id": str,            # 파일명/케이스 ID
         "source_type": str,            # 'law' | 'manual' | 'case'
         "title": str,                  # legal_chunks.title (문서 이름)
         "content": str,                # legal_chunks.content (참고한 내용)
         "chunk_index": int,
         "file_path": str,              # legal_chunks.file_path
         "metadata": Dict,
         "score": float                 # 유사도 점수
     }
     ```

3. `backend/api/routes_legal_v2.py::analyze_situation()`
   - grounding_chunks를 sources로 변환:
     ```python
     sources.append({
         "sourceId": chunk.get("source_id", ""),      # legal_chunks.id
         "sourceType": chunk.get("source_type", "law"),
         "title": chunk.get("title", ""),             # ✅ legal_chunks.title
         "snippet": chunk.get("snippet", ""),         # ✅ content 일부 (300자)
         "score": float(chunk.get("score", 0.0)),
     })
     ```

### 2. 현재 프론트엔드 표시 방식

**위치**: `src/app/legal/situation/page.tsx` (1370-1371 라인)

현재는 **청소년·청년 노동 가이드 카드**에서:
- `sources[0].snippet`을 1~2줄로 요약하여 표시
- `title`은 표시하지 않음
- **스토리지 파일 다운로드 URL은 생성하지 않음**

## ❌ 누락된 기능

### 1. 스토리지 파일 다운로드 URL 생성

**요구사항**: `{external_id}.pdf`를 스토리지에서 검색 후 문서 다운로드 URL 생성

**버킷 구조**:
```
legal-sources/
  ├── cases/
  ├── laws/
  ├── manuals/
  └── standard_contracts/
```

**필요한 작업**:
1. `external_id`를 기반으로 스토리지에서 파일 검색
2. `source_type`에 따라 적절한 버킷 경로 결정:
   - `law` → `legal-sources/laws/{external_id}.pdf`
   - `manual` → `legal-sources/manuals/{external_id}.pdf`
   - `case` → `legal-sources/cases/{external_id}.pdf`
   - `standard_contract` → `legal-sources/standard_contracts/{external_id}.pdf`
3. Supabase Storage에서 signed URL 또는 public URL 생성

### 2. 프론트엔드에 표시할 정보 추가

**현재 표시**:
- ✅ content (snippet) - 1~2줄 요약
- ❌ title (문서 이름) - 표시 안 함
- ❌ 파일 다운로드 URL - 없음

**추가 필요**:
- title 표시
- 파일 다운로드 링크 추가

## 📋 구현 방안

### 백엔드 수정

1. **스토리지 URL 생성 함수 추가** (`backend/core/supabase_vector_store.py`):
   ```python
   def get_storage_file_url(
       self,
       external_id: str,
       source_type: str,
       expires_in: int = 3600  # 1시간
   ) -> Optional[str]:
       """스토리지에서 파일 다운로드 URL 생성"""
       bucket_map = {
           'law': 'laws',
           'manual': 'manuals',
           'case': 'cases',
           'standard_contract': 'standard_contracts',
       }
       bucket = bucket_map.get(source_type, 'laws')
       file_path = f"{bucket}/{external_id}.pdf"
       
       try:
           # Signed URL 생성 (임시 접근)
           response = self.sb.storage.from_('legal-sources')\
               .create_signed_url(file_path, expires_in)
           return response.get('signedURL') if response else None
       except Exception as e:
           logger.warning(f"스토리지 URL 생성 실패: {e}")
           return None
   ```

2. **API 응답에 URL 추가** (`backend/api/routes_legal_v2.py`):
   ```python
   for chunk in grounding_chunks:
       external_id = chunk.get("external_id", "")
       source_type = chunk.get("source_type", "law")
       
       # 스토리지 URL 생성
       file_url = None
       if external_id:
           from core.supabase_vector_store import SupabaseVectorStore
           vector_store = SupabaseVectorStore()
           file_url = vector_store.get_storage_file_url(external_id, source_type)
       
       sources.append({
           "sourceId": chunk.get("source_id", ""),
           "sourceType": source_type,
           "title": chunk.get("title", ""),
           "snippet": chunk.get("snippet", ""),
           "score": float(chunk.get("score", 0.0)),
           "fileUrl": file_url,  # ✅ 추가
           "externalId": external_id,  # ✅ 추가
       })
   ```

### 프론트엔드 수정

1. **타입 정의 업데이트** (`src/types/legal.ts`):
   ```typescript
   export interface SourceItem {
     sourceId: string
     sourceType: 'law' | 'manual' | 'case'
     title: string
     snippet: string
     score: number
     fileUrl?: string  // ✅ 추가
     externalId?: string  // ✅ 추가
   }
   ```

2. **UI에 표시** (`src/app/legal/situation/page.tsx`):
   - title 표시
   - 파일 다운로드 링크 추가

## 🔍 확인 방법

1. **DB 확인**:
   ```sql
   SELECT id, external_id, source_type, title, content, file_path 
   FROM legal_chunks 
   LIMIT 5;
   ```

2. **스토리지 확인**:
   - Supabase Dashboard → Storage → `legal-sources` 버킷
   - 각 하위 폴더(laws, manuals, cases)에 `{external_id}.pdf` 파일 존재 여부 확인

3. **API 응답 확인**:
   - `/api/v2/legal/analyze-situation` 엔드포인트 호출
   - `sources` 배열에 `fileUrl`, `externalId` 포함 여부 확인

