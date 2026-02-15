# 실전형 Backend v2 구현 완료

## ✅ 완료된 작업

### 1. 데이터베이스 스키마
- ✅ `announcements` - 공고 메타데이터 (버전 관리, 중복 방지)
- ✅ `announcement_bodies` - 공고 본문 (정규화 저장)
- ✅ `announcement_chunks` - 벡터 청크 (pgvector, 1536차원)
- ✅ `announcement_analysis` - 분석 결과 (JSONB)
- ✅ 벡터 검색 RPC 함수 (`match_announcement_chunks`)

### 2. 핵심 모듈
- ✅ `supabase_vector_store.py` - Supabase pgvector 어댑터
  - 중복/버전 관리 (content_hash)
  - 일괄 청크 저장
  - 벡터 검색 (RPC 함수 사용)
  
- ✅ `document_processor_v2.py` - 문서 처리
  - PDF → 텍스트 추출
  - 텍스트 → 청크 분할
  - 정규식 메타데이터 추출
  
- ✅ `generator_v2.py` - LLM 생성
  - 임베딩 생성 (OpenAI)
  - 구조화 분석 (JSON 출력)
  - 팀 매칭 사유 생성
  - 견적서 초안 생성
  
- ✅ `orchestrator_v2.py` - 전체 파이프라인
  - 공고 처리 통합 플로우
  - 파일 업로드 처리
  - 분석 결과 조회

- ✅ `routes_v2.py` - REST API
  - 파일 업로드 (`/api/announcements/upload`)
  - 텍스트 업로드 (`/api/announcements/text`)
  - 분석 결과 조회 (`/api/announcements/{id}/analysis`)
  - 비동기 분석 (`/api/analysis/start`, `/api/analysis/stream/{job_id}`)

### 3. 설정
- ✅ `config.py` - Supabase 설정 추가
- ✅ `requirements.txt` - supabase 패키지 추가
- ✅ `main.py` - v2 라우터 사용

## 🔄 전체 파이프라인

```
1. 공고 인입
   - 파일 업로드 또는 텍스트 직접 입력
   - 원천 시스템 (나라장터, 조달청, 수기 등)
   
2. 중복/버전 판별
   - content_hash로 중복 감지
   - 동일 external_id면 version 증가
   
3. 텍스트 추출
   - PDF → 텍스트 (PyPDFLoader)
   - 텍스트 정제
   
4. 청킹
   - RecursiveCharacterTextSplitter
   - 1000자 청크, 200자 오버랩
   
5. 임베딩 생성
   - OpenAI text-embedding-3-small
   - 1536차원 벡터
   
6. 벡터 저장
   - Supabase announcement_chunks 테이블
   - pgvector 인덱스 (ivfflat)
   
7. LLM 구조화 분석
   - GPT-4o-mini로 JSON 추출
   - 예산, 기간, 기술 스택 등
   
8. 분석 결과 저장
   - announcement_analysis 테이블
   - JSONB 형식
```

## 📋 사용 방법

### 1. 환경 변수 설정

`backend/.env`:
```env
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. 의존성 설치

```bash
cd backend
.\venv\Scripts\Activate.ps1
pip install supabase==2.3.4
```

### 3. 서버 실행

```bash
python main.py
```

### 4. 공고 업로드

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

## 🎯 핵심 기능

### 1. 중복 방지
- `source + external_id + content_hash` 조합
- 동일 내용이면 기존 ID 반환
- 변경 시 version 자동 증가

### 2. 버전 관리
- 동일 external_id라도 본문 변경 시 새 버전 생성
- 최신 버전만 active 상태

### 3. 벡터 검색
- pgvector 코사인 유사도
- RPC 함수로 성능 최적화
- 메타데이터 필터링 지원

### 4. 구조화 분석
- LLM으로 JSON 추출
- 예산, 기간, 기술 스택 자동 파싱
- 분석 점수 계산

## 📊 성능 최적화

### 현재
- Row-by-row insert (초기 구현)
- RPC 함수로 벡터 검색

### 향후 개선
- Bulk insert RPC 함수
- 배치 처리 최적화
- 인덱스 튜닝

## 🔐 보안

- Service Role Key는 서버에서만 사용
- 프론트엔드 노출 금지
- RLS 정책으로 접근 제어

## 📝 다음 단계

1. ✅ Supabase 연동 완료
2. ⏳ 대량 배치 처리 구현
3. ⏳ 검색 API 추가 (하이브리드 검색)
4. ⏳ 팀 매칭 로직 완성
5. ⏳ 성능 모니터링

## 📚 참고 문서

- `backend/IMPLEMENTATION_V2.md` - 상세 구현 가이드
- `backend/QUICK_START_V2.md` - 빠른 시작
- `backend/ENV_V2.md` - 환경 변수 설정

