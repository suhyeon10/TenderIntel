# 백엔드 로직 정리 보고서

## 개요
백엔드 코드의 구조를 분석하고 개선 사항을 정리했습니다.

## 주요 발견 사항

### 1. 버그 수정
- ✅ **routes_v2.py 338번 라인**: `task_manager` 변수가 정의되지 않아 `get_task_manager()`로 수정

### 2. 중복된 엔드포인트
다음 엔드포인트들이 중복되어 있습니다:

#### routes_v2.py에 있는 법률 관련 엔드포인트
- `GET /api/v2/legal/search` (660번 라인)
- `POST /api/v2/legal/analyze-contract` (747번 라인)

#### routes_legal_v2.py에 있는 동일한 엔드포인트
- `GET /api/v2/legal/search` (88번 라인)
- `POST /api/v2/legal/analyze-contract` (130번 라인)

**권장 사항**: `routes_v2.py`의 법률 관련 엔드포인트를 제거하고 `routes_legal_v2.py`만 사용하도록 통합

### 3. 코드 구조

#### 현재 구조
```
backend/
├── main.py                    # FastAPI 앱 진입점
├── config.py                  # 설정 관리
├── api/
│   ├── routes_v2.py          # 공고 RAG + 일부 법률 엔드포인트 (중복)
│   ├── routes_legal.py       # 법률 RAG v1 (레거시)
│   └── routes_legal_v2.py    # 법률 RAG v2 (가이드 스펙)
├── core/
│   ├── orchestrator_v2.py    # 공고 처리 오케스트레이터
│   ├── legal_rag_service.py  # 법률 RAG 서비스
│   ├── document_processor_v2.py  # 문서 처리
│   ├── generator_v2.py       # LLM 생성기
│   ├── supabase_vector_store.py  # 벡터 스토어
│   ├── contract_storage.py   # 계약서 저장 서비스
│   ├── async_tasks.py        # 비동기 작업 관리
│   └── tools/                # 계약서 분석 도구들
└── models/
    └── schemas.py            # Pydantic 모델
```

### 4. 개선 사항

#### 4.1 에러 처리 일관성
- 현재: 각 엔드포인트마다 에러 처리 방식이 다름
- 권장: 공통 에러 핸들러 미들웨어 추가

#### 4.2 로깅 구조
- 현재: 각 파일에서 개별적으로 로깅 설정
- 권장: `backend/core/logging_config.py`로 통합

#### 4.3 서비스 인스턴스 관리
- 현재: 각 라우터 파일에서 전역 변수로 관리
- 권장: 의존성 주입 패턴 사용 고려

#### 4.4 중복 코드 제거
- `routes_v2.py`의 법률 관련 엔드포인트 제거
- 공통 유틸리티 함수 추출

## 정리 작업 계획

### Phase 1: 즉시 수정 (완료)
- [x] `task_manager` 변수 오류 수정

### Phase 2: 중복 제거 (완료)
- [x] `routes_v2.py`에서 법률 관련 엔드포인트 제거 (658-930번 라인)
- [x] 중복 엔드포인트 주석 추가

### Phase 3: 구조 개선 (선택)
- [ ] 공통 에러 핸들러 추가
- [ ] 로깅 설정 통합
- [ ] 의존성 주입 패턴 적용

## 주요 엔드포인트 정리

### 공고 RAG API (`/api/v2`)
- `POST /api/v2/announcements/upload` - 공고 업로드
- `GET /api/v2/announcements/{id}/match-teams` - 팀 매칭
- `POST /api/v2/teams/embedding` - 팀 임베딩 저장
- `GET /api/v2/teams/search` - 팀 검색

### 법률 RAG API v2 (`/api/v2/legal`)
- `GET /api/v2/legal/search` - 법령 검색
- `POST /api/v2/legal/analyze-contract` - 계약서 분석
- `POST /api/v2/legal/analyze-situation` - 상황 분석
- `POST /api/v2/legal/compare-contracts` - 계약서 비교
- `POST /api/v2/legal/rewrite-clause` - 조항 리라이트
- `GET /api/v2/legal/contracts/{doc_id}` - 계약서 조회
- `GET /api/v2/legal/contracts/history` - 히스토리 조회

## 참고 사항
- 법률 관련 엔드포인트는 `routes_legal_v2.py`에서만 관리하는 것이 권장됩니다.
- `routes_v2.py`의 법률 엔드포인트는 레거시 코드로 보이며 제거 가능합니다.

