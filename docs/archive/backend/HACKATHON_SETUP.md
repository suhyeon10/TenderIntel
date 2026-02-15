# 🎯 해커톤용 완전 무료 RAG 세팅 가이드

**돈 한 푼 안 쓰고 RAG 파이프라인 테스트하기!**

## 🚀 빠른 시작 (3단계)

### 1. Ollama 설치 및 모델 다운로드

```bash
# Ollama 설치 (https://ollama.com)
# Windows: 다운로드 후 설치
# Mac: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 모델 다운로드 (선택: llama3, mistral, phi3 중 하나)
ollama pull llama3
# 또는
ollama pull mistral
# 또는  
ollama pull phi3
```

### 2. 의존성 설치

**Supabase 사용 시 (추천):**
```bash
cd backend
pip install ollama sentence-transformers
# Supabase는 이미 requirements.txt에 포함됨
```

**ChromaDB 사용 시:**
```bash
cd backend
pip install ollama chromadb sentence-transformers
```

**Windows에서 ChromaDB 빌드 오류 시:**
```bash
pip install chromadb --no-build-isolation
```

### 3. 환경 변수 설정

`backend/.env` 파일 생성:

```env
# 해커톤 모드 활성화 (자동으로 모든 무료 스택 사용)
USE_HACKATHON_MODE=true

# OpenAI 키는 선택사항 (해커톤 모드에서는 사용 안 함)
# OPENAI_API_KEY=sk-xxxxx  # 주석 처리해도 됨

# Ollama 설정
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# 로컬 임베딩 모델 (빠른 선택)
USE_LOCAL_EMBEDDING=true
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

# 벡터 DB 선택 (둘 중 하나)
# 옵션 1: ChromaDB (완전 로컬)
USE_CHROMADB=true
CHROMA_PERSIST_DIR=./data/chroma_db

# 옵션 2: Supabase (무료 티어 사용 가능) - 추천!
# USE_CHROMADB=false
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your_key
```

## ✅ 완료!

이제 서버 실행:

```bash
python main.py
```

**완전 오프라인에서도 작동합니다!** 🎉

## 📊 사용 모델 비교

| 역할 | 유료 (기본) | 무료 (해커톤) |
|------|------------|--------------|
| **LLM** | gpt-4o-mini | Ollama (llama3/mistral/phi3) |
| **임베딩** | text-embedding-3-small | bge-small / bge-m3 |
| **벡터 DB** | Supabase pgvector | Supabase pgvector 또는 ChromaDB |

**Supabase 무료 티어:**
- 500MB 데이터베이스
- 2GB 파일 스토리지
- pgvector 지원
- 해커톤용으로 충분! 🎉

## 💡 실전 팁

### GPU 없어도 됨
- `llama3:8b`는 CPU 모드에서도 작동 (느리지만 가능)
- `phi3`는 더 가볍고 빠름

### 더 나은 성능 원하면
- 임베딩: `BAAI/bge-m3` (다국어, 더 정확)
- LLM: `mistral` (llama3보다 한국어 성능 좋음)

### 정식 데모 때 OpenAI로 전환
`.env`에서:
```env
USE_HACKATHON_MODE=false
USE_OPENAI=true
OPENAI_API_KEY=sk-xxxxx
```

한 줄만 바꾸면 바로 전환됩니다! 🔄

## 🐛 문제 해결

### Ollama 연결 실패
```bash
# Ollama 서버 실행 확인
ollama serve

# 다른 터미널에서 테스트
ollama run llama3
```

### ChromaDB 빌드 실패 (Windows)
```bash
pip install chromadb --no-build-isolation
# 또는
pip install chromadb --no-deps
pip install pypika
```

### 임베딩 모델 다운로드 느림
- 첫 실행 시 HuggingFace에서 자동 다운로드 (약 400MB)
- 한 번 다운로드하면 캐시됨

## 🎯 해커톤 추천 설정

**빠른 테스트용 (Supabase + Ollama):**
```env
USE_HACKATHON_MODE=true
USE_CHROMADB=false
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
OLLAMA_MODEL=phi3  # 가장 가볍고 빠름
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5  # 빠름
```

**완전 오프라인 (ChromaDB + Ollama):**
```env
USE_HACKATHON_MODE=true
USE_CHROMADB=true
OLLAMA_MODEL=phi3
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

**품질 중시 (Supabase + Ollama):**
```env
USE_HACKATHON_MODE=true
USE_CHROMADB=false
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
OLLAMA_MODEL=mistral  # 한국어 성능 좋음
LOCAL_EMBEDDING_MODEL=BAAI/bge-m3  # 다국어, 정확
```

## 📝 체크리스트

**Supabase 사용 시:**
- [ ] Ollama 설치 및 모델 다운로드 완료
- [ ] `pip install ollama sentence-transformers` 완료
- [ ] `.env` 파일에 `USE_HACKATHON_MODE=true` 설정
- [ ] `.env`에 Supabase URL과 키 설정
- [ ] `ollama serve` 실행 중 확인
- [ ] 서버 실행 성공 확인

**ChromaDB 사용 시:**
- [ ] Ollama 설치 및 모델 다운로드 완료
- [ ] `pip install ollama chromadb sentence-transformers` 완료
- [ ] `.env` 파일에 `USE_HACKATHON_MODE=true` 및 `USE_CHROMADB=true` 설정
- [ ] `ollama serve` 실행 중 확인
- [ ] 서버 실행 성공 확인

**이제 완전 무료로 RAG 파이프라인 테스트 가능합니다!** 🚀

