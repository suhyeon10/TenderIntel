# Python Backend 구조

## 📁 디렉토리 구조

```
backend/
├── main.py                 # FastAPI 앱 진입점
├── config.py              # 설정 관리 (Pydantic)
├── requirements.txt       # Python 의존성
│
├── api/                   # API 라우터
│   ├── __init__.py
│   └── routes.py          # REST API 엔드포인트
│
├── core/                  # 핵심 RAG 로직
│   ├── __init__.py
│   ├── document_processor.py  # PDF 처리 & 청킹
│   ├── vector_store.py         # 벡터 DB 관리 (ChromaDB)
│   ├── retriever.py            # 검색 로직
│   ├── generator.py            # LLM 생성 (분석, 견적)
│   ├── orchestrator.py         # 전체 파이프라인 조율
│   ├── bidding_rag.py          # 복잡한 분석 전담
│   └── async_tasks.py          # 비동기 작업 관리
│
└── models/               # 데이터 모델
    ├── __init__.py
    └── schemas.py        # Pydantic 스키마
```

## 🔧 주요 모듈 설명

### 1. `main.py` - FastAPI 앱
- FastAPI 앱 생성
- CORS 설정
- 라우터 등록
- 서버 실행 (Uvicorn)

### 2. `config.py` - 설정 관리
```python
class Settings(BaseSettings):
    openai_api_key: str          # OpenAI API 키
    embedding_model: str         # 임베딩 모델
    llm_model: str               # LLM 모델
    chroma_persist_dir: str      # ChromaDB 저장 경로
    chunk_size: int              # 청크 크기
    chunk_overlap: int           # 청크 오버랩
```

### 3. `core/document_processor.py` - 문서 처리
**역할**: PDF → 텍스트 → 청크

**주요 메서드**:
- `process_pdf(pdf_path)`: PDF 처리 및 청킹
- `extract_structured_info(text)`: 정규식으로 정보 추출 (예산, 기간 등)
- `create_team_document(team_data)`: 팀 프로필을 문서로 변환

**청킹 설정**:
- 청크 크기: 1000자
- 오버랩: 200자
- 구분자: `["\n\n", "\n", ". ", " ", ""]`

### 4. `core/vector_store.py` - 벡터 저장소
**역할**: ChromaDB 또는 Supabase pgvector 관리

**현재 상태**:
- ⚠️ ChromaDB: Windows 빌드 문제로 사용 불가
- ✅ Supabase pgvector: Frontend에서 사용 중

**주요 메서드**:
- `add_announcement()`: 공고문 벡터 저장
- `add_team()`: 팀 프로필 저장
- `search_similar_announcements()`: 유사 공고 검색
- `search_matching_teams()`: 팀 매칭 검색
- `get_announcement_by_id()`: 공고 조회

### 5. `core/retriever.py` - 검색 로직
**역할**: 하이브리드 검색 (벡터 + 메타데이터)

**주요 메서드**:
- `retrieve_for_analysis()`: 분석용 컨텍스트 수집
- `retrieve_for_matching()`: 팀 매칭용 검색
- `retrieve_similar_estimates()`: 과거 견적 검색

### 6. `core/generator.py` - LLM 생성
**역할**: GPT를 사용한 텍스트 생성

**주요 메서드**:
- `analyze_announcement()`: 공고문 분석 (구조화된 정보 추출)
- `generate_matching_rationale()`: 팀 추천 사유 생성
- `generate_estimate_draft()`: 견적서 초안 생성

**사용 모델**:
- LLM: `gpt-4o-mini`
- Temperature: `0.1` (일관성 중시)

### 7. `core/orchestrator.py` - 파이프라인 조율
**역할**: 전체 RAG 워크플로우 통합

**주요 메서드**:
- `process_announcement()`: 공고 분석 전체 플로우
- `match_teams()`: 팀 매칭 플로우
- `generate_estimate()`: 견적서 생성 플로우

**프로세스**:
```
1. PDF 처리 (DocumentProcessor)
2. 벡터 저장 (VectorStoreManager)
3. 유사 공고 검색 (HybridRetriever)
4. LLM 분석 (LLMGenerator)
5. 결과 반환
```

