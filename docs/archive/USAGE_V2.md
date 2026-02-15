# Backend v2 사용 가이드

## 🎯 구현 완료

실전형 "공고 대량·지속 인입 → 정규화 → 임베딩/인덱싱 → 검색/매칭" 파이프라인이 완성되었습니다!

## 📋 생성된 파일

### 핵심 모듈
- ✅ `backend/core/supabase_vector_store.py` - Supabase pgvector 어댑터
- ✅ `backend/core/document_processor_v2.py` - 문서 처리
- ✅ `backend/core/generator_v2.py` - 임베딩 및 LLM
- ✅ `backend/core/orchestrator_v2.py` - 전체 파이프라인
- ✅ `backend/api/routes_v2.py` - REST API

### 데이터베이스
- ✅ `supabase/migrations/002_announcement_pipeline.sql` - 스키마
- ✅ `supabase/migrations/003_vector_search_rpc.sql` - 검색 함수

## 🚀 시작하기

### 1. 의존성 설치

```bash
cd backend
.\venv\Scripts\Activate.ps1
pip install supabase==2.3.4
```

### 2. 환경 변수 설정

`backend/.env` 파일 생성:

```env
# 필수
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 선택
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### 3. 서버 실행

```bash
python main.py
```

## 📤 API 사용

### 파일 업로드

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

### 텍스트 직접 업로드

```bash
curl -X POST http://localhost:8000/api/announcements/text \
  -F "text=공고 내용..." \
  -F "source=수기" \
  -F "title=샘플 공고"
```

### 분석 결과 조회

```bash
curl http://localhost:8000/api/announcements/{announcement_id}/analysis
```

## 🔄 파이프라인 흐름

```
1. 공고 인입
   - 파일 업로드 또는 텍스트 입력
   - source, external_id, title 등 메타데이터

2. 중복/버전 판별
   - content_hash로 중복 감지
   - 동일 내용이면 기존 ID 반환
   - 변경 시 version 자동 증가

3. 텍스트 추출
   - PDF → 텍스트 (PyPDFLoader)
   - 텍스트 정제

4. 청킹
   - 1000자 청크, 200자 오버랩
   - RecursiveCharacterTextSplitter

5. 임베딩 생성
   - OpenAI text-embedding-3-small
   - 1536차원 벡터

6. Supabase 저장
   - announcements (메타데이터)
   - announcement_bodies (본문)
   - announcement_chunks (벡터)

7. LLM 구조화 분석
   - GPT-4o-mini로 JSON 추출
   - 예산, 기간, 기술 스택 등

8. 분석 결과 저장
   - announcement_analysis (JSONB)
```

## 🎯 핵심 기능

### 1. 중복 방지
- `source + external_id + content_hash` 조합
- 동일 내용 자동 감지

### 2. 버전 관리
- 동일 external_id라도 본문 변경 시 version 증가
- 최신 버전만 active

### 3. 벡터 검색
- pgvector 코사인 유사도
- RPC 함수로 성능 최적화

### 4. 구조화 분석
- LLM으로 JSON 자동 추출
- 분석 점수 계산

## 📊 확인 방법

### 데이터베이스 확인

```sql
-- Supabase SQL Editor에서
SELECT COUNT(*) FROM announcements;
SELECT COUNT(*) FROM announcement_chunks;
SELECT COUNT(*) FROM announcement_analysis;

-- 최근 공고 확인
SELECT id, title, source, version, created_at 
FROM announcements 
ORDER BY created_at DESC 
LIMIT 5;
```

### API 문서 확인

브라우저에서 `http://localhost:8000/docs` 접속

## ⚠️ 주의사항

1. **Service Role Key 보안**
   - 서버에서만 사용
   - 프론트엔드 노출 금지

2. **중복 방지**
   - `external_id`는 원천 시스템의 고유 ID 사용 권장
   - 없으면 title로 대체 (중복 가능성 있음)

3. **성능**
   - 초기에는 row-by-row insert
   - 대량 처리 시 RPC 함수로 전환 권장

## 📝 다음 단계

1. ✅ Supabase 연동 완료
2. ⏳ 대량 배치 처리 구현
3. ⏳ 검색 API 추가
4. ⏳ 팀 매칭 로직 완성

