# 🚀 다음 단계 가이드

`sentence-transformers` 설치가 완료되었습니다! 이제 해커톤용 무료 RAG 시스템을 설정하세요.

## ✅ 1단계: 환경 변수 설정 (.env 파일)

**기본값이 해커톤 모드(무료 스택)로 설정되어 있습니다!**

`backend/.env` 파일을 생성하거나 수정하세요 (최소 설정):

```env
# Supabase 설정 (필수 - 이미 연결되어 있다고 하셨으니 기존 값 사용)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**참고**: 다음 설정들은 기본값으로 이미 활성화되어 있습니다:
- ✅ `USE_HACKATHON_MODE=true` (기본값)
- ✅ `USE_LOCAL_EMBEDDING=true` (기본값)
- ✅ `USE_OLLAMA=true` (기본값)
- ✅ `USE_OPENAI=false` (기본값)

**OpenAI를 사용하려면** 명시적으로 설정하세요:
```env
USE_OPENAI=true
USE_LOCAL_EMBEDDING=false
USE_OLLAMA=false
OPENAI_API_KEY=your_openai_key
```

## 📄 2단계: 문서 준비

`backend/data/announcements/` 폴더에 PDF, HWP, TXT 파일을 넣으세요.

현재 폴더에는 README.md만 있습니다. 공고 문서를 추가하세요!

## 🔍 3단계: 문서 인덱싱

문서를 벡터 DB에 인덱싱합니다:

```bash
cd backend
python scripts/simple_ingest.py
```

또는 ChromaDB를 사용하려면:

```bash
python scripts/simple_ingest.py --chromadb
```

## 🤖 4단계: Ollama 설치 및 모델 다운로드 (LLM용)

Ollama가 설치되어 있지 않다면:

1. **Ollama 설치**: https://ollama.ai/download
2. **모델 다운로드**:
   ```bash
   ollama pull llama3
   ```

## 🖥️ 5단계: 백엔드 서버 실행

```bash
cd backend
python -m uvicorn main:app --reload
```

서버가 `http://localhost:8000`에서 실행됩니다.

## 🎨 6단계: 프론트엔드 실행 (새 터미널)

```bash
streamlit run frontend/streamlit_app.py
```

브라우저에서 `http://localhost:8501`로 접속하세요.

## 🎉 완성!

이제 완전 무료 RAG 시스템을 사용할 수 있습니다!

- ✅ 로컬 임베딩 (sentence-transformers)
- ✅ 로컬 LLM (Ollama)
- ✅ 벡터 DB (Supabase 또는 ChromaDB)
- ✅ OpenAI 과금 없음!

## 📝 체크리스트

- [ ] `.env` 파일 설정 (Supabase URL/KEY만 설정하면 됨 - 해커톤 모드는 기본값)
- [ ] `backend/data/announcements/`에 문서 파일 추가
- [ ] Ollama 설치 및 모델 다운로드 (`ollama pull llama3`)
- [ ] 문서 인덱싱 실행 (`python scripts/simple_ingest.py`)
- [ ] 백엔드 서버 실행 (`python -m uvicorn main:app --reload`)
- [ ] 프론트엔드 실행 (`streamlit run frontend/streamlit_app.py`)