### 8. `api/routes.py` - REST API
**엔드포인트**:
- `POST /api/announcements/upload`: 공고 업로드
- `GET /api/announcements/{id}/match`: 팀 매칭
- `POST /api/estimates/generate`: 견적서 생성
- `POST /api/analysis/start`: 분석 작업 시작 (비동기)
- `GET /api/analysis/stream/{job_id}`: 진행 상황 스트리밍 (SSE)
- `GET /api/analysis/status/{job_id}`: 작업 상태 조회
- `GET /api/health`: 헬스 체크

### 9. `core/async_tasks.py` - 비동기 작업
**역할**: 장시간 작업을 백그라운드에서 처리

**주요 클래스**:
- `AsyncTaskManager`: 작업 상태 관리
- `start_analysis_task()`: 분석 작업 시작
- `get_task_status()`: 작업 상태 조회

### 10. `models/schemas.py` - 데이터 모델
**Pydantic 스키마**:
- `AnnouncementAnalysis`: 공고 분석 결과
- `MatchedTeam`: 매칭된 팀 정보
- `EstimateRequest`: 견적서 생성 요청
- `APIResponse`: API 응답 형식

## 🔄 데이터 흐름

### 공고 분석 플로우
```
PDF 파일 업로드
  ↓
DocumentProcessor.process_pdf()
  - PDF → 텍스트 추출
  - 텍스트 → 청크 분할
  ↓
VectorStoreManager.add_announcement()
  - 청크 → 임베딩 생성
  - ChromaDB/Supabase 저장
  ↓
HybridRetriever.retrieve_for_analysis()
  - 유사 과거 공고 검색
  ↓
LLMGenerator.analyze_announcement()
  - GPT로 구조화된 분석
  ↓
결과 반환
```

### 팀 매칭 플로우
```
공고 ID 입력
  ↓
VectorStoreManager.get_announcement_by_id()
  - 공고 정보 조회
  ↓
HybridRetriever.retrieve_for_matching()
  - 요구사항 → 검색 쿼리 변환
  - 벡터 검색으로 팀 찾기
  ↓
LLMGenerator.generate_matching_rationale()
  - 각 팀별 추천 사유 생성
  ↓
결과 반환
```

## ⚠️ 현재 제한사항

### 1. ChromaDB 미사용
- **원인**: Windows C++ 빌드 도구 필요
- **해결**: Supabase pgvector 사용 (Frontend에서 처리)

### 2. 벡터 저장소 연동 필요
- Backend의 `vector_store.py`는 ChromaDB 기반
- Supabase 연동 로직 추가 필요

### 3. 비동기 작업 미완성
- `async_tasks.py`는 기본 구조만 있음
- 실제 분석 작업 구현 필요

## 🚀 개선 방향

### 1. Supabase 연동
```python
# backend/core/supabase_vector_store.py (새로 생성)
class SupabaseVectorStore:
    def __init__(self):
        self.supabase = create_client(...)
    
    def add_announcement(self, chunks, announcement_id, metadata):
        # Supabase doc_chunks 테이블에 저장
        pass
```

### 2. 비동기 작업 완성
```python
# backend/core/async_tasks.py
@celery_app.task
def analyze_announcement_task(doc_id: str):
    # 실제 분석 로직
    pass
```

### 3. 에러 처리 강화
- 각 단계별 try-catch
- 상세한 에러 메시지
- 재시도 로직

## 📊 현재 상태

| 모듈 | 상태 | 비고 |
|------|------|------|
| DocumentProcessor | ✅ 완료 | PDF 처리, 청킹 |
| VectorStoreManager | ⚠️ 부분 | ChromaDB 미사용 |
| Retriever | ✅ 완료 | 검색 로직 |
| Generator | ✅ 완료 | LLM 생성 |
| Orchestrator | ✅ 완료 | 파이프라인 통합 |
| API Routes | ✅ 완료 | REST API |
| Async Tasks | ⚠️ 부분 | 기본 구조만 |

## 🔗 Frontend와의 연동

현재 Backend는 독립적으로 작동하지만, Frontend와 연동하려면:

1. **Backend API 클라이언트 생성** (Frontend)
2. **Supabase 연동** (Backend)
3. **비동기 작업 완성** (Backend)

자세한 내용은 `RAG_API_USAGE_GUIDE.md` 참고

