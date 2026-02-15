# 환경 변수 설정 가이드

## 📋 Frontend 환경 변수 (.env.local)

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteHhiZHJmd2hhdnd4aXpkZnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODQxMzcsImV4cCI6MjA3NDI2MDEzN30.lmIGh9Ysak38gGxvw2ZFbCluiVDMY_OSNQmZJOiZ1KY

# OpenAI API (서버 사이드, 필수)
OPENAI_API_KEY=your_openai_api_key_here

# Backend API URL (선택, 기본값: http://localhost:8000)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000

# Site URL (OAuth 리다이렉트용, 선택)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Storage (선택)
NEXT_PUBLIC_STORAGE_BUCKET=your_bucket_name

# PortOne (결제, 선택)
PORTONE_V2_API_SECRET=your_portone_secret
NEXT_PUBLIC_PORTONE_V2_STORE_ID=your_store_id
NEXT_PUBLIC_PORTONE_V2_CHANNEL_KEY=your_channel_key
PORTONE_V2_WEBHOOK_SECRET=your_webhook_secret
```

## 📋 Backend 환경 변수 (backend/.env)

`backend/` 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# OpenAI API (필수)
OPENAI_API_KEY=your_openai_api_key_here

# Vector DB 저장 경로 (선택, 기본값: ./data/chroma_db)
CHROMA_PERSIST_DIR=./data/chroma_db

# Embedding Model (선택, 기본값: text-embedding-3-small)
EMBEDDING_MODEL=text-embedding-3-small

# LLM Model (선택, 기본값: gpt-4o-mini)
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.1

# Chunk Settings (선택)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# Server Settings (선택)
HOST=0.0.0.0
PORT=8000
```

## 🔐 보안 주의사항

1. **절대 커밋하지 마세요**
   - `.env.local`과 `backend/.env`는 `.gitignore`에 포함되어 있습니다
   - 실제 API 키는 절대 Git에 커밋하지 마세요

2. **환경별 분리**
   - 개발: `.env.local`
   - 프로덕션: Vercel 환경 변수 설정 사용

3. **API 키 관리**
   - OpenAI API 키는 [platform.openai.com](https://platform.openai.com)에서 발급
   - Supabase 키는 Supabase Dashboard에서 확인

## ✅ 설정 확인

### Frontend
```bash
# 환경 변수 로드 확인
npm run dev
# 콘솔에서 process.env.NEXT_PUBLIC_SUPABASE_URL 확인
```

### Backend
```bash
cd backend
python -c "from config import settings; print(settings.openai_api_key[:10] + '...')"
```

