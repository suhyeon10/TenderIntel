# 환경 설정 가이드

Linkus Legal 프로젝트의 환경 설정에 대한 상세 가이드입니다.

## 📑 목차

1. [Frontend 환경 변수](#frontend-환경-변수-envlocal)
2. [Backend 환경 변수](#backend-환경-변수-backendenv)
3. [백엔드 설정](#백엔드-설정)
4. [보안 주의사항](#-보안-주의사항)

---

## Frontend 환경 변수 (.env.local)

### 최소 설정

프로젝트 루트에 `.env.local` 파일을 생성:

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Backend API URL (선택, 기본값: http://localhost:8000)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000

# Site URL (OAuth 리다이렉트용, 선택)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Backend 환경 변수 (backend/.env)

### 기본 설정 (무료 스택)

#### 최소 설정 (Supabase만 설정)

```env
# Supabase 설정 (필수)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 기본값으로 활성화된 설정

- ✅ 로컬 임베딩 (sentence-transformers)
- ✅ Ollama LLM (로컬)
- ✅ Supabase pgvector

#### 선택적 설정 (필요시 추가)

```env
# Ollama 설정 (기본값: http://localhost:11434, llama3)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3  # 또는 mistral, phi3

# 로컬 임베딩 모델 (기본값: BAAI/bge-small-en-v1.5)
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

# Chunk Settings (선택)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# Server Settings (선택)
HOST=0.0.0.0
PORT=8000
```

---

## 백엔드 설정

### ⚠️ 중요: 라우터 등록 순서

백엔드 서버(`backend/main.py`)에서 라우터 등록 순서가 중요합니다:

```python
# 더 구체적인 경로를 가진 라우터를 먼저 등록해야 함
app.include_router(router_legal_v2)  # /api/v2/legal - 먼저 등록 (권장)
app.include_router(router_legal)      # /api/v1/legal (레거시, 호환성용)
app.include_router(router_v2)         # /api/v2 - 나중에 등록
```

> **참고**: `routes_legal.py` (v1)는 레거시 API로, 호환성을 위해 유지되고 있습니다. 새로운 개발은 **`routes_legal_v2.py` (v2)**를 사용하세요.

이렇게 하지 않으면 `/api/v2/legal/analyze-contract`가 `router_v2`의 `/legal/analyze-contract`와 먼저 매칭되어 v1 형식으로 응답할 수 있습니다.

### 기본 설정 (무료 스택)

#### 1. 의존성 설치

```bash
cd backend
pip install -r requirements.txt
```

**Windows에서 sentence-transformers 설치 오류 시:**
- Windows Long Path 활성화 필요 (관리자 PowerShell):
  ```powershell
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```
- 재시작 후 `pip install sentence-transformers` 재시도

#### 2. 환경 변수 설정

`backend/.env` 파일 생성 (최소 설정):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 3. Ollama 설치 (선택 - LLM 답변 생성용)

**Ollama 없이도 검색 기능은 작동합니다!**

LLM 답변 생성을 원하면:
```bash
# Ollama 설치 (https://ollama.ai/download)
# Windows: 다운로드 후 설치
# Mac: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 모델 다운로드 (한국어 성능 순서)
ollama pull mistral   # 4.1GB, 한국어 성능 가장 좋음 (추천)
ollama pull llama3    # 4.7GB, 영어 중심
ollama pull phi3      # 2.3GB, 매우 빠름, 한국어 제한적
```

**한국어 답변 품질 개선:**
- `mistral` 모델이 한국어 성능이 가장 좋습니다
- 모델 변경 후 `.env` 파일에서 `OLLAMA_MODEL=mistral`로 설정

#### 4. Supabase 벡터 컬럼 설정

Supabase SQL Editor에서 실행:
```sql
-- 법률/계약 벡터 컬럼 설정 (legal RAG 모드 사용 시)
ALTER TABLE legal_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE legal_chunks ADD COLUMN embedding vector(384);
```

**법률/계약 RAG 모드 사용 시 테이블 생성:**

```sql
-- legal_documents 테이블
CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    source TEXT,  -- 'moel', 'mss', 'mcst' 등
    file_path TEXT,
    doc_type TEXT,  -- 'law', 'standard_contract', 'manual', 'case'
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- legal_chunks 테이블
CREATE TABLE IF NOT EXISTS legal_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_document_id UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    section_title TEXT,  -- '제1조 (목적)' 등
    chunk_index INTEGER,
    text TEXT,
    embedding vector(384),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_chunks_document_id ON legal_chunks(legal_document_id);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding ON legal_chunks USING ivfflat (embedding vector_cosine_ops);

-- 선택사항: legal_document_bodies 테이블 (원본 본문 저장)
CREATE TABLE IF NOT EXISTS legal_document_bodies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_document_id UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    text TEXT,
    mime TEXT DEFAULT 'text/plain',
    language TEXT DEFAULT 'ko',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 5. 서버 실행

```bash
python main.py
```

또는:

```bash
python -m uvicorn main:app --reload
```

#### 6. 문서 인덱싱 (선택)

```bash
# PDF 파일을 backend/data/legal/ 폴더에 넣고
python scripts/batch_ingest.py data/legal --mode legal
```

### 서버 실행 방법

#### 방법 1: Python 직접 실행
```bash
cd backend
python main.py
```

#### 방법 2: Uvicorn 직접 실행
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 서버 확인

서버가 정상적으로 실행되면 다음 URL에서 확인할 수 있습니다:

- **API 문서 (Swagger UI)**: http://localhost:8000/docs
- **ReDoc 문서**: http://localhost:8000/redoc
- **헬스 체크**: http://localhost:8000/api/health

터미널에서 헬스 체크:
```bash
curl http://localhost:8000/api/health
```

정상 응답 예시:
```json
{
  "status": "ok",
  "message": "Linkus Public RAG API is running"
}
```

---

## 🔐 보안 주의사항

1. **절대 커밋하지 마세요**
   - `.env.local`과 `backend/.env`는 `.gitignore`에 포함되어 있습니다
   - 실제 API 키는 절대 Git에 커밋하지 마세요

2. **환경별 분리**
   - 개발: `.env.local`
   - 프로덕션: Vercel 환경 변수 설정 사용

---

## 추가 정보

- 빠른 시작은 [README.md](./README.md)를 참고하세요
- 문제 해결은 [backend/TROUBLESHOOTING.md](./backend/TROUBLESHOOTING.md)를 참고하세요

