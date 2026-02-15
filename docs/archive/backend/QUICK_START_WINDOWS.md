# Windows 빠른 시작 가이드

## ✅ 완료된 작업

1. ✅ Python 3.12.10 설치 완료
2. ✅ 가상환경 생성 완료
3. ✅ 핵심 패키지 설치 완료
   - FastAPI, Uvicorn
   - LangChain, LangChain OpenAI
   - Pydantic, Python-dotenv
   - PyPDF, NumPy

## ⚠️ ChromaDB 설치 문제

ChromaDB는 Windows에서 C++ 빌드 도구가 필요하여 설치되지 않았습니다.

**해결책**: Supabase pgvector를 사용하세요 (이미 구현되어 있음)

## 🚀 다음 단계

### 1. 환경 변수 파일 생성

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

### 2. 서버 실행

```bash
# backend 디렉토리에서
.\venv\Scripts\Activate.ps1
python main.py
```

### 3. 서버 확인

브라우저에서 http://localhost:8000/docs 접속

## 📝 참고

- ChromaDB 없이도 Supabase pgvector로 작동합니다
- Backend RAG는 Supabase와 연동하여 사용하세요
- 필요시 나중에 C++ Build Tools 설치 후 ChromaDB 추가 가능

