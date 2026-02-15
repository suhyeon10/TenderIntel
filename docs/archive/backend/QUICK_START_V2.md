# Backend v2 빠른 시작

## ✅ 구현 완료

- ✅ Supabase 스키마 생성 완료
- ✅ Supabase Vector Store 어댑터
- ✅ DocumentProcessor v2
- ✅ Generator v2
- ✅ Orchestrator v2
- ✅ API Routes v2

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
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### 3. 서버 실행

```bash
python main.py
```

### 4. API 테스트

```bash
# 파일 업로드
curl -X POST http://localhost:8000/api/announcements/upload \
  -F "file=@sample.pdf" \
  -F "source=나라장터" \
  -F "title=샘플 공고" \
  -F "agency=한국공공기관"

# 분석 결과 조회
curl http://localhost:8000/api/announcements/{announcement_id}/analysis
```

## 📊 데이터 흐름

```
PDF 업로드
  ↓
중복/버전 판별 (content_hash)
  ↓
텍스트 추출 + 청킹
  ↓
임베딩 생성 (OpenAI)
  ↓
Supabase 저장 (announcements + announcement_bodies + announcement_chunks)
  ↓
LLM 분석 (구조화)
  ↓
분석 결과 저장 (announcement_analysis)
  ↓
완료!
```

## 🔍 확인

```sql
-- Supabase SQL Editor에서
SELECT COUNT(*) FROM announcements;
SELECT COUNT(*) FROM announcement_chunks;
SELECT COUNT(*) FROM announcement_analysis;
```

