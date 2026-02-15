# 설정 가이드

Linkus Public RAG Backend의 환경 변수 및 설정에 대한 상세 설명입니다.

## 📑 목차

1. [환경 변수 설정](#환경-변수-설정)
2. [필수 설정](#필수-설정)
3. [LLM 설정](#llm-설정)
4. [임베딩 설정](#임베딩-설정)
5. [청크 설정](#청크-설정)
6. [서버 설정](#서버-설정)
7. [로깅 설정](#로깅-설정)

---

## 환경 변수 설정

프로젝트 루트(`backend/`)에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Supabase 설정 (필수)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_database_url

# OpenAI API (선택, Ollama 사용 시 불필요)
OPENAI_API_KEY=your_openai_api_key_here

# Ollama 설정 (로컬 LLM 사용, 기본값)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
USE_OLLAMA=true

# Embedding Model (선택, 기본값: BAAI/bge-small-en-v1.5)
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
USE_LOCAL_EMBEDDING=true

# LLM Model (선택, 기본값: gpt-4o-mini)
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.1

# Chunk Settings (선택)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# Server Settings (선택)
HOST=0.0.0.0
PORT=8000

# Logging Settings (선택)
LOG_LEVEL=INFO  # INFO, DEBUG, WARNING, ERROR
```

---

## 필수 설정

다음 설정은 반드시 필요합니다:

### SUPABASE_URL
- **설명**: Supabase 프로젝트 URL
- **형식**: `https://your-project.supabase.co`
- **예시**: `https://abcdefghijklmnop.supabase.co`

### SUPABASE_SERVICE_ROLE_KEY
- **설명**: Supabase 서비스 역할 키
- **형식**: JWT 토큰 문자열
- **주의**: 이 키는 서버 사이드에서만 사용해야 합니다. 클라이언트에 노출되지 않도록 주의하세요.

### DATABASE_URL
- **설명**: PostgreSQL 데이터베이스 연결 URL
- **형식**: `postgresql://user:password@host:port/database`
- **예시**: `postgresql://postgres:password@db.abcdefghijklmnop.supabase.co:5432/postgres`

---

## LLM 설정

### USE_OLLAMA
- **설명**: Ollama 사용 여부
- **기본값**: `true`
- **선택값**: `true`, `false`
- **참고**: `true`로 설정하면 로컬 Ollama 서버를 사용합니다

### OLLAMA_BASE_URL
- **설명**: Ollama 서버 주소
- **기본값**: `http://localhost:11434`
- **참고**: Ollama가 다른 주소에서 실행 중인 경우 변경

### OLLAMA_MODEL
- **설명**: Ollama 모델명
- **기본값**: `llama3`
- **예시**: `llama3`, `mistral`, `codellama` 등

### OPENAI_API_KEY
- **설명**: OpenAI API 키 (Ollama 미사용 시 필요)
- **형식**: `sk-...`로 시작하는 문자열
- **참고**: `USE_OLLAMA=false`일 때만 필요

### LLM_MODEL
- **설명**: LLM 모델명
- **기본값**: `gpt-4o-mini`
- **예시**: `gpt-4o-mini`, `gpt-4`, `gpt-3.5-turbo` 등
- **참고**: OpenAI API 사용 시에만 적용

### LLM_TEMPERATURE
- **설명**: LLM 생성 온도 (0.0 ~ 2.0)
- **기본값**: `0.1`
- **참고**: 낮을수록 일관된 결과, 높을수록 창의적인 결과

---

## 임베딩 설정

### USE_LOCAL_EMBEDDING
- **설명**: 로컬 임베딩 사용 여부
- **기본값**: `true`
- **선택값**: `true`, `false`
- **참고**: `true`로 설정하면 로컬에서 임베딩 모델을 로드합니다

### LOCAL_EMBEDDING_MODEL
- **설명**: 로컬 임베딩 모델명
- **기본값**: `BAAI/bge-small-en-v1.5`
- **예시**: 
  - `BAAI/bge-small-en-v1.5` (영어, 작은 모델)
  - `BAAI/bge-base-en-v1.5` (영어, 기본 모델)
  - `jhgan/ko-sroberta-multitask` (한국어)
- **참고**: Hugging Face 모델 허브의 모델명을 사용합니다

---

## 청크 설정

### CHUNK_SIZE
- **설명**: 텍스트 청크 크기 (문자 수)
- **기본값**: `1000`
- **권장값**: 500 ~ 2000
- **참고**: 
  - 너무 작으면 문맥 손실
  - 너무 크면 처리 시간 증가 및 메모리 사용량 증가

### CHUNK_OVERLAP
- **설명**: 청크 간 겹치는 문자 수
- **기본값**: `200`
- **권장값**: CHUNK_SIZE의 10% ~ 20%
- **참고**: 문맥 연속성을 위해 필요합니다

---

## 서버 설정

### HOST
- **설명**: 서버 호스트 주소
- **기본값**: `0.0.0.0`
- **참고**: 
  - `0.0.0.0`: 모든 네트워크 인터페이스에서 접근 가능
  - `127.0.0.1`: 로컬에서만 접근 가능

### PORT
- **설명**: 서버 포트 번호
- **기본값**: `8000`
- **참고**: 다른 애플리케이션과 포트 충돌 시 변경

---

## 로깅 설정

### LOG_LEVEL
- **설명**: 로그 레벨
- **기본값**: `INFO`
- **선택값**: 
  - `DEBUG`: 모든 로그 출력 (개발 시 유용)
  - `INFO`: 일반 정보 로그
  - `WARNING`: 경고 로그
  - `ERROR`: 에러 로그만 출력
- **참고**: 프로덕션 환경에서는 `INFO` 또는 `WARNING` 권장

---

## 설정 확인

설정이 올바르게 로드되었는지 확인하려면:

```python
from config import settings

# 설정 확인
print(f"Supabase URL: {settings.supabase_url}")
print(f"LLM Model: {settings.llm_model}")
print(f"Log Level: {settings.log_level}")
```

---

## 환경별 설정 예시

### 개발 환경
```env
LOG_LEVEL=DEBUG
USE_OLLAMA=true
OLLAMA_MODEL=llama3
```

### 프로덕션 환경
```env
LOG_LEVEL=INFO
USE_OLLAMA=false
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_production_key
```

---

## 추가 정보

- 문제 해결은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)를 참고하세요
- 빠른 시작은 [README.md](./README.md)를 참고하세요

