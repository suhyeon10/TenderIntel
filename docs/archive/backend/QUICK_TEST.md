# 🧪 빠른 테스트 가이드

현재 상태를 확인하고 테스트하는 방법입니다.

## ✅ 현재 설치 확인

### Streamlit
```bash
python -c "import streamlit; print(streamlit.__version__)"
```
→ **1.51.0** (설치 완료)

### LangChain
```bash
python -c "from langchain_community.document_loaders import DirectoryLoader; print('OK')"
```
→ **OK** (설치 완료)

## ⚠️ 설치 필요 확인

### sentence-transformers
```bash
python -c "from sentence_transformers import SentenceTransformer; print('OK')"
```
→ **필요**: Windows Long Path 활성화 후 설치

### Ollama
```bash
ollama --version
```
→ **필요**: https://ollama.com/download 에서 설치

## 🚀 빠른 테스트

### 1. Streamlit UI 확인

```bash
streamlit run frontend/streamlit_app.py
```

브라우저에서 `http://localhost:8501` 접속
- UI는 정상 작동 (백엔드 연결 오류는 정상)

### 2. 백엔드 서버 확인

```bash
cd backend
python -m uvicorn main:app --reload
```

브라우저에서 `http://localhost:8000/docs` 접속
- API 문서 확인 가능

### 3. 간단한 스크립트 테스트

```bash
cd backend
python scripts/simple_ingest.py --help
```

## 📝 다음 단계

1. **Windows Long Path 활성화** (관리자 PowerShell)
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```

2. **재시작**

3. **sentence-transformers 설치**
   ```bash
   pip install sentence-transformers
   ```

4. **Ollama 설치**
   - https://ollama.com/download
   - `ollama pull llama3`

5. **문서 인덱싱**
   ```bash
   python scripts/simple_ingest.py --docs-dir ./data/announcements
   ```

## 🎯 현재 가능한 작업

- ✅ Streamlit UI 확인
- ✅ FastAPI 서버 실행
- ✅ API 문서 확인
- ⚠️ 문서 인덱싱 (sentence-transformers 필요)
- ⚠️ LLM 사용 (Ollama 필요)

