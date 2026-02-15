# 설정 완료 가이드

## ✅ 완료된 작업

### 1. 의존성 설치
- ✅ Frontend: `@radix-ui/react-progress` 설치 완료

### 2. 파일 생성
- ✅ 환경 변수 예시 파일 생성
- ✅ 마이그레이션 파일 생성 및 수정
- ✅ 문서 파일 생성

### 3. 마이그레이션 수정
- ✅ `doc_id`: BIGINT로 수정 (docs 테이블과 일치)
- ✅ `team_id`: BIGINT로 수정 (teams 테이블과 일치)
- ✅ RLS 정책: `user_id` → `maker_id`로 수정 (team_members 테이블과 일치)

## ⏳ 수동으로 진행해야 할 작업

### 1. Python 설치 (Windows)

Python이 설치되어 있지 않습니다. 다음 중 하나를 선택하세요:

#### 옵션 A: Microsoft Store
1. Microsoft Store 열기
2. "Python" 검색
3. Python 3.11 또는 3.12 설치

#### 옵션 B: python.org
1. https://www.python.org/downloads/ 접속
2. Python 3.11 이상 다운로드
3. 설치 시 "Add Python to PATH" 체크

#### 설치 확인
```bash
python --version
# Python 3.11.x 또는 3.12.x 출력되어야 함
```

### 2. Backend 환경 설정

```bash
# 1. backend 디렉토리로 이동
cd backend

# 2. 가상환경 생성
python -m venv venv

# 3. 가상환경 활성화 (Windows)
venv\Scripts\activate

# 4. 의존성 설치
pip install -r requirements.txt
```

### 3. 환경 변수 파일 생성

#### Frontend (.env.local)
프로젝트 루트에 `.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteHhiZHJmd2hhdnd4aXpkZnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODQxMzcsImV4cCI6MjA3NDI2MDEzN30.lmIGh9Ysak38gGxvw2ZFbCluiVDMY_OSNQmZJOiZ1KY
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

#### Backend (backend/.env)
`backend/` 디렉토리에 `.env` 파일 생성:

```env
OPENAI_API_KEY=your_openai_api_key_here
CHROMA_PERSIST_DIR=./data/chroma_db
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.1
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
HOST=0.0.0.0
PORT=8000
```

### 4. 데이터베이스 마이그레이션 실행

#### 방법 1: Supabase Dashboard (권장)
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택: `linkers-public`
3. SQL Editor 열기
4. `supabase/migrations/001_bidding_schema.sql` 파일 내용 복사
5. SQL Editor에 붙여넣기
6. 실행 버튼 클릭

#### 방법 2: Supabase CLI
```bash
# Supabase CLI 설치 (없는 경우)
npm install -g supabase

# 프로젝트 연결
supabase link --project-ref zmxxbdrfwhavwxizdfyz

# 마이그레이션 실행
supabase db push
```

### 5. 테스트 실행

#### Frontend 서버
```bash
npm run dev
# http://localhost:3000 접속
```

#### Backend 서버
```bash
cd backend
python main.py
# http://localhost:8000/docs 접속
```

## 📋 체크리스트

- [ ] Python 설치 완료
- [ ] Backend 가상환경 생성 및 의존성 설치
- [ ] `.env.local` 파일 생성 및 설정
- [ ] `backend/.env` 파일 생성 및 설정
- [ ] 데이터베이스 마이그레이션 실행
- [ ] Frontend 서버 실행 확인
- [ ] Backend 서버 실행 확인
- [ ] API 테스트 (http://localhost:8000/docs)

## 🔍 검증 방법

### 마이그레이션 확인
```sql
-- Supabase SQL Editor에서 실행
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('announcement_metadata', 'bidding_history', 'estimate_templates');
```

### 환경 변수 확인
```bash
# Frontend
cat .env.local  # Windows: type .env.local

# Backend
cd backend
cat .env  # Windows: type .env
```

### 서버 실행 확인
```bash
# Frontend
curl http://localhost:3000

# Backend
curl http://localhost:8000/api/health
```

## 📝 참고 문서

- `SETUP_CHECKLIST.md` - 상세 설정 체크리스트
- `ENV_SETUP_GUIDE.md` - 환경 변수 설정 가이드
- `TEST_GUIDE.md` - 테스트 가이드
- `IMPLEMENTATION_GUIDE.md` - 구현 가이드

