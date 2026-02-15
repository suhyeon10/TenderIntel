# 🚀 준비 완료! 실행 가이드

## ✅ 현재 준비된 것들

1. **Streamlit 1.51.0** ✅
2. **LangChain** ✅
3. **FastAPI** ✅
4. **Supabase** ✅
5. **해커톤 모드 구현** ✅
6. **간단한 인덱싱 스크립트** ✅
7. **Streamlit 프론트엔드** ✅

## 📁 문서 파일 준비됨

`backend/backend/data/announcements/` 폴더에 7개 파일:
- PDF: 2개
- HWP: 2개
- HWPX: 3개

## 🚀 지금 바로 실행 가능

### 1. Streamlit UI 실행

```bash
streamlit run frontend/streamlit_app.py
```

브라우저에서 `http://localhost:8501` 자동으로 열림

### 2. 백엔드 서버 실행

```bash
cd backend
python -m uvicorn main:app --reload
```

브라우저에서 `http://localhost:8000/docs` 접속하여 API 문서 확인

## ⚠️ 설치 필요 (순서대로)

### 1단계: Windows Long Path 활성화

**관리자 권한 PowerShell:**
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

**재시작 필수!**

### 2단계: sentence-transformers 설치

재시작 후:
```bash
pip install sentence-transformers
```

### 3단계: Ollama 설치 (PATH 추가 필요할 수 있음)

- 다운로드: https://ollama.com/download
- 설치 후 PATH 확인
- 모델 다운로드: `ollama pull llama3`

## 🎯 실행 순서 (Long Path 활성화 후)

1. **문서 인덱싱**
   ```bash
   cd backend
   python scripts/simple_ingest.py --docs-dir backend/data/announcements
   ```

2. **백엔드 서버**
   ```bash
   python -m uvicorn main:app --reload
   ```

3. **프론트엔드** (새 터미널)
   ```bash
   streamlit run frontend/streamlit_app.py
   ```

## 💡 지금 할 수 있는 것

- ✅ Streamlit UI 확인
- ✅ FastAPI 서버 실행
- ✅ API 문서 확인
- ⚠️ 문서 인덱싱 (sentence-transformers 필요)
- ⚠️ LLM 사용 (Ollama PATH 설정 필요)

## 📝 체크리스트

- [x] Streamlit 설치 완료
- [x] 해커톤 모드 구현 완료
- [x] 간단한 인덱싱 스크립트 준비
- [x] Streamlit 프론트엔드 준비
- [ ] Windows Long Path 활성화
- [ ] sentence-transformers 설치
- [ ] Ollama 설치 및 PATH 설정
- [ ] 문서 인덱싱 실행

