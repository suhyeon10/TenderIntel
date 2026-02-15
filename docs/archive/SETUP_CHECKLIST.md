# 설정 체크리스트

## ✅ 1단계: 의존성 설치

### Frontend
```bash
npm install @radix-ui/react-progress
```
**상태**: ✅ 완료

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
**상태**: ⏳ 실행 필요

## ✅ 2단계: 환경 변수 설정

### Frontend (.env.local)
1. `.env.local.example` 파일을 `.env.local`로 복사
2. 실제 값으로 변경:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_BACKEND_API_URL`

**파일 위치**: 프로젝트 루트에 `.env.local` 생성

### Backend (backend/.env)
1. `backend/.env.example` 파일을 `backend/.env`로 복사
2. 실제 값으로 변경:
   - `OPENAI_API_KEY` (필수)

**파일 위치**: `backend/.env` 생성

## ⏳ 3단계: 데이터베이스 마이그레이션

### Supabase 마이그레이션 실행

#### 방법 1: Supabase CLI 사용
```bash
# Supabase CLI 설치 확인
supabase --version

# 마이그레이션 실행
supabase migration up

# 또는 특정 프로젝트에 연결
supabase link --project-ref your-project-ref
supabase db push
```

#### 방법 2: Supabase Dashboard 사용
1. Supabase Dashboard 접속
2. SQL Editor 열기
3. `supabase/migrations/001_bidding_schema.sql` 파일 내용 복사
4. SQL Editor에 붙여넣기
5. 실행

**마이그레이션 파일**: `supabase/migrations/001_bidding_schema.sql`

**생성되는 테이블**:
- `announcement_metadata`
- `bidding_history`
- `estimate_templates`

## ⏳ 4단계: 테스트

### Frontend RAG 테스트
```typescript
// src/lib/rag/__tests__/frontend-rag.test.ts (생성 필요)
import { FrontendRAG } from '../frontend-rag'

describe('FrontendRAG', () => {
  it('should extract metadata', async () => {
    const rag = new FrontendRAG()
    // 테스트 코드
  })
})
```

### Backend RAG 테스트
```python
# backend/tests/test_bidding_rag.py (생성 필요)
import pytest
from core.bidding_rag import BiddingRAG

def test_analyze_announcement():
    rag = BiddingRAG()
    # 테스트 코드
```

### 통합 워크플로우 테스트
```typescript
// src/lib/workflows/__tests__/bidding-workflow.test.ts (생성 필요)
import { BiddingWorkflow } from '../bidding-workflow'

describe('BiddingWorkflow', () => {
  it('should process announcement', async () => {
    const workflow = new BiddingWorkflow()
    // 테스트 코드
  })
})
```

## 🔍 검증 방법

### 1. 환경 변수 확인

#### Frontend
```bash
# .env.local 파일 확인
cat .env.local

# 또는 Windows
type .env.local
```

#### Backend
```bash
cd backend
cat .env

# 또는 Windows
type .env
```

### 2. 데이터베이스 확인

```sql
-- Supabase SQL Editor에서 실행
SELECT * FROM announcement_metadata LIMIT 1;
SELECT * FROM bidding_history LIMIT 1;
SELECT * FROM estimate_templates LIMIT 1;
```

### 3. 서버 실행 확인

#### Frontend
```bash
npm run dev
# http://localhost:3000 접속 확인
```

#### Backend
```bash
cd backend
python main.py
# http://localhost:8000/docs 접속 확인
```

### 4. API 테스트

#### Backend 헬스 체크
```bash
curl http://localhost:8000/api/health
```

#### Frontend API 테스트
```bash
# 브라우저에서
# http://localhost:3000/api/rag/query 접속
```

## ⚠️ 주의사항

1. **환경 변수 보안**
   - `.env.local`과 `backend/.env`는 `.gitignore`에 포함되어야 함
   - 실제 API 키는 절대 커밋하지 말 것

2. **마이그레이션 순서**
   - 기존 데이터가 있는 경우 백업 권장
   - 마이그레이션 전 테스트 환경에서 먼저 실행

3. **의존성 버전**
   - Python 3.9 이상 필요
   - Node.js 18 이상 권장

## 📝 다음 작업

1. [ ] Backend 의존성 설치
2. [ ] 환경 변수 파일 생성 및 설정
3. [ ] 데이터베이스 마이그레이션 실행
4. [ ] 테스트 파일 작성
5. [ ] 통합 테스트 실행

