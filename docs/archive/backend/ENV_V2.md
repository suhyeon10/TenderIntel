# Backend v2 환경 변수 설정

## 필수 환경 변수

`backend/.env` 파일에 다음 변수들을 설정하세요:

```env
# OpenAI API (필수)
OPENAI_API_KEY=sk-xxxxx

# Supabase (필수)
SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 데이터베이스 (선택 - Supabase 사용 시 불필요)
DATABASE_URL=postgresql://user:pass@host:5432/postgres

# 모델 설정 (선택)
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.1

# 청킹 설정 (선택)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# 서버 설정 (선택)
HOST=0.0.0.0
PORT=8000
```

## Supabase Service Role Key 발급

1. Supabase Dashboard 접속
2. 프로젝트 선택
3. Settings → API
4. "service_role" 키 복사 (⚠️ 보안 주의!)

## 환경 변수 확인

```bash
cd backend
python -c "from config import settings; print('✅ 설정 로드 성공')"
```

