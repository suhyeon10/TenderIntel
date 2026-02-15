# 🚀 RAG 시스템 실행 가이드

## 현재 상태

✅ **설정 완료**
- 해커톤 모드 기본값 활성화
- sentence-transformers 설치 완료
- .env 파일 존재

⚠️ **확인 필요**
- Ollama 설치 여부
- 문서 파일 존재 여부

## 실행 방법

### 1. 백엔드 서버 실행

```bash
cd backend
python -m uvicorn main:app --reload
```

또는

```bash
cd backend
python main.py
```

서버가 `http://localhost:8000`에서 실행됩니다.

### 2. 프론트엔드 실행 (새 터미널)

```bash
streamlit run frontend/streamlit_app.py
```

브라우저에서 `http://localhost:8501`로 접속하세요.

## ⚠️ Ollama가 없는 경우

Ollama가 설치되지 않았다면:

1. **Ollama 설치**: https://ollama.ai/download
2. **모델 다운로드**:
   ```bash
   ollama pull llama3
   ```
3. **서버 재시작**

## 📄 문서가 없는 경우

문서를 인덱싱하려면:

1. `backend/data/announcements/` 폴더에 PDF 파일 추가
2. 인덱싱 실행:
   ```bash
   cd backend
   python scripts/simple_ingest.py
   ```

## 🔍 서버 확인

브라우저에서 다음 URL 접속:
- **API 문서**: http://localhost:8000/docs
- **헬스 체크**: http://localhost:8000/api/health

## 🎯 빠른 테스트

```bash
# 헬스 체크
curl http://localhost:8000/api/health

# 검색 테스트 (문서가 인덱싱된 경우)
curl "http://localhost:8000/api/v2/announcements/search?query=테스트&limit=5"
```

