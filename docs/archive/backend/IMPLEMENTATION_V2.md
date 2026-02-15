# Backend v2 구현 가이드

## ✅ 구현 완료

### 1. 데이터베이스 스키마
- ✅ `announcements` - 공고 메타데이터 (버전 관리)
- ✅ `announcement_bodies` - 공고 본문
- ✅ `announcement_chunks` - 벡터 청크 (pgvector)
- ✅ `announcement_analysis` - 분석 결과

### 2. 핵심 모듈
- ✅ `supabase_vector_store.py` - Supabase pgvector 어댑터
- ✅ `document_processor_v2.py` - 문서 처리 (PDF → 청크)
- ✅ `generator_v2.py` - 임베딩 및 LLM 생성
- ✅ `orchestrator_v2.py` - 전체 파이프라인
- ✅ `routes_v2.py` - REST API

## 🔄 마이그레이션 방법

### 기존 코드에서 v2로 전환

#### 1. Import 변경
```python
# 기존
from core.orchestrator import RAGOrchestrator
from core.vector_store import VectorStoreManager

# v2
from core.orchestrator_v2 import Orchestrator
from core.supabase_vector_store import SupabaseVectorStore
```

#### 2. API Routes 변경
```python
# 기존 routes.py를 routes_v2.py로 교체
# 또는 main.py에서 라우터 변경
```

#### 3. 환경 변수 추가
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
DATABASE_URL=postgresql://... (선택)
```

## 📋 사용 방법

### 1. 파일 업로드
```bash
curl -X POST http://localhost:8000/api/announcements/upload \
  -F "file=@announcement.pdf" \
  -F "source=나라장터" \
  -F "external_id=NTIS-2024-001" \
  -F "title=웹사이트 구축 사업" \
  -F "agency=한국공공기관" \
  -F "budget_min=100000000" \
  -F "budget_max=300000000"
```

### 2. 텍스트 직접 업로드
```bash
curl -X POST http://localhost:8000/api/announcements/text \
  -F "text=공고 내용..." \
  -F "source=수기" \
  -F "title=샘플 공고"
```

### 3. 분석 결과 조회
```bash
curl http://localhost:8000/api/announcements/{announcement_id}/analysis
```

## 🔧 다음 단계

### 1. Supabase RPC 함수 생성 (성능 최적화)

```sql
-- 벡터 검색 함수
CREATE OR REPLACE FUNCTION match_announcement_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  announcement_id uuid,
  chunk_index int,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.announcement_id,
    ac.chunk_index,
    ac.content,
    1 - (ac.embedding <=> query_embedding) as similarity,
    ac.metadata
  FROM announcement_chunks ac
  WHERE 1 - (ac.embedding <=> query_embedding) > match_threshold
  ORDER BY ac.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 2. 비동기 작업 완성
- Celery 워커 설정
- 대량 배치 처리
- 진행 상황 추적

### 3. 검색 API 추가
- 하이브리드 검색 (벡터 + 메타데이터)
- 필터링 (예산, 기간, 기술 스택)
- 정렬 및 페이징

## 📊 성능 최적화

### 현재: Row-by-row insert
- 작은 규모: 충분
- 대량 처리: 느림

### 개선: RPC 함수 사용
```python
# Supabase RPC로 일괄 처리
self.sb.rpc("bulk_insert_chunks", {
    "chunks": payload
}).execute()
```

## 🚨 주의사항

1. **Service Role Key 보안**
   - 서버에서만 사용
   - 프론트엔드 노출 금지

2. **중복 방지**
   - `source + external_id + content_hash` 조합
   - 버전 관리 자동화

3. **벡터 인덱스**
   - `ivfflat` 인덱스는 데이터가 충분할 때 생성
   - 초기에는 순차 검색 가능

