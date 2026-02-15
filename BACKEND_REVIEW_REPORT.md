# 백엔드 검토 보고서

README에 명시된 백엔드 구조와 실제 파일을 비교하여 불필요한 파일을 식별합니다.

## 📋 README에 명시된 구조

```
backend/
├── api/                    # API 라우터
├── core/                   # 핵심 RAG 모듈
├── models/                 # 데이터 모델
├── scripts/                # 배치 처리 스크립트
├── data/                   # 데이터 저장소
├── main.py                 # FastAPI 메인 앱
├── config.py               # 설정 관리
└── requirements.txt        # Python 의존성
```

## 🔍 실제 파일 구조 분석

### API 라우터 (`backend/api/`)
1. ✅ `routes_legal_v2.py` - 법률 RAG API v2 (사용 중)
2. ✅ `routes_legal.py` - 법률 RAG API v1 (main.py에서 등록됨)
3. ✅ `routes_v2.py` - 공공입찰 API v2 (main.py에서 등록됨)
4. ⚠️ `routes.py` - 공공입찰 API v1 (main.py에서 등록됨, 사용 여부 확인 필요)

### Core 모듈 (`backend/core/`)
#### 문서 처리
1. ✅ `document_processor_v2.py` - v2 문서 처리기 (사용 중)
2. ⚠️ `document_processor.py` - v1 문서 처리기 (사용 여부 확인 필요)

#### 생성기
1. ✅ `generator_v2.py` - v2 LLM/임베딩 생성기 (사용 중)
2. ⚠️ `generator.py` - v1 생성기 (사용 여부 확인 필요)

#### 오케스트레이터
1. ✅ `orchestrator_v2.py` - v2 오케스트레이터 (사용 중)
2. ⚠️ `orchestrator.py` - v1 오케스트레이터 (사용 여부 확인 필요)

#### 벡터 스토어
1. ✅ `supabase_vector_store.py` - Supabase 벡터 스토어 (사용 중)
2. ⚠️ `vector_store.py` - 레거시 벡터 스토어 (사용 여부 확인 필요)

#### 기타
1. ✅ `legal_rag_service.py` - 법률 RAG 서비스 (사용 중)
2. ✅ `legal_chunker.py` - 법률 문서 청커 (사용 중)
3. ✅ `contract_storage.py` - 계약서 스토리지 (사용 중)
4. ✅ `retriever.py` - 검색기 (사용 중)
5. ✅ `async_tasks.py` - 비동기 작업 (사용 중)
6. ⚠️ `bidding_rag.py` - 공공입찰 RAG (사용 여부 확인 필요)
7. ✅ `tools/` - 계약서 분석 도구 (Phase 1-3 완료)

## 🔎 사용 여부 확인 필요

### v1 레거시 파일들
다음 파일들은 v2로 대체되었을 가능성이 높습니다:

1. `backend/api/routes.py` - v1 공공입찰 라우터
2. `backend/core/document_processor.py` - v1 문서 처리기
3. `backend/core/generator.py` - v1 생성기
4. `backend/core/orchestrator.py` - v1 오케스트레이터
5. `backend/core/vector_store.py` - 레거시 벡터 스토어

### 확인 방법
- `main.py`에서 import 여부 확인
- 다른 파일에서 import 여부 확인
- 실제 API 엔드포인트에서 사용 여부 확인

## 📊 사용 여부 확인 결과

### ✅ 실제 사용 중인 파일 (v2)
1. `routes_v2.py` - 공공입찰 API v2 (main.py 등록)
2. `routes_legal_v2.py` - 법률 API v2 (main.py 등록)
3. `routes_legal.py` - 법률 API v1 (main.py 등록, v2 프로세서 사용)
4. `orchestrator_v2.py` - v2 오케스트레이터 (routes_v2.py 사용)
5. `document_processor_v2.py` - v2 문서 처리기 (routes_legal_v2.py, routes_legal.py 사용)
6. `generator_v2.py` - v2 생성기 (orchestrator_v2.py, legal_rag_service.py 사용)
7. `supabase_vector_store.py` - Supabase 벡터 스토어 (orchestrator_v2.py, legal_rag_service.py 사용)

### ❌ 사용되지 않는 레거시 파일 (제거 가능)

#### 1. API 라우터
- `routes.py` - v1 공공입찰 라우터
  - **상태**: main.py에서 import되지 않음
  - **사용처**: 없음
  - **권장**: 제거

#### 2. Core 모듈 (v1)
- `orchestrator.py` - v1 오케스트레이터
  - **상태**: routes.py에서만 사용 (routes.py가 사용 안 됨)
  - **사용처**: routes.py만
  - **권장**: 제거

- `document_processor.py` - v1 문서 처리기
  - **상태**: orchestrator.py, bidding_rag.py에서만 사용 (둘 다 사용 안 됨)
  - **사용처**: orchestrator.py, bidding_rag.py
  - **권장**: 제거

- `generator.py` - v1 생성기
  - **상태**: orchestrator.py에서만 사용 (사용 안 됨)
  - **사용처**: orchestrator.py만
  - **권장**: 제거

- `vector_store.py` - 레거시 벡터 스토어
  - **상태**: orchestrator.py, bidding_rag.py, retriever.py에서 사용 (모두 사용 안 됨)
  - **사용처**: orchestrator.py, bidding_rag.py, retriever.py
  - **권장**: 제거

- `bidding_rag.py` - 공공입찰 RAG
  - **상태**: async_tasks.py에서만 사용 (async_tasks.py 사용 여부 확인 필요)
  - **사용처**: async_tasks.py만
  - **권장**: async_tasks.py 사용 여부 확인 후 결정

- `retriever.py` - 검색기
  - **상태**: orchestrator.py에서만 사용 (사용 안 됨)
  - **사용처**: orchestrator.py만
  - **권장**: 제거

## 🎯 권장 사항

### ✅ 제거 완료 (2025-01-18)
1. ✅ `backend/api/routes.py` - main.py에서 import 안 됨 → 제거됨
2. ✅ `backend/core/orchestrator.py` - routes.py에서만 사용 → 제거됨
3. ✅ `backend/core/generator.py` - orchestrator.py에서만 사용 → 제거됨
4. ✅ `backend/core/retriever.py` - orchestrator.py에서만 사용 → 제거됨

### ✅ 추가 제거 완료 (2025-01-18)
1. ✅ `backend/core/bidding_rag.py` - orchestrator_v2로 대체 → 제거됨
2. ✅ `backend/core/document_processor.py` - bidding_rag.py에서만 사용 → 제거됨
3. ✅ `backend/core/vector_store.py` - bidding_rag.py에서만 사용 → 제거됨

### ✅ 수정 완료
1. ✅ `backend/core/async_tasks.py` - bidding_rag.py → orchestrator_v2로 변경

### README 업데이트 필요
- v1 파일 제거 후 README 업데이트
- 사용 중인 파일만 명시

