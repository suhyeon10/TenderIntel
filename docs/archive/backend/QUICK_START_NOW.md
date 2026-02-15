# 🚀 지금 바로 시작하기!

`sentence-transformers` 설치 완료! 이제 바로 시작하세요.

## ✅ 1단계: .env 파일 설정 (1분)

**기본값이 해커톤 모드(무료 스택)로 설정되어 있습니다!**

`backend/.env` 파일을 생성하거나 수정하세요 (최소 설정):

```env
# Supabase 설정 (필수)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**참고**: 다음 설정들은 기본값으로 이미 활성화되어 있습니다:
- ✅ 해커톤 모드 (무료 스택)
- ✅ 로컬 임베딩 (sentence-transformers)
- ✅ Ollama LLM (로컬)
- ✅ OpenAI 사용 안 함

**OpenAI를 사용하려면** 명시적으로 설정하세요.

## 📄 2단계: 문서 준비 (1분)

`backend/data/announcements/` 폴더에 PDF 파일을 넣으세요.

현재는 README.md만 있습니다. 공고 문서를 추가하세요!

## 🤖 3단계: Ollama 설치 (5분)

Ollama가 없다면:

1. **다운로드**: https://ollama.ai/download
2. **설치 후 모델 다운로드**:
   ```bash
   ollama pull llama3
   ```

## 🔍 4단계: 문서 인덱싱 (문서 개수에 따라 다름)

```bash
cd backend
python scripts/simple_ingest.py
```

## 🖥️ 5단계: 서버 실행

```bash
cd backend
python -m uvicorn main:app --reload
```

## 🎨 6단계: 프론트엔드 실행 (새 터미널)

```bash
streamlit run frontend/streamlit_app.py
```

## 🎉 완성!

브라우저에서 `http://localhost:8501` 접속!

---

## ⚡ 빠른 체크리스트

- [ ] `.env` 파일 생성 (Supabase URL/KEY만 설정 - 해커톤 모드는 기본값)
- [ ] `backend/data/announcements/`에 PDF 파일 추가
- [ ] Ollama 설치 및 `ollama pull llama3`
- [ ] `python scripts/simple_ingest.py` 실행
- [ ] 백엔드 서버 실행
- [ ] 프론트엔드 실행

