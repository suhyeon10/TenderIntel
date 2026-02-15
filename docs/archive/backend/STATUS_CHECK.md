# 🔍 시스템 상태 확인

현재 시스템 상태를 확인하고 다음 단계를 안내합니다.

## ✅ 설치 완료

- ✅ Streamlit 1.51.0
- ✅ LangChain
- ✅ FastAPI
- ✅ Supabase 클라이언트

## ⚠️ 설치 필요

### 1. sentence-transformers
```bash
# Windows Long Path 활성화 후 재시작 필요
pip install sentence-transformers
```

### 2. Ollama
- 다운로드: https://ollama.com/download
- 설치 후: `ollama pull llama3`

## 🚀 빠른 테스트

### Streamlit UI 확인 (백엔드 없이도 가능)

```bash
streamlit run frontend/streamlit_app.py
```

백엔드가 없어도 UI는 확인할 수 있습니다 (API 연결 오류는 정상).

### 백엔드 서버 확인

```bash
cd backend
python -m uvicorn main:app --reload
```

브라우저에서 `http://localhost:8000/docs` 접속하여 API 문서 확인.

## 📝 다음 단계

1. **Windows Long Path 활성화** (관리자 PowerShell)
2. **컴퓨터 재시작**
3. **sentence-transformers 설치**
4. **Ollama 설치 및 모델 다운로드**
5. **문서 인덱싱 실행**
6. **서버 및 UI 실행**

